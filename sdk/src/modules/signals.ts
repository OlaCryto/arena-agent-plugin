import { HL_INFO } from "../constants.js";

interface HlAssetCtx { coin: string; markPx: string; midPx: string; oraclePx: string; openInterest: string; funding: string; premium: string; dayNtlVlm: string; prevDayPx: string; }
interface HlMeta { name: string; szDecimals: number; maxLeverage: number; }

export interface MarketSignal {
  coin: string; price: number; oraclePrice: number; change24h: number; change24hPct: number;
  volume24h: number; openInterest: number; fundingRate: number; fundingAnnualized: number;
  fundingBias: "long-heavy" | "short-heavy" | "neutral"; maxLeverage: number;
}

export interface TechnicalSignal {
  coin: string; price: number; sma20: number; sma50: number; rsi14: number;
  trend: "bullish" | "bearish" | "neutral"; momentum: "strong" | "moderate" | "weak";
  priceVsSma20: number; priceVsSma50: number; volatility: number; support: number; resistance: number;
}

export interface SignalSummary {
  coin: string; timestamp: string; market: MarketSignal; technical: TechnicalSignal;
  whaleActivity: { topLongs: any[]; topShorts: any[]; netBias: "long" | "short" | "neutral"; largestPosition: any | null };
  verdict: { direction: "long" | "short" | "wait"; confidence: "high" | "medium" | "low"; reasons: string[] };
}

export class SignalsModule {
  private assetCache: { data: any; ts: number } | null = null;
  private candleCache: Map<string, { data: number[][]; ts: number }> = new Map();

  private async hlPost(body: any): Promise<any> {
    const res = await fetch(HL_INFO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Hyperliquid API error ${res.status}`);
    return res.json();
  }

  /** Get all asset contexts (cached 10s) */
  async getAssetContexts(): Promise<{ meta: HlMeta[]; contexts: HlAssetCtx[] }> {
    if (this.assetCache && Date.now() - this.assetCache.ts < 10_000) return this.assetCache.data;
    const raw = await this.hlPost({ type: "metaAndAssetCtxs" });
    const result = { meta: raw[0].universe as HlMeta[], contexts: raw[1] as HlAssetCtx[] };
    this.assetCache = { data: result, ts: Date.now() };
    return result;
  }

  /** Get market signal for a specific asset */
  async getMarketSignal(coin: string): Promise<MarketSignal> {
    const { meta, contexts } = await this.getAssetContexts();
    const idx = meta.findIndex((m) => m.name.toUpperCase() === coin.toUpperCase());
    if (idx === -1) throw new Error(`Asset ${coin} not found on Hyperliquid`);
    const m = meta[idx]; const ctx = contexts[idx];
    const price = parseFloat(ctx.markPx); const prevPrice = parseFloat(ctx.prevDayPx);
    const funding = parseFloat(ctx.funding);
    const change24h = price - prevPrice;
    const change24hPct = prevPrice > 0 ? (change24h / prevPrice) * 100 : 0;
    let fundingBias: "long-heavy" | "short-heavy" | "neutral" = "neutral";
    if (funding > 0.0001) fundingBias = "long-heavy"; else if (funding < -0.0001) fundingBias = "short-heavy";
    return {
      coin: m.name, price, oraclePrice: parseFloat(ctx.oraclePx), change24h,
      change24hPct: Math.round(change24hPct * 100) / 100, volume24h: Math.round(parseFloat(ctx.dayNtlVlm)),
      openInterest: Math.round(parseFloat(ctx.openInterest)), fundingRate: funding,
      fundingAnnualized: Math.round(funding * 8760 * 10000) / 100, fundingBias, maxLeverage: m.maxLeverage,
    };
  }

  /** Get funding rate extremes across all markets */
  async getFundingExtremes(count = 10): Promise<{ mostPositive: MarketSignal[]; mostNegative: MarketSignal[] }> {
    const { meta, contexts } = await this.getAssetContexts();
    const signals = meta.map((m, i) => this.buildSignal(m, contexts[i]));
    const sorted = [...signals].sort((a, b) => b.fundingRate - a.fundingRate);
    return { mostPositive: sorted.slice(0, count), mostNegative: sorted.slice(-count).reverse() };
  }

  /** Get candle data for technical analysis (cached 60s) */
  async getCandles(coin: string, interval = "1h", count = 100): Promise<number[][]> {
    const cacheKey = `${coin}-${interval}`;
    const cached = this.candleCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60_000) return cached.data.slice(-count);
    const startTime = Date.now() - count * this.intervalToMs(interval);
    const data = await this.hlPost({ type: "candleSnapshot", req: { coin: coin.toUpperCase(), interval, startTime, endTime: Date.now() } });
    const candles = data.map((c: any) => [c.t, parseFloat(c.o), parseFloat(c.h), parseFloat(c.l), parseFloat(c.c), parseFloat(c.v)]);
    this.candleCache.set(cacheKey, { data: candles, ts: Date.now() });
    return candles.slice(-count);
  }

  /** Compute technical signals from candle data */
  async getTechnicalSignal(coin: string, interval = "1h"): Promise<TechnicalSignal> {
    const candles = await this.getCandles(coin, interval, 100);
    const closes = candles.map((c) => c[4]);
    const highs = candles.map((c) => c[2]);
    const lows = candles.map((c) => c[3]);
    const price = closes[closes.length - 1];
    const sma20 = this.sma(closes, 20); const sma50 = this.sma(closes, 50); const rsi14 = this.rsi(closes, 14);
    let trend: "bullish" | "bearish" | "neutral" = "neutral";
    if (price > sma20 && price > sma50) trend = "bullish"; else if (price < sma20 && price < sma50) trend = "bearish";
    let momentum: "strong" | "moderate" | "weak" = "moderate";
    if (rsi14 > 70 || rsi14 < 30) momentum = "strong"; else if (rsi14 > 60 || rsi14 < 40) momentum = "moderate"; else momentum = "weak";
    const returns = closes.slice(-21).map((c, i, arr) => i === 0 ? 0 : (c - arr[i - 1]) / arr[i - 1]); returns.shift();
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;
    const resistance = Math.max(...highs.slice(-20)); const support = Math.min(...lows.slice(-20));
    return {
      coin: coin.toUpperCase(), price, sma20: Math.round(sma20 * 100) / 100, sma50: Math.round(sma50 * 100) / 100,
      rsi14: Math.round(rsi14 * 100) / 100, trend, momentum,
      priceVsSma20: Math.round(((price - sma20) / sma20) * 10000) / 100,
      priceVsSma50: Math.round(((price - sma50) / sma50) * 10000) / 100,
      volatility: Math.round(volatility * 100) / 100, support: Math.round(support * 100) / 100, resistance: Math.round(resistance * 100) / 100,
    };
  }

  /** Get whale positions from orderbook depth */
  async getWhalePositions(coin: string, minPositionUsd = 100_000): Promise<any[]> {
    const book = await this.hlPost({ type: "l2Book", coin: coin.toUpperCase() });
    const whales: any[] = [];
    for (const level of book.levels[0] ?? []) {
      const px = parseFloat(level.px); const sz = parseFloat(level.sz); const value = px * sz;
      if (value >= minPositionUsd) whales.push({ coin: coin.toUpperCase(), size: sz, entryPrice: px, side: "long", positionValue: Math.round(value) });
    }
    for (const level of book.levels[1] ?? []) {
      const px = parseFloat(level.px); const sz = parseFloat(level.sz); const value = px * sz;
      if (value >= minPositionUsd) whales.push({ coin: coin.toUpperCase(), size: sz, entryPrice: px, side: "short", positionValue: Math.round(value) });
    }
    return whales.sort((a, b) => b.positionValue - a.positionValue);
  }

  /** Full signal summary — everything an agent needs to decide */
  async summary(coin: string): Promise<SignalSummary> {
    const [market, technical, whalePositions] = await Promise.all([
      this.getMarketSignal(coin), this.getTechnicalSignal(coin), this.getWhalePositions(coin),
    ]);
    const topLongs = whalePositions.filter((w) => w.side === "long").slice(0, 5);
    const topShorts = whalePositions.filter((w) => w.side === "short").slice(0, 5);
    const longValue = topLongs.reduce((s: number, w: any) => s + w.positionValue, 0);
    const shortValue = topShorts.reduce((s: number, w: any) => s + w.positionValue, 0);
    let netBias: "long" | "short" | "neutral" = "neutral";
    if (longValue > shortValue * 1.3) netBias = "long"; else if (shortValue > longValue * 1.3) netBias = "short";

    const reasons: string[] = []; let longScore = 0; let shortScore = 0;
    if (technical.trend === "bullish") { longScore += 2; reasons.push("Price above SMA20 & SMA50 (bullish trend)"); }
    else if (technical.trend === "bearish") { shortScore += 2; reasons.push("Price below SMA20 & SMA50 (bearish trend)"); }
    if (technical.rsi14 < 30) { longScore += 2; reasons.push(`RSI ${technical.rsi14} — oversold`); }
    else if (technical.rsi14 > 70) { shortScore += 2; reasons.push(`RSI ${technical.rsi14} — overbought`); }
    if (market.fundingBias === "long-heavy") { shortScore += 1; reasons.push("Crowded long — contrarian short signal"); }
    else if (market.fundingBias === "short-heavy") { longScore += 1; reasons.push("Crowded short — contrarian long signal"); }
    if (netBias === "long") { longScore += 1; reasons.push("Whale bias: more large bids"); }
    else if (netBias === "short") { shortScore += 1; reasons.push("Whale bias: more large asks"); }
    if (market.change24hPct > 3) { longScore += 1; reasons.push(`+${market.change24hPct}% momentum`); }
    else if (market.change24hPct < -3) { shortScore += 1; reasons.push(`${market.change24hPct}% selling`); }

    const diff = Math.abs(longScore - shortScore);
    let direction: "long" | "short" | "wait" = "wait";
    let confidence: "high" | "medium" | "low" = "low";
    if (diff >= 4) { direction = longScore > shortScore ? "long" : "short"; confidence = "high"; }
    else if (diff >= 2) { direction = longScore > shortScore ? "long" : "short"; confidence = "medium"; }
    else { reasons.push("Mixed signals — wait for better setup."); }

    return {
      coin: coin.toUpperCase(), timestamp: new Date().toISOString(), market, technical,
      whaleActivity: { topLongs, topShorts, netBias, largestPosition: whalePositions[0] ?? null },
      verdict: { direction, confidence, reasons },
    };
  }

  /** Scan for top trading opportunities */
  async scan(count = 5): Promise<SignalSummary[]> {
    const [movers, funding] = await Promise.all([this.getTopMovers(10), this.getFundingExtremes(10)]);
    const candidates = new Set<string>(["BTC", "ETH", "SOL"]);
    movers.gainers.slice(0, 3).forEach((s) => candidates.add(s.coin));
    movers.losers.slice(0, 3).forEach((s) => candidates.add(s.coin));
    funding.mostPositive.slice(0, 2).forEach((s) => candidates.add(s.coin));
    funding.mostNegative.slice(0, 2).forEach((s) => candidates.add(s.coin));
    const summaries = await Promise.all(Array.from(candidates).slice(0, 15).map((c) => this.summary(c).catch(() => null)));
    const valid = summaries.filter((s): s is SignalSummary => s !== null && s.verdict.direction !== "wait");
    const order = { high: 3, medium: 2, low: 1 };
    valid.sort((a, b) => order[b.verdict.confidence] - order[a.verdict.confidence]);
    return valid.slice(0, count);
  }

  private async getTopMovers(count: number) {
    const { meta, contexts } = await this.getAssetContexts();
    const signals = meta.map((m, i) => this.buildSignal(m, contexts[i]));
    const sorted = [...signals].sort((a, b) => b.change24hPct - a.change24hPct);
    return { gainers: sorted.slice(0, count), losers: sorted.slice(-count).reverse() };
  }

  private buildSignal(m: HlMeta, ctx: HlAssetCtx): MarketSignal {
    const price = parseFloat(ctx.markPx); const prevPrice = parseFloat(ctx.prevDayPx); const funding = parseFloat(ctx.funding);
    const change24hPct = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
    let fundingBias: "long-heavy" | "short-heavy" | "neutral" = "neutral";
    if (funding > 0.0001) fundingBias = "long-heavy"; else if (funding < -0.0001) fundingBias = "short-heavy";
    return {
      coin: m.name, price, oraclePrice: parseFloat(ctx.oraclePx), change24h: price - prevPrice,
      change24hPct: Math.round(change24hPct * 100) / 100, volume24h: Math.round(parseFloat(ctx.dayNtlVlm)),
      openInterest: Math.round(parseFloat(ctx.openInterest)), fundingRate: funding,
      fundingAnnualized: Math.round(funding * 8760 * 10000) / 100, fundingBias, maxLeverage: m.maxLeverage,
    };
  }

  private sma(data: number[], period: number): number { const s = data.slice(-period); return s.reduce((sum, v) => sum + v, 0) / s.length; }
  private rsi(closes: number[], period: number): number {
    const changes = closes.slice(-period - 1).map((c, i, arr) => i === 0 ? 0 : c - arr[i - 1]); changes.shift();
    let avgGain = 0; let avgLoss = 0;
    for (const ch of changes) { if (ch > 0) avgGain += ch; else avgLoss += Math.abs(ch); }
    avgGain /= period; avgLoss /= period;
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }
  private intervalToMs(interval: string): number {
    const map: Record<string, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };
    return map[interval] ?? 3_600_000;
  }
}
