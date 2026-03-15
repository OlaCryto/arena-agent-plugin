"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRoutes = dashboardRoutes;
const express_1 = require("express");
const apikeys_1 = require("../data/apikeys");
const tradelog_1 = require("../data/tradelog");
function dashboardRoutes() {
    const router = (0, express_1.Router)();
    // Public — no API key required
    router.get("/dashboard/stats", (_req, res) => {
        const trades = (0, tradelog_1.getTradeStats)();
        res.json({
            agents: (0, apikeys_1.getAgentCount)(),
            trades: trades.total,
            tradesLast24h: trades.last24h,
            byModule: trades.byModule,
        });
    });
    router.get("/dashboard/agents", (_req, res) => {
        const agents = (0, apikeys_1.getAgents)().map(a => ({
            name: a.name,
            wallet: a.wallet ? `${a.wallet.slice(0, 6)}...${a.wallet.slice(-4)}` : null,
            joinedAt: a.createdAt,
        }));
        res.json({ count: agents.length, agents });
    });
    router.get("/dashboard/activity", (req, res) => {
        const count = Math.min(parseInt(req.query.count) || 20, 100);
        const trades = (0, tradelog_1.getRecentTrades)(count).map(t => ({
            ...t,
            wallet: `${t.wallet.slice(0, 6)}...${t.wallet.slice(-4)}`,
        }));
        res.json({ trades });
    });
    return router;
}
//# sourceMappingURL=dashboard.js.map