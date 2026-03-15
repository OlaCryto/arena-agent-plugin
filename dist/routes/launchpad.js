"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchpadRoutes = launchpadRoutes;
const express_1 = require("express");
const positions_1 = require("../data/positions");
const arenaApi = __importStar(require("../data/arena-api"));
const middleware_1 = require("./middleware");
const tradelog_1 = require("../data/tradelog");
function formatToken(t) {
    return {
        tokenId: t.group_id,
        type: t.lp_paired_with === "ARENA" ? "ARENA-paired" : "AVAX-paired",
        name: t.token_name,
        symbol: t.token_symbol,
        tokenAddress: t.token_contract_address,
        photoUrl: t.photo_url,
        description: t.description?.trim() || null,
        creator: {
            address: t.creator_address,
            handle: t.creator_user_handle,
            photoUrl: t.creator_photo_url,
            twitterFollowers: t.creator_twitter_followers,
            totalTokensCreated: t.creator_total_tokens ?? null,
        },
        price: {
            eth: t.latest_price_eth,
            usd: t.latest_price_usd,
            avaxPrice: t.latest_avax_price,
        },
        volume: {
            totalEth: t.latest_total_volume_eth,
            totalUsd: t.latest_total_volume_usd,
        },
        holders: t.latest_holder_count,
        transactions: t.latest_transaction_count,
        graduationProgress: t.graduation_percentage != null ? `${t.graduation_percentage.toFixed(2)}%` : null,
        graduated: t.lp_deployed,
        supply: t.latest_supply_eth,
        createdAt: t.create_time ? new Date(parseInt(t.create_time) * 1000).toISOString() : null,
        whitelist: t.whitelist_info,
        isOfficial: t.is_official,
        dexPoolId: t.v4_pool_id,
    };
}
function launchpadRoutes(launchpad) {
    const router = (0, express_1.Router)();
    // Discovery
    router.get("/launchpad/recent", middleware_1.requireApiKey, async (req, res) => {
        try {
            const count = Math.min(parseInt(req.query.count) || 10, 50);
            const type = req.query.type || "all";
            const raw = await arenaApi.getRecentTokens(Math.min(count * 2, 50));
            let tokens = raw;
            if (type === "avax")
                tokens = raw.filter(t => t.lp_paired_with === "AVAX");
            else if (type === "arena")
                tokens = raw.filter(t => t.lp_paired_with === "ARENA");
            const result = tokens.slice(0, count).map(formatToken);
            res.json({ count: result.length, tokens: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/search", middleware_1.requireApiKey, async (req, res) => {
        try {
            const q = req.query.q;
            if (!q)
                return res.status(400).json({ error: "?q=<name, symbol, or contract address> required" });
            if (q.startsWith("0x") && q.length === 42) {
                const match = await arenaApi.getTokenByAddress(q);
                if (match) {
                    const stats = await arenaApi.getTokenStats(q).catch(() => null);
                    return res.json({ ...formatToken(match), stats: stats || undefined });
                }
                const result = await launchpad.searchToken(q);
                return res.json(result);
            }
            const results = await arenaApi.searchTokens(q, 20);
            if (results.length === 0)
                return res.status(404).json({ error: `No tokens found matching "${q}"` });
            res.json({ count: results.length, tokens: results.map(formatToken) });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/graduating", middleware_1.requireApiKey, async (req, res) => {
        try {
            const count = Math.min(parseInt(req.query.count) || 5, 20);
            const tokens = await arenaApi.getGraduatingTokens(count);
            res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/graduated", middleware_1.requireApiKey, async (req, res) => {
        try {
            const count = Math.min(parseInt(req.query.count) || 10, 50);
            const tokens = await arenaApi.getGraduatedTokens(count);
            res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/top-volume", middleware_1.requireApiKey, async (req, res) => {
        try {
            const timeframe = req.query.timeframe || "24h";
            if (!["5m", "1h", "4h", "24h", "all_time"].includes(timeframe)) {
                return res.status(400).json({ error: "timeframe must be 5m, 1h, 4h, 24h, or all_time" });
            }
            const count = Math.min(parseInt(req.query.count) || 10, 50);
            const tokens = await arenaApi.getTopVolume(timeframe, count);
            res.json({ count: tokens.length, timeframe, tokens: tokens.map(formatToken) });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Intelligence
    router.get("/launchpad/token", middleware_1.requireApiKey, async (req, res) => {
        try {
            const tokenId = req.query.tokenId;
            const tokenAddress = req.query.address;
            if (!tokenId && !tokenAddress)
                return res.status(400).json({ error: "?tokenId= or ?address= required" });
            let onChainInfo = null;
            if (tokenId) {
                try {
                    onChainInfo = await launchpad.getTokenInfo(tokenId);
                }
                catch { }
            }
            let apiData = null;
            let stats = null;
            const addr = tokenAddress || onChainInfo?.tokenAddress;
            if (addr) {
                const match = await arenaApi.getTokenByAddress(addr).catch(() => null);
                if (match)
                    apiData = formatToken(match);
                stats = await arenaApi.getTokenStats(addr).catch(() => null);
            }
            res.json({
                ...(apiData || {}),
                ...(onChainInfo || {}),
                stats: stats ? {
                    buys: { "5m": stats.buyCount5m, "1h": stats.buyCount1, "4h": stats.buyCount4, "12h": stats.buyCount12, "24h": stats.buyCount24 },
                    sells: { "5m": stats.sellCount5m, "1h": stats.sellCount1, "4h": stats.sellCount4, "12h": stats.sellCount12, "24h": stats.sellCount24 },
                    uniqueBuyers: { "5m": stats.uniqueBuys5m, "1h": stats.uniqueBuys1, "4h": stats.uniqueBuys4, "12h": stats.uniqueBuys12, "24h": stats.uniqueBuys24 },
                    uniqueSellers: { "5m": stats.uniqueSells5m, "1h": stats.uniqueSells1, "4h": stats.uniqueSells4, "12h": stats.uniqueSells12, "24h": stats.uniqueSells24 },
                    volume: { "5m": stats.volume5m, "1h": stats.volume1, "4h": stats.volume4, "12h": stats.volume12, "24h": stats.volume24 },
                    priceChange: { "5m": stats.priceChange5m, "1h": stats.priceChange1, "4h": stats.priceChange4, "12h": stats.priceChange12, "24h": stats.priceChange24 },
                } : undefined,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/quote", middleware_1.requireApiKey, async (req, res) => {
        try {
            const tokenId = req.query.tokenId;
            const side = req.query.side;
            if (!tokenId || !side)
                return res.status(400).json({ error: "?tokenId= and ?side=buy|sell required" });
            const amount = side === "buy" ? req.query.avax : req.query.tokenAmount;
            if (!amount)
                return res.status(400).json({ error: side === "buy" ? "?avax= required for buy" : "?tokenAmount= required for sell" });
            const quote = await launchpad.getTokenQuote(tokenId, amount, side);
            res.json(quote);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/portfolio", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            if (!wallet)
                return res.status(400).json({ error: "?wallet= required" });
            const tokenIds = (0, positions_1.getPositions)(wallet);
            const portfolio = await launchpad.getPortfolio(wallet, tokenIds);
            res.json(portfolio);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/market-cap", middleware_1.requireApiKey, async (req, res) => {
        try {
            const tokenId = req.query.tokenId;
            if (!tokenId)
                return res.status(400).json({ error: "?tokenId= required" });
            const mcap = await launchpad.getMarketCap(tokenId);
            res.json(mcap);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/activity", middleware_1.requireApiKey, async (req, res) => {
        try {
            const tokenId = req.query.tokenId;
            const tokenAddress = req.query.address;
            const count = Math.min(parseInt(req.query.count) || 20, 50);
            if (!tokenId && !tokenAddress)
                return res.status(400).json({ error: "?tokenId= or ?address= required" });
            let addr = tokenAddress;
            if (!addr && tokenId) {
                try {
                    const info = await launchpad.getTokenInfo(tokenId);
                    addr = info.tokenAddress;
                }
                catch { }
            }
            if (addr) {
                try {
                    const trades = await arenaApi.getTokenTrades(addr, count);
                    const formatted = trades.results.map(t => ({
                        type: t.token_eth > 0 ? "buy" : "sell",
                        trader: {
                            address: t.user_address,
                            handle: t.user_handle,
                            name: t.username,
                            photoUrl: t.user_photo_url,
                            twitterFollowers: t.user_twitter_followers,
                        },
                        tokenAmount: Math.abs(t.token_eth),
                        costOrReward: { eth: Math.abs(t.user_eth), usd: Math.abs(t.user_usd) },
                        priceEth: t.price_eth,
                        priceAfterEth: t.price_after_eth,
                        txHash: t.transaction_hash,
                        time: t.create_time ? new Date(parseInt(t.create_time) * 1000).toISOString() : null,
                        traderCurrentBalance: t.current_balance,
                    }));
                    return res.json({ tokenId: tokenId || null, tokenAddress: addr, trades: formatted });
                }
                catch { }
            }
            if (tokenId) {
                const activity = await launchpad.getActivity(tokenId, count);
                return res.json(activity);
            }
            res.status(400).json({ error: "Could not resolve token address" });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/holders", middleware_1.requireApiKey, async (req, res) => {
        try {
            const tokenAddress = req.query.address;
            const tokenId = req.query.tokenId;
            const count = Math.min(parseInt(req.query.count) || 20, 50);
            let addr = tokenAddress;
            if (!addr && tokenId) {
                try {
                    const info = await launchpad.getTokenInfo(tokenId);
                    addr = info.tokenAddress;
                }
                catch { }
            }
            if (!addr)
                return res.status(400).json({ error: "?address= or ?tokenId= required" });
            const holders = await arenaApi.getTokenHolders(addr, count);
            const formatted = holders.map(h => ({
                rank: parseInt(h.rank),
                address: h.user_address,
                handle: h.user_handle,
                name: h.username,
                photoUrl: h.user_photo_url,
                twitterFollowers: h.twitter_followers,
                balance: h.current_balance,
                unrealizedPnl: { eth: h.unrealized_pnl_eth, usd: h.unrealized_pnl_usd },
                realizedPnl: { eth: h.realized_pnl_eth, usd: h.realized_pnl_usd },
                buys: parseInt(h.buy_count),
                sells: parseInt(h.sell_count),
            }));
            res.json({ tokenAddress: addr, holders: formatted });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/overview", middleware_1.requireApiKey, async (req, res) => {
        try {
            const overview = await launchpad.getOverview();
            res.json(overview);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/trades", middleware_1.requireApiKey, async (req, res) => {
        try {
            const count = Math.min(parseInt(req.query.count) || 50, 100);
            const offset = parseInt(req.query.offset) || 0;
            const trades = await arenaApi.getGlobalTrades(count, offset);
            const formatted = trades.results.map(t => ({
                type: t.token_eth > 0 ? "buy" : "sell",
                token: {
                    name: t.token_name,
                    symbol: t.token_symbol,
                    address: t.token_contract_address,
                    photoUrl: t.photo_url,
                    tokenId: t.token_id,
                },
                trader: {
                    address: t.user_address,
                    handle: t.user_handle,
                    name: t.username,
                    photoUrl: t.user_photo_url,
                    twitterFollowers: t.user_twitter_followers,
                },
                tokenAmount: Math.abs(t.token_eth),
                value: { eth: Math.abs(t.user_eth), usd: Math.abs(t.user_usd) },
                priceEth: t.price_eth,
                txHash: t.transaction_hash,
                time: t.create_time ? new Date(parseInt(t.create_time) * 1000).toISOString() : null,
            }));
            res.json({ count: formatted.length, offset, trades: formatted });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Trading
    router.get("/launchpad/build/buy", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const tokenId = req.query.tokenId;
            const avax = req.query.avax;
            const slippage = req.query.slippage;
            if (!wallet || !tokenId || !avax)
                return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?avax= required" });
            const result = await launchpad.buildLaunchpadBuyTx(wallet, tokenId, avax, slippage ? Number(slippage) : undefined);
            (0, positions_1.trackPosition)(wallet, Number(tokenId));
            (0, tradelog_1.logTrade)(req.get("X-API-Key") || "unknown", wallet, "launchpad-buy", `Buy tokenId ${tokenId} with ${avax} AVAX`, "launchpad");
            // Graduated tokens return a DexModule response
            if ("graduated" in result) {
                const { graduated, transactions, summary } = result;
                res.json({ graduated, transactions, summary, note: "This token has graduated from the bonding curve and now trades on Pharaoh DEX." });
            }
            else {
                res.json(result);
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get("/launchpad/build/sell", middleware_1.requireApiKey, async (req, res) => {
        try {
            const wallet = req.query.wallet;
            const tokenId = req.query.tokenId;
            const amount = req.query.amount;
            const slippage = req.query.slippage;
            if (!wallet || !tokenId || !amount)
                return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?amount= required" });
            const result = await launchpad.buildLaunchpadSellTx(wallet, tokenId, amount, slippage ? Number(slippage) : undefined);
            if (amount === "max")
                (0, positions_1.removePosition)(wallet, Number(tokenId));
            (0, tradelog_1.logTrade)(req.get("X-API-Key") || "unknown", wallet, "launchpad-sell", `Sell tokenId ${tokenId} amount ${amount}`, "launchpad");
            // Graduated tokens return a DexModule response
            if ("graduated" in result) {
                const { graduated, transactions, summary } = result;
                res.json({ graduated, transactions, summary, note: "This token has graduated from the bonding curve and now trades on Pharaoh DEX." });
            }
            else {
                res.json({ transactions: result });
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=launchpad.js.map