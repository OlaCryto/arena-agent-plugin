"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapRoutes = swapRoutes;
const express_1 = require("express");
const provider_1 = require("../core/provider");
const middleware_1 = require("./middleware");
function swapRoutes(swap, provider) {
    const router = (0, express_1.Router)();
    router.get("/balances", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            if (!wallet)
                return res.status(400).json({ error: "?wallet= required" });
            const result = await swap.getBalances(wallet);
            res.json({ ...result, wallet });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/quote", middleware_1.requireApiKey, async (req, res) => {
        try {
            const avax = req.query.avax;
            if (!avax)
                return res.status(400).json({ error: "?avax= required" });
            const result = await swap.getQuote(avax);
            res.json({ avaxIn: avax, ...result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/quote/sell", middleware_1.requireApiKey, async (req, res) => {
        try {
            const arena = req.query.arena;
            if (!arena)
                return res.status(400).json({ error: "?arena=<amount> required" });
            const result = await swap.getSellQuote(arena);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/build/buy", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const avax = req.query.avax;
            const slippage = req.query.slippage;
            if (!wallet || !avax)
                return res.status(400).json({ error: "?wallet= and ?avax= required" });
            const slippageBps = (0, middleware_1.parseSlippageBps)(slippage);
            if (Number.isNaN(slippageBps))
                return res.status(400).json({ error: "?slippage= must be an integer between 1 and 5000 (bps)" });
            const tx = await swap.buildBuyTx(wallet, avax, slippageBps);
            res.json(tx);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/build/sell-arena", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const amount = req.query.amount;
            const slippage = req.query.slippage;
            if (!wallet || !amount)
                return res.status(400).json({ error: "?wallet= and ?amount= required (use 'max' to sell all)" });
            const slippageBps = (0, middleware_1.parseSlippageBps)(slippage);
            if (Number.isNaN(slippageBps))
                return res.status(400).json({ error: "?slippage= must be an integer between 1 and 5000 (bps)" });
            const txs = await swap.buildSellArenaTx(wallet, amount, slippageBps);
            res.json({ transactions: txs });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post("/broadcast", middleware_1.requireApiKey, async (req, res) => {
        try {
            const { signedTx } = req.body;
            if (!signedTx)
                return res.status(400).json({ error: "signedTx is required in body" });
            const txHash = await (0, provider_1.broadcast)(provider, signedTx);
            res.json({ txHash });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=swap.js.map