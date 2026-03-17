/**
 * SignalsModule — Intelligence layer for AI agent trading decisions.
 * Pulls market data, whale activity, funding rates, open interest,
 * and technical signals from Hyperliquid + public APIs.
 *
 * All data is free — no API keys needed.
 */

const HL_INFO = "https://api.hyperliquid.xyz/info";
const COINGECKO_API = "https://api.coingecko.com/api/v3";

interface HlAssetCtx {
  coin: string;
  markPx: string;
  midPx: string;
  oraclePx: string;
  openInterest: string;
  funding: string;
  premium: string;
  dayNtlVlm: string;
  prevDayPx: string;
  impactPxs: string[];
}

interface HlMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface FundingEntry {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

interface MarketSignal {
  coin: string;
  price: number;
  oraclePrice: number;
  change24h: number;
  change24hPct: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  fundingAnnualized: number;
  fundingBias: "long-heavy" | "short-heavy" | "neutral";
  maxLeverage: number;
}

interface WhalePosition {
  address: string;
  coin: string;
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage: number;
  side: "long" | "short";
  positionValue: number;
}

interface TechnicalSignal {
  coin: string;
  price: number;
  sma20: number;
  sma50: number;
  rsi14: number;
  trend: "bullish" | "bearish" | "neutral";
  momentum: "strong" | "moderate" | "weak";
  priceVsSma20: number;
  priceVsSma50: number;
  volatility: number;
  support: number;
  resistance: number;
}

interface SignalSummary {
  coin: string;
  timestamp: string;
  market: MarketSignal;
  technical: TechnicalSignal;
  whaleActivity: {
    topLongs: WhalePosition[];
    topShorts: WhalePosition[];
    netBias: "long" | "short" | "neutral";
    largestPosition: WhalePosition | null;
  };
  verdict: {
    direction: "long" | "short" | "wait";
    confidence: "high" | "medium" | "low";
    reasons: string[];
  };
}

export class SignalsModule {
  private assetCache: { data: any; ts: number } | null = null;
  private candleCache: Map<string, { data: number[][]; ts: number }> = new Map();

  /**
   * POST to Hyperliquid info endpoint.
   */
  private async hlPost(body: any): Promise<any> {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Hyperliquid API error ${res.status}`);
    return res.json();
  }

  /**
   * Get all asset contexts (prices, funding, OI, volume).
   * Cached for 10 seconds.
   */
  async getAssetContexts(): Promise<{ meta: HlMeta[]; contexts: HlAssetCtx[] }> {
    if (this.assetCache && Date.now() - this.assetCache.ts < 10_000) {
      return this.assetCache.data;
    }
    const raw = await this.hlPost({ type: "metaAndAssetCtxs" });
    const meta: HlMeta[] = raw[0].universe;
    const contexts: HlAssetCtx[] = raw[1];
    const result = { meta, contexts };
    this.assetCache = { data: result, ts: Date.now() };
    return result;
  }

  /**
   * Get market signal for a specific asset.
   */
  async getMarketSignal(coin: string): Promise<MarketSignal> {
    const { meta, contexts } = await this.getAssetContexts();
    const upperCoin = coin.toUpperCase();

    const idx = meta.findIndex((m) => m.name.toUpperCase() === upperCoin);
    if (idx === -1) throw new Error(`Asset ${coin} not found on Hyperliquid`);

    const m = meta[idx];
    const ctx = contexts[idx];
    const price = parseFloat(ctx.markPx);
    const oraclePrice = parseFloat(ctx.oraclePx);
    const prevPrice = parseFloat(ctx.prevDayPx);
    const funding = parseFloat(ctx.funding);
    const oi = parseFloat(ctx.openInterest);
    const volume = parseFloat(ctx.dayNtlVlm);

    const change24h = price - prevPrice;
    const change24hPct = prevPrice > 0 ? (change24h / prevPrice) * 100 : 0;

    // Funding > 0.01% = longs paying shorts (long-heavy)
    // Funding < -0.01% = shorts paying longs (short-heavy)
    let fundingBias: "long-heavy" | "short-heavy" | "neutral" = "neutral";
    if (funding > 0.0001) fundingBias = "long-heavy";
    else if (funding < -0.0001) fundingBias = "short-heavy";

    return {
      coin: m.name,
      price,
      oraclePrice,
      change24h,
      change24hPct: Math.round(change24hPct * 100) / 100,
      volume24h: Math.round(volume),
      openInterest: Math.round(oi),
      fundingRate: funding,
      fundingAnnualized: Math.round(funding * 8760 * 10000) / 100, // hourly * 8760h/yr as %
      fundingBias,
      maxLeverage: m.maxLeverage,
    };
  }

  /**
   * Get top movers by 24h change.
   */
  async getTopMovers(count: number = 10): Promise<{ gainers: MarketSignal[]; losers: MarketSignal[] }> {
    const { meta, contexts } = await this.getAssetContexts();

    const signals: MarketSignal[] = meta.map((m, i) => {
      const ctx = contexts[i];
      const price = parseFloat(ctx.markPx);
      const prevPrice = parseFloat(ctx.prevDayPx);
      const funding = parseFloat(ctx.funding);
      const change24h = price - prevPrice;
      const change24hPct = prevPrice > 0 ? (change24h / prevPrice) * 100 : 0;

      let fundingBias: "long-heavy" | "short-heavy" | "neutral" = "neutral";
      if (funding > 0.0001) fundingBias = "long-heavy";
      else if (funding < -0.0001) fundingBias = "short-heavy";

      return {
        coin: m.name,
        price,
        oraclePrice: parseFloat(ctx.oraclePx),
        change24h,
        change24hPct: Math.round(change24hPct * 100) / 100,
        volume24h: Math.round(parseFloat(ctx.dayNtlVlm)),
        openInterest: Math.round(parseFloat(ctx.openInterest)),
        fundingRate: funding,
        fundingAnnualized: Math.round(funding * 8760 * 10000) / 100,
        fundingBias,
        maxLeverage: m.maxLeverage,
      };
    });

    const sorted = [...signals].sort((a, b) => b.change24hPct - a.change24hPct);
    return {
      gainers: sorted.slice(0, count),
      losers: sorted.slice(-count).reverse(),
    };
  }

  /**
   * Get assets with extreme funding rates (contrarian signal).
   */
  async getFundingExtremes(count: number = 10): Promise<{ mostPositive: MarketSignal[]; mostNegative: MarketSignal[] }> {
    const { meta, contexts } = await this.getAssetContexts();

    const signals: MarketSignal[] = meta.map((m, i) => {
      const ctx = contexts[i];
      const price = parseFloat(ctx.markPx);
      const prevPrice = parseFloat(ctx.prevDayPx);
      const funding = parseFloat(ctx.funding);
      const change24hPct = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;

      let fundingBias: "long-heavy" | "short-heavy" | "neutral" = "neutral";
      if (funding > 0.0001) fundingBias = "long-heavy";
      else if (funding < -0.0001) fundingBias = "short-heavy";

      return {
        coin: m.name,
        price,
        oraclePrice: parseFloat(ctx.oraclePx),
        change24h: price - prevPrice,
        change24hPct: Math.round(change24hPct * 100) / 100,
        volume24h: Math.round(parseFloat(ctx.dayNtlVlm)),
        openInterest: Math.round(parseFloat(ctx.openInterest)),
        fundingRate: funding,
        fundingAnnualized: Math.round(funding * 8760 * 10000) / 100,
        fundingBias,
        maxLeverage: m.maxLeverage,
      };
    });

    const sorted = [...signals].sort((a, b) => b.fundingRate - a.fundingRate);
    return {
      mostPositive: sorted.slice(0, count),
      mostNegative: sorted.slice(-count).reverse(),
    };
  }

  /**
   * Get historical funding rates for an asset.
   */
  async getFundingHistory(coin: string, hours: number = 24): Promise<FundingEntry[]> {
    const startTime = Date.now() - hours * 60 * 60 * 1000;
    const data = await this.hlPost({
      type: "fundingHistory",
      coin: coin.toUpperCase(),
      startTime,
    });
    return data;
  }

  /**
   * Get predicted funding rates for all assets.
   */
  async getPredictedFunding(): Promise<Array<{ coin: string; predictedRate: number; nextFundingTime: number }>> {
    const data = await this.hlPost({ type: "predictedFundings" });
    return data.map((entry: any) => ({
      coin: entry[0],
      predictedRate: parseFloat(entry[1][0]?.fundingRate ?? "0"),
      nextFundingTime: entry[1][0]?.nextFundingTime ?? 0,
    }));
  }

  /**
   * Get candle data for technical analysis.
   * Cached for 60 seconds.
   */
  async getCandles(coin: string, interval: string = "1h", count: number = 100): Promise<number[][]> {
    const cacheKey = `${coin}-${interval}`;
    const cached = this.candleCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60_000) {
      return cached.data.slice(-count);
    }

    const startTime = Date.now() - count * this.intervalToMs(interval);
    const data = await this.hlPost({
      type: "candleSnapshot",
      req: {
        coin: coin.toUpperCase(),
        interval,
        startTime,
        endTime: Date.now(),
      },
    });

    // data = array of { T, t, o, c, h, l, v, n, i, s }
    const candles = data.map((c: any) => [
      c.t,                     // 0: open time
      parseFloat(c.o),         // 1: open
      parseFloat(c.h),         // 2: high
      parseFloat(c.l),         // 3: low
      parseFloat(c.c),         // 4: close
      parseFloat(c.v),         // 5: volume
    ]);

    this.candleCache.set(cacheKey, { data: candles, ts: Date.now() });
    return candles.slice(-count);
  }

  /**
   * Compute technical signals from candle data.
   */
  async getTechnicalSignal(coin: string, interval: string = "1h"): Promise<TechnicalSignal> {
    const candles = await this.getCandles(coin, interval, 100);
    const closes = candles.map((c) => c[4]);
    const highs = candles.map((c) => c[2]);
    const lows = candles.map((c) => c[3]);

    const price = closes[closes.length - 1];
    const sma20 = this.sma(closes, 20);
    const sma50 = this.sma(closes, 50);
    const rsi14 = this.rsi(closes, 14);

    // Trend: price above both SMAs = bullish, below both = bearish
    let trend: "bullish" | "bearish" | "neutral" = "neutral";
    if (price > sma20 && price > sma50) trend = "bullish";
    else if (price < sma20 && price < sma50) trend = "bearish";

    // Momentum based on RSI
    let momentum: "strong" | "moderate" | "weak" = "moderate";
    if (rsi14 > 70 || rsi14 < 30) momentum = "strong";
    else if (rsi14 > 60 || rsi14 < 40) momentum = "moderate";
    else momentum = "weak";

    // Volatility: std dev of returns over last 20 candles
    const returns = closes.slice(-21).map((c, i, arr) => i === 0 ? 0 : (c - arr[i - 1]) / arr[i - 1]);
    returns.shift();
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;

    // Support/Resistance from recent highs/lows (last 20 candles)
    const recentHighs = highs.slice(-20);
    const recentLows = lows.slice(-20);
    const resistance = Math.max(...recentHighs);
    const support = Math.min(...recentLows);

    return {
      coin: coin.toUpperCase(),
      price,
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      rsi14: Math.round(rsi14 * 100) / 100,
      trend,
      momentum,
      priceVsSma20: Math.round(((price - sma20) / sma20) * 10000) / 100,
      priceVsSma50: Math.round(((price - sma50) / sma50) * 10000) / 100,
      volatility: Math.round(volatility * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
    };
  }

  /**
   * Get whale positions — largest positions on Hyperliquid for an asset.
   */
  async getWhalePositions(coin: string, minPositionUsd: number = 100_000): Promise<WhalePosition[]> {
    // Get the L2 order book to identify large resting orders
    const book = await this.hlPost({
      type: "l2Book",
      coin: coin.toUpperCase(),
    });

    const whaleOrders: WhalePosition[] = [];
    const price = parseFloat(book.levels[0]?.[0]?.px ?? "0");

    // Large bids = whale longs
    for (const level of book.levels[0] ?? []) {
      const px = parseFloat(level.px);
      const sz = parseFloat(level.sz);
      const value = px * sz;
      if (value >= minPositionUsd) {
        whaleOrders.push({
          address: "orderbook",
          coin: coin.toUpperCase(),
          size: sz,
          entryPrice: px,
          unrealizedPnl: 0,
          leverage: 0,
          side: "long",
          positionValue: Math.round(value),
        });
      }
    }

    // Large asks = whale shorts
    for (const level of book.levels[1] ?? []) {
      const px = parseFloat(level.px);
      const sz = parseFloat(level.sz);
      const value = px * sz;
      if (value >= minPositionUsd) {
        whaleOrders.push({
          address: "orderbook",
          coin: coin.toUpperCase(),
          size: sz,
          entryPrice: px,
          unrealizedPnl: 0,
          leverage: 0,
          side: "short",
          positionValue: Math.round(value),
        });
      }
    }

    return whaleOrders.sort((a, b) => b.positionValue - a.positionValue);
  }

  /**
   * Get recent large trades (whale trades) for an asset.
   */
  async getWhaleTrades(coin: string, minSizeUsd: number = 50_000, count: number = 20): Promise<any[]> {
    // Use the recent trades from orderbook to detect large fills
    const book = await this.hlPost({
      type: "l2Book",
      coin: coin.toUpperCase(),
    });
    const price = parseFloat(book.levels[0]?.[0]?.px ?? "0");

    // Get the market signal for volume context
    const signal = await this.getMarketSignal(coin);

    // Return book depth analysis as whale signal
    let totalBidDepth = 0;
    let totalAskDepth = 0;

    for (const level of book.levels[0] ?? []) {
      totalBidDepth += parseFloat(level.px) * parseFloat(level.sz);
    }
    for (const level of book.levels[1] ?? []) {
      totalAskDepth += parseFloat(level.px) * parseFloat(level.sz);
    }

    const bidAskRatio = totalAskDepth > 0 ? totalBidDepth / totalAskDepth : 1;

    return [{
      coin: coin.toUpperCase(),
      price,
      totalBidDepthUsd: Math.round(totalBidDepth),
      totalAskDepthUsd: Math.round(totalAskDepth),
      bidAskRatio: Math.round(bidAskRatio * 100) / 100,
      interpretation: bidAskRatio > 1.5 ? "Strong buy wall — whales defending bids"
        : bidAskRatio < 0.67 ? "Strong sell wall — whales stacking asks"
        : "Balanced book",
      volume24h: signal.volume24h,
      openInterest: signal.openInterest,
    }];
  }

  /**
   * Get assets at open interest cap (crowded trades).
   */
  async getCrowdedTrades(): Promise<string[]> {
    return this.hlPost({ type: "perpsAtOpenInterestCap" });
  }

  /**
   * Full signal summary — everything an agent needs to make a decision.
   */
  async getSignalSummary(coin: string): Promise<SignalSummary> {
    const [market, technical, whalePositions, whaleTrades] = await Promise.all([
      this.getMarketSignal(coin),
      this.getTechnicalSignal(coin),
      this.getWhalePositions(coin),
      this.getWhaleTrades(coin),
    ]);

    const topLongs = whalePositions.filter((w) => w.side === "long").slice(0, 5);
    const topShorts = whalePositions.filter((w) => w.side === "short").slice(0, 5);
    const longValue = topLongs.reduce((s, w) => s + w.positionValue, 0);
    const shortValue = topShorts.reduce((s, w) => s + w.positionValue, 0);

    let netBias: "long" | "short" | "neutral" = "neutral";
    if (longValue > shortValue * 1.3) netBias = "long";
    else if (shortValue > longValue * 1.3) netBias = "short";

    // Generate verdict
    const reasons: string[] = [];
    let longScore = 0;
    let shortScore = 0;

    // Trend signal
    if (technical.trend === "bullish") { longScore += 2; reasons.push("Price above SMA20 & SMA50 (bullish trend)"); }
    else if (technical.trend === "bearish") { shortScore += 2; reasons.push("Price below SMA20 & SMA50 (bearish trend)"); }

    // RSI signal
    if (technical.rsi14 < 30) { longScore += 2; reasons.push(`RSI ${technical.rsi14} — oversold, potential bounce`); }
    else if (technical.rsi14 > 70) { shortScore += 2; reasons.push(`RSI ${technical.rsi14} — overbought, potential pullback`); }
    else if (technical.rsi14 < 40) { longScore += 1; reasons.push(`RSI ${technical.rsi14} — approaching oversold`); }
    else if (technical.rsi14 > 60) { shortScore += 1; reasons.push(`RSI ${technical.rsi14} — approaching overbought`); }

    // Funding contrarian signal
    if (market.fundingBias === "long-heavy") {
      shortScore += 1;
      reasons.push(`Funding ${(market.fundingRate * 100).toFixed(4)}% — longs paying, crowded long (contrarian short)`);
    } else if (market.fundingBias === "short-heavy") {
      longScore += 1;
      reasons.push(`Funding ${(market.fundingRate * 100).toFixed(4)}% — shorts paying, crowded short (contrarian long)`);
    }

    // Whale bias
    if (netBias === "long") { longScore += 1; reasons.push("Whale orderbook bias: more large bids than asks"); }
    else if (netBias === "short") { shortScore += 1; reasons.push("Whale orderbook bias: more large asks than bids"); }

    // Book depth
    if (whaleTrades[0]) {
      const ratio = whaleTrades[0].bidAskRatio;
      if (ratio > 1.5) { longScore += 1; reasons.push(`Bid/ask depth ratio ${ratio} — strong buy support`); }
      else if (ratio < 0.67) { shortScore += 1; reasons.push(`Bid/ask depth ratio ${ratio} — heavy sell pressure`); }
    }

    // 24h momentum
    if (market.change24hPct > 3) { longScore += 1; reasons.push(`+${market.change24hPct}% in 24h — strong momentum`); }
    else if (market.change24hPct < -3) { shortScore += 1; reasons.push(`${market.change24hPct}% in 24h — selling momentum`); }

    let direction: "long" | "short" | "wait" = "wait";
    let confidence: "high" | "medium" | "low" = "low";

    const diff = Math.abs(longScore - shortScore);
    if (diff >= 4) {
      direction = longScore > shortScore ? "long" : "short";
      confidence = "high";
    } else if (diff >= 2) {
      direction = longScore > shortScore ? "long" : "short";
      confidence = "medium";
    } else {
      direction = "wait";
      confidence = "low";
      reasons.push("Mixed signals — no clear edge. Wait for better setup.");
    }

    return {
      coin: coin.toUpperCase(),
      timestamp: new Date().toISOString(),
      market,
      technical,
      whaleActivity: {
        topLongs,
        topShorts,
        netBias,
        largestPosition: whalePositions[0] ?? null,
      },
      verdict: { direction, confidence, reasons },
    };
  }

  /**
   * Scan all assets for the best opportunities.
   */
  async scanOpportunities(count: number = 5): Promise<SignalSummary[]> {
    // Get top movers + funding extremes as candidates
    const [movers, funding] = await Promise.all([
      this.getTopMovers(10),
      this.getFundingExtremes(10),
    ]);

    // Combine unique coins from gainers, losers, and funding extremes
    const candidates = new Set<string>();
    // Always include majors
    ["BTC", "ETH", "SOL"].forEach((c) => candidates.add(c));
    movers.gainers.slice(0, 3).forEach((s) => candidates.add(s.coin));
    movers.losers.slice(0, 3).forEach((s) => candidates.add(s.coin));
    funding.mostPositive.slice(0, 2).forEach((s) => candidates.add(s.coin));
    funding.mostNegative.slice(0, 2).forEach((s) => candidates.add(s.coin));

    // Get full signal summary for each candidate
    const summaries = await Promise.all(
      Array.from(candidates).slice(0, 15).map((coin) =>
        this.getSignalSummary(coin).catch(() => null),
      ),
    );

    // Filter out nulls and sort by confidence
    const valid = summaries.filter((s): s is SignalSummary => s !== null && s.verdict.direction !== "wait");
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    valid.sort((a, b) => confidenceOrder[b.verdict.confidence] - confidenceOrder[a.verdict.confidence]);

    return valid.slice(0, count);
  }

  // --- Helpers ---

  private sma(data: number[], period: number): number {
    const slice = data.slice(-period);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  }

  private rsi(closes: number[], period: number): number {
    const changes = closes.slice(-period - 1).map((c, i, arr) => (i === 0 ? 0 : c - arr[i - 1]));
    changes.shift();

    let avgGain = 0;
    let avgLoss = 0;
    for (const change of changes) {
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private intervalToMs(interval: string): number {
    const map: Record<string, number> = {
      "1m": 60_000,
      "5m": 300_000,
      "15m": 900_000,
      "1h": 3_600_000,
      "4h": 14_400_000,
      "1d": 86_400_000,
    };
    return map[interval] ?? 3_600_000;
  }
}
