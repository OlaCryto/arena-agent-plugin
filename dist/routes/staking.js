"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stakingRoutes = stakingRoutes;
const express_1 = require("express");
const middleware_1 = require("./middleware");
function stakingRoutes(staking, swap) {
    const router = (0, express_1.Router)();
    router.get("/stake/info", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            if (!wallet)
                return res.status(400).json({ error: "?wallet= required" });
            const result = await staking.getStakeInfo(wallet);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/build/stake", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const amount = req.query.amount;
            if (!wallet || !amount)
                return res.status(400).json({ error: "?wallet= and ?amount= required" });
            const approveTx = await staking.buildApproveStakingTx(wallet, amount);
            const stakeTx = await staking.buildStakeTx(wallet, amount);
            res.json({ transactions: [approveTx, stakeTx] });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/build/buy-and-stake", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const avax = req.query.avax;
            const slippage = req.query.slippage;
            if (!wallet || !avax)
                return res.status(400).json({ error: "?wallet= and ?avax= required" });
            const slippageBps = (0, middleware_1.parseSlippageBps)(slippage);
            if (Number.isNaN(slippageBps))
                return res.status(400).json({ error: "?slippage= must be an integer between 1 and 5000 (bps)" });
            const txs = await staking.buildBuyAndStakeTxs(wallet, avax, slippageBps);
            res.json({ transactions: txs });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/build/unstake", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const amount = req.query.amount;
            if (!wallet || !amount)
                return res.status(400).json({ error: "?wallet= and ?amount= required" });
            const tx = await staking.buildUnstakeTx(wallet, amount);
            res.json(tx);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=staking.js.map