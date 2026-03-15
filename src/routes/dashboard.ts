import { Router } from "express";
import { getAgentCount, getAgents } from "../data/apikeys";
import { getRecentTrades, getTradeStats } from "../data/tradelog";

export function dashboardRoutes(): Router {
  const router = Router();

  // Public — no API key required
  router.get("/dashboard/stats", (_req, res) => {
    const trades = getTradeStats();
    res.json({
      agents: getAgentCount(),
      trades: trades.total,
      tradesLast24h: trades.last24h,
      byModule: trades.byModule,
    });
  });

  router.get("/dashboard/agents", (_req, res) => {
    const agents = getAgents().map(a => ({
      name: a.name,
      wallet: a.wallet ? `${a.wallet.slice(0, 6)}...${a.wallet.slice(-4)}` : null,
      joinedAt: a.createdAt,
    }));
    res.json({ count: agents.length, agents });
  });

  router.get("/dashboard/activity", (req, res) => {
    const count = Math.min(parseInt(req.query.count as string) || 20, 100);
    const trades = getRecentTrades(count).map(t => ({
      ...t,
      wallet: `${t.wallet.slice(0, 6)}...${t.wallet.slice(-4)}`,
    }));
    res.json({ trades });
  });

  return router;
}
