import { Router } from "express";
import type { SignalsModule } from "../signals";
import { requireApiKey } from "./middleware";

export function signalRoutes(signals: SignalsModule): Router {
  const router = Router();

  /** Full signal summary for one asset — everything an agent needs */
  router.get("/signals/summary", requireApiKey, async (req, res) => {
    try {
      const coin = req.query.coin as string;
      if (!coin) return res.status(400).json({ error: "?coin=BTC required" });
      const summary = await signals.getSignalSummary(coin);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Scan for best trading opportunities right now */
  router.get("/signals/scan", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 5, 15);
      const opportunities = await signals.scanOpportunities(count);
      res.json({
        count: opportunities.length,
        scannedAt: new Date().toISOString(),
        opportunities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Market data for one asset (price, volume, OI, funding) */
  router.get("/signals/market", requireApiKey, async (req, res) => {
    try {
      const coin = req.query.coin as string;
      if (!coin) return res.status(400).json({ error: "?coin=BTC required" });
      const signal = await signals.getMarketSignal(coin);
      res.json(signal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Technical analysis for one asset (SMA, RSI, trend, support/resistance) */
  router.get("/signals/technical", requireApiKey, async (req, res) => {
    try {
      const coin = req.query.coin as string;
      const interval = (req.query.interval as string) || "1h";
      if (!coin) return res.status(400).json({ error: "?coin=BTC required. Optional: &interval=1h (1m,5m,15m,1h,4h,1d)" });
      const signal = await signals.getTechnicalSignal(coin, interval);
      res.json(signal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Top movers — biggest gainers and losers in 24h */
  router.get("/signals/movers", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 10, 50);
      const movers = await signals.getTopMovers(count);
      res.json(movers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Funding rate extremes — contrarian signal */
  router.get("/signals/funding", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 10, 50);
      const extremes = await signals.getFundingExtremes(count);
      res.json(extremes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Funding rate history for one asset */
  router.get("/signals/funding/history", requireApiKey, async (req, res) => {
    try {
      const coin = req.query.coin as string;
      const hours = Math.min(parseInt(req.query.hours as string) || 24, 168);
      if (!coin) return res.status(400).json({ error: "?coin=BTC required. Optional: &hours=24 (max 168)" });
      const history = await signals.getFundingHistory(coin, hours);
      res.json({ coin: coin.toUpperCase(), hours, entries: history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Predicted funding rates for all assets */
  router.get("/signals/funding/predicted", requireApiKey, async (req, res) => {
    try {
      const predictions = await signals.getPredictedFunding();
      res.json({ count: predictions.length, predictions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Whale orderbook analysis — large bids/asks, bid-ask depth ratio */
  router.get("/signals/whales", requireApiKey, async (req, res) => {
    try {
      const coin = req.query.coin as string;
      const minSize = parseInt(req.query.minSizeUsd as string) || 50_000;
      if (!coin) return res.status(400).json({ error: "?coin=BTC required. Optional: &minSizeUsd=50000" });
      const [positions, depth] = await Promise.all([
        signals.getWhalePositions(coin, minSize),
        signals.getWhaleTrades(coin, minSize),
      ]);
      res.json({
        coin: coin.toUpperCase(),
        largeOrders: positions,
        bookDepth: depth[0],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Crowded trades — assets at open interest cap */
  router.get("/signals/crowded", requireApiKey, async (req, res) => {
    try {
      const crowded = await signals.getCrowdedTrades();
      res.json({ count: crowded.length, assets: crowded, warning: "These assets are at OI cap — crowded trades, high liquidation risk" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Agent instructions for signals module */
  router.get("/signals/agent-instructions", (_, res) => {
    res.json({
      module: "Signals Intelligence",
      description: "Real-time market intelligence for smarter trading decisions. Pulls data from Hyperliquid — funding rates, open interest, whale activity, technical analysis, and more.",
      workflow: [
        "1. GET /signals/scan — find the best opportunities right now (scans all 250+ assets)",
        "2. GET /signals/summary?coin=BTC — deep dive on a specific asset (market + technical + whales + verdict)",
        "3. Use the verdict to decide: long, short, or wait",
        "4. Execute via /perp/orders/place with the signal's direction",
      ],
      endpoints: {
        "GET /signals/summary?coin=": "Full analysis: market data + technicals + whale activity + trading verdict",
        "GET /signals/scan?count=5": "Scan all assets for best opportunities (with confidence rating)",
        "GET /signals/market?coin=": "Price, volume, OI, funding rate, 24h change",
        "GET /signals/technical?coin=&interval=1h": "SMA, RSI, trend, momentum, support/resistance",
        "GET /signals/movers?count=10": "Top gainers and losers by 24h change",
        "GET /signals/funding?count=10": "Most extreme funding rates (contrarian signals)",
        "GET /signals/funding/history?coin=&hours=24": "Historical funding rates",
        "GET /signals/funding/predicted": "Predicted next funding rates for all assets",
        "GET /signals/whales?coin=&minSizeUsd=50000": "Large orderbook positions + bid/ask depth ratio",
        "GET /signals/crowded": "Assets at open interest cap (high risk)",
      },
      tips: [
        "Use /signals/scan before trading — it tells you what's worth looking at",
        "Extreme funding = contrarian signal. Everyone long? Consider shorting.",
        "RSI below 30 = oversold bounce potential. RSI above 70 = overbought pullback.",
        "Check whale orderbook depth — big bid walls = buy support, big ask walls = sell pressure.",
        "The verdict gives you direction + confidence. Only trade 'high' confidence signals.",
      ],
    });
  });

  return router;
}
