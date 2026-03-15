"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dexRoutes = dexRoutes;
const express_1 = require("express");
const middleware_1 = require("./middleware");
const tradelog_1 = require("../data/tradelog");
function dexRoutes(dex) {
    const router = (0, express_1.Router)();
    /** List all known tokens with addresses and decimals */
    router.get("/dex/tokens", middleware_1.requireApiKey, (_req, res) => {
        try {
            const tokens = dex.getTokenList();
            res.json({ tokens, note: "You can also pass any contract address (0x...) directly — not limited to this list." });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /** Get on-chain info for any token address */
    router.get("/dex/token-info", middleware_1.requireApiKey, async (req, res) => {
        try {
            const address = req.query.address;
            if (!address)
                return res.status(400).json({ error: "?address=0x... required" });
            const info = await dex.getTokenInfo(address);
            res.json(info);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /** Quote any token pair */
    router.get("/dex/quote", middleware_1.requireApiKey, async (req, res) => {
        try {
            const from = req.query.from;
            const to = req.query.to;
            const amount = req.query.amount;
            if (!from || !to || !amount) {
                return res.status(400).json({ error: "?from=<symbol|address>&to=<symbol|address>&amount=<number> required" });
            }
            const result = await dex.getQuote(from, to, amount);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /** Get balance of any token */
    router.get("/dex/balance", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const token = req.query.token;
            if (!wallet || !token) {
                return res.status(400).json({ error: "?wallet=<address>&token=<symbol|address> required" });
            }
            const result = await dex.getBalance(wallet, token);
            res.json({ wallet, ...result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    /** Build unsigned swap tx(s) for any pair */
    router.get("/dex/build/swap", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const from = req.query.from;
            const to = req.query.to;
            const amount = req.query.amount;
            const slippage = req.query.slippage;
            if (!wallet || !from || !to || !amount) {
                return res.status(400).json({
                    error: "?wallet=<address>&from=<symbol|address>&to=<symbol|address>&amount=<number|max> required",
                });
            }
            const result = await dex.buildSwapTx(wallet, from, to, amount, slippage ? Number(slippage) : undefined);
            (0, tradelog_1.logTrade)(req.get("X-API-Key") || "unknown", wallet, "dex-swap", `${amount} ${from} → ${to}`, "dex");
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=dex.js.map