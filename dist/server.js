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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const txbuilder_1 = require("./txbuilder");
const apikeys_1 = require("./apikeys");
const positions_1 = require("./positions");
const arenaApi = __importStar(require("./arena-api"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = parseInt(process.env.PORT || "3000");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-me";
const builder = new txbuilder_1.TxBuilder();
// --- API Key Middleware ---
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"];
    if (!key || !(0, apikeys_1.validateApiKey)(key)) {
        res.status(401).json({ error: "Invalid or missing API key. Pass X-API-Key header." });
        return;
    }
    next();
}
function requireAdmin(req, res, next) {
    const secret = req.headers["x-admin-secret"];
    if (secret !== ADMIN_SECRET) {
        res.status(403).json({ error: "Invalid admin secret." });
        return;
    }
    next();
}
// === ADMIN ENDPOINTS (manage API keys) ===
app.all("/admin/keys/create", requireAdmin, (req, res) => {
    const name = req.body?.name || req.query.name;
    if (!name)
        return res.status(400).json({ error: "name is required (?name=)" });
    const key = (0, apikeys_1.generateApiKey)(name);
    res.json({ key, name, message: "Store this key — it won't be shown again." });
});
app.get("/admin/keys", requireAdmin, (_req, res) => {
    res.json((0, apikeys_1.listApiKeys)());
});
app.all("/admin/keys/revoke", requireAdmin, (req, res) => {
    const name = req.body?.name || req.query.name;
    if (!name)
        return res.status(400).json({ error: "name is required (?name=)" });
    const revoked = (0, apikeys_1.revokeApiKey)(name);
    res.json({ revoked, name });
});
// === PUBLIC ENDPOINTS ===
// Self-registration: agent provides its wallet address, gets an API key
app.get("/register", (req, res) => {
    const wallet = req.query.wallet;
    const name = req.query.name || wallet;
    if (!wallet)
        return res.status(400).json({ error: "?wallet=<your-wallet-address> required" });
    const key = (0, apikeys_1.generateApiKey)(name, wallet);
    res.json({ key, name, wallet, message: "Save this API key. It works for ALL Arena endpoints — staking, launchpad trading, everything. Include it as X-API-Key header in all requests." });
});
app.get("/agent-instructions", (req, res) => {
    const base = `https://${req.get("host")}`;
    res.type("text/plain").send(`# You are an Arena Staking Agent

You are connected to the Arena ecosystem on Avalanche. Arena (arenatrade.ai) is a SocialFi platform. ARENA is the native token — staking it makes you an "Arena Champion" and earns you 2.5% of every token that graduates from Arena's bonding curve launchpad. This is passive income from the entire platform's activity.

## How to Authenticate

Every request needs your API key: \`X-API-Key: <your-key>\`
Register once: GET ${base}/register?wallet=<your-wallet>&name=<your-name>
Base URL: ${base}

---

## What You Can Do

### Check your wallet
GET /balances?wallet=<address>
  Returns your AVAX and ARENA balances.

### Buy ARENA
GET /quote?avax=<amount>
  Preview: see how much ARENA you'll get for X AVAX (includes 0.3% service fee breakdown).

GET /build/buy?wallet=<address>&avax=<amount>&slippage=<bps>
  Build unsigned buy tx. Slippage default: 500 (5%).
  Returns: { to, data, value, chainId, gas, gasLimit, description }

### Stake ARENA
Staking locks your ARENA and earns you 2.5% of every token graduation on the platform.

GET /stake/info?wallet=<address>
  Check your staked amount and pending rewards.

GET /build/stake?wallet=<address>&amount=<amount|max>
  Build 2 unsigned txs: approve + deposit. Execute in order.

GET /build/buy-and-stake?wallet=<address>&avax=<amount>
  Buy ARENA and stake in one flow. Returns 3 txs: buy, approve, stake.

GET /build/unstake?wallet=<address>&amount=<amount|max>
  Withdraw staked ARENA + claim any pending rewards.

### Execute transactions
POST /broadcast { "signedTx": "0x..." }
  Broadcast any signed transaction.

---

## How to Buy and Stake (step by step)

1. Check balance: GET /balances?wallet=<your-wallet>
2. Get a quote: GET /quote?avax=<amount>
3. Build: GET /build/buy-and-stake?wallet=<your-wallet>&avax=<amount>
4. You'll get 3 transactions back. For EACH one, in order:
   a. Sign it with your private key
   b. POST /broadcast { "signedTx": "0x..." }
   c. Wait for confirmation before sending the next
5. Verify: GET /stake/info?wallet=<your-wallet>

---

## Critical Rules

- All txs are on Avalanche C-Chain (chainId: 43114)
- ALWAYS use the gasLimit from the response (500000 for buy, 60000 for approve) — DO NOT use your wallet's default gas estimate or the tx WILL revert and waste your gas fee
- Multi-tx operations (buy-and-stake = 3 txs, stake = 2 txs): execute IN ORDER, wait for each to confirm
- A 0.3% service fee applies on ARENA buys. Staking/unstaking is free.
- Use "max" to stake or unstake your entire balance
- ARENA token address: 0xB8d7710f7d8349A506b75dD184F05777c82dAd0C
- Your private key never leaves your wallet — this API only builds unsigned transactions
`);
});
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        router: builder.routerAddress || "not deployed yet",
        fee: "0.3%",
    });
});
// === AUTHENTICATED ENDPOINTS (require API key) ===
// Get balances for a wallet
app.get("/balances", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        if (!wallet)
            return res.status(400).json({ error: "?wallet= required" });
        const result = await builder.getBalances(wallet);
        res.json({ ...result, wallet });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get staking info
app.get("/stake/info", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        if (!wallet)
            return res.status(400).json({ error: "?wallet= required" });
        const result = await builder.getStakeInfo(wallet);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get quote (includes fee breakdown)
app.get("/quote", requireApiKey, async (req, res) => {
    try {
        const avax = req.query.avax;
        if (!avax)
            return res.status(400).json({ error: "?avax= required" });
        const result = await builder.getQuote(avax);
        res.json({ avaxIn: avax, ...result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Build unsigned tx: buy ARENA
app.get("/build/buy", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const avax = req.query.avax;
        const slippage = req.query.slippage;
        if (!wallet || !avax)
            return res.status(400).json({ error: "?wallet= and ?avax= required" });
        const tx = await builder.buildBuyTx(wallet, avax, slippage ? Number(slippage) : undefined);
        res.json(tx);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Build unsigned txs: stake ARENA (approve + deposit)
app.get("/build/stake", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const amount = req.query.amount;
        if (!wallet || !amount)
            return res.status(400).json({ error: "?wallet= and ?amount= required" });
        const approveTx = await builder.buildApproveStakingTx(wallet, amount);
        const stakeTx = await builder.buildStakeTx(wallet, amount);
        res.json({ transactions: [approveTx, stakeTx] });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Build unsigned txs: buy + stake (3 txs)
app.get("/build/buy-and-stake", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const avax = req.query.avax;
        const slippage = req.query.slippage;
        if (!wallet || !avax)
            return res.status(400).json({ error: "?wallet= and ?avax= required" });
        const txs = await builder.buildBuyAndStakeTxs(wallet, avax, slippage ? Number(slippage) : undefined);
        res.json({ transactions: txs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Build unsigned tx: unstake
app.get("/build/unstake", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const amount = req.query.amount;
        if (!wallet || !amount)
            return res.status(400).json({ error: "?wallet= and ?amount= required" });
        const tx = await builder.buildUnstakeTx(wallet, amount);
        res.json(tx);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Broadcast a signed transaction
app.post("/broadcast", requireApiKey, async (req, res) => {
    try {
        const { signedTx } = req.body;
        if (!signedTx)
            return res.status(400).json({ error: "signedTx is required in body" });
        const txHash = await builder.broadcast(signedTx);
        res.json({ txHash });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// === LAUNCHPAD ENDPOINTS ===
// Launchpad agent instructions (separate from staking instructions)
app.get("/launchpad/agent-instructions", (req, res) => {
    const base = `https://${req.get("host")}`;
    res.type("text/plain").send(`# You are an Arena Launchpad Trading Agent

You are connected to Arena's token launchpad (arenatrade.ai) on Avalanche. This is a bonding curve platform where anyone can launch tokens. Over 112,000 tokens have been created.

## How Arena's Launchpad Works

Tokens start on a bonding curve — price starts low and rises as people buy. Each token has 10 billion total supply, with 73% available for purchase and 27% reserved for liquidity. When the curve fills (all purchasable tokens are bought), the token "graduates" — liquidity is automatically deployed to a DEX and the token trades freely on-chain.

## IMPORTANT: Two Token Types — Know the Difference

Every token on Arena is one of two types. This matters because they use different contracts:

**AVAX-paired tokens** (the vast majority, ~112,000+):
- tokenId is a small number (under 100 billion)
- Traded directly through the Launch Contract (0x8315f1eb449Dd4B779495C3A0b05e5d194446c6e)
- You pay AVAX, you get tokens. You sell tokens, you get AVAX.

**ARENA-paired tokens** (a small minority, ~3,700):
- tokenId is a very large number (100 billion or higher, e.g. 100000000001)
- Traded through the AVAX Helper Contract (0x03f1A18519aBeDbEf210FA44e13b71fec01b8dFa) which auto-converts AVAX↔ARENA
- You still pay in AVAX, but behind the scenes it routes through ARENA

**How to tell them apart:** The API response for every token includes a "type" field — either "AVAX-paired" or "ARENA-paired". You can also check the tokenId: under 100 billion = AVAX-paired, 100 billion or above = ARENA-paired.

**You do NOT need to handle the routing yourself.** When you call /launchpad/build/buy or /launchpad/build/sell, the API auto-detects the type and builds the correct transaction for the correct contract. Just pass the tokenId and the API handles everything. But you should understand the difference so you can verify the transaction data makes sense before signing.

## Authentication
\`X-API-Key: <your-key>\` header on every request.
If you already have an API key from the Arena staking plugin, use that same key — it works for everything.
If not, register: GET ${base}/register?wallet=<your-wallet>&name=<your-name>
Base: ${base}

---

## 1. Discover — Find tokens worth looking at

| Goal | Endpoint |
|------|----------|
| What just launched | GET /launchpad/recent?count=10&type=all\|avax\|arena |
| What's trending NOW | GET /launchpad/top-volume?timeframe=5m&count=10 |
| What's about to graduate | GET /launchpad/graduating?count=5 |
| What already graduated | GET /launchpad/graduated?count=10 |
| Find by name/symbol | GET /launchpad/search?q=<name> |
| Find by contract address | GET /launchpad/search?q=0x... (instant exact match) |
| Platform stats | GET /launchpad/overview |

Each token in the response includes: name, symbol, price (ETH + USD), volume, holders, graduation progress, creator profile (handle, photo, twitter followers), description, and more.

**Volume timeframes:** 5m, 1h, 4h, 24h, all_time — use shorter timeframes to spot what's moving right now.

---

## 2. Research — Decide if it's worth trading

| Goal | Endpoint |
|------|----------|
| Full token deep-dive | GET /launchpad/token?tokenId=<id> |
| Market cap breakdown | GET /launchpad/market-cap?tokenId=<id> |
| Who's buying/selling | GET /launchpad/activity?tokenId=<id>&count=20 |
| Who holds it + their PnL | GET /launchpad/holders?address=<contract-addr>&count=20 |
| All trades platform-wide | GET /launchpad/trades?count=50 |
| Buy/sell price quote | GET /launchpad/quote?tokenId=<id>&avax=0.5&side=buy |

### What to look for:

**Token profile** (/launchpad/token) returns everything: price, mcap, graduation %, creator info, and buy/sell stats across 5m/1h/4h/12h/24h — buy counts, sell counts, unique buyers/sellers, volume, and price changes for each window.

**Holders** (/launchpad/holders) — if 2-3 wallets hold most of the supply, they can dump. Spread across many holders is healthier.

**Activity** (/launchpad/activity) — are people actively buying or is it dead? Are big wallets accumulating?

**Trades feed** (/launchpad/trades) without filters shows everything across all tokens. Add ?token=<addr> to filter by token, or ?user=<addr> to stalk a specific trader.

### Red flags:
- Creator has 0 twitter followers and 50+ tokens created → serial launcher, probably rugs
- 1 holder has 40%+ of supply → whale can dump anytime
- High sell count but low buy count in last 1h → momentum dying
- Token already graduated (lpDeployed=true) → can't trade here, it's on DEX now

### Good signs:
- Graduating token with accelerating buy volume
- Creator has real twitter presence and this is their first/second token
- Many unique buyers, spread holder distribution
- Price up across all timeframes with increasing volume

---

## 3. Trade — Execute

**Buy a token:**
\`\`\`
1. GET /launchpad/quote?tokenId=<id>&avax=0.5&side=buy    → preview
2. GET /launchpad/build/buy?wallet=<addr>&tokenId=<id>&avax=0.5  → unsigned tx
3. Sign with your private key
4. POST /broadcast { "signedTx": "0x..." }                → execute
\`\`\`

**Sell a token:**
\`\`\`
1. GET /launchpad/build/sell?wallet=<addr>&tokenId=<id>&amount=max  → 2 unsigned txs
2. Sign approve tx → POST /broadcast → WAIT for confirmation
3. Sign sell tx → POST /broadcast                          → done
\`\`\`

**Check your positions:**
GET /launchpad/portfolio?wallet=<addr> — every token you bought through this API, with current value and PnL.

---

## Critical Rules

1. **Gas limit** — ALWAYS use the gasLimit from the response (500000 for trades, 60000 for approve). Never use your wallet's default estimate — it WILL revert and waste gas.
2. **Sell is 2 transactions** — approve first, wait for it to confirm, then sell. Always in order.
3. **Graduated tokens can't be traded here** — if lpDeployed=true, the token moved to DEX.
4. **Token amounts are tiny fractions** — seeing 0.000001 tokens for 0.1 AVAX is normal. The bonding curve is steep by design.
5. **No fees on launchpad trades** — the protocol takes its own fee, we add nothing.
6. **chainId: 43114** — everything is on Avalanche C-Chain.
7. **Your keys stay with you** — this API only builds unsigned transactions. You sign them.
`);
});
// Helper: format Arena API token data for consistent response
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
// Discovery endpoints
app.get("/launchpad/recent", requireApiKey, async (req, res) => {
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
app.get("/launchpad/search", requireApiKey, async (req, res) => {
    try {
        const q = req.query.q;
        if (!q)
            return res.status(400).json({ error: "?q=<name, symbol, or contract address> required" });
        // If it looks like an address (0x...), search by contract address (fast direct lookup)
        if (q.startsWith("0x") && q.length === 42) {
            const match = await arenaApi.getTokenByAddress(q);
            if (match) {
                const stats = await arenaApi.getTokenStats(q).catch(() => null);
                return res.json({ ...formatToken(match), stats: stats || undefined });
            }
            // Fallback to on-chain search
            const result = await builder.searchToken(q);
            return res.json(result);
        }
        // Otherwise search by name/symbol via Arena API
        const results = await arenaApi.searchTokens(q, 20);
        if (results.length === 0)
            return res.status(404).json({ error: `No tokens found matching "${q}"` });
        res.json({ count: results.length, tokens: results.map(formatToken) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/graduating", requireApiKey, async (req, res) => {
    try {
        const count = Math.min(parseInt(req.query.count) || 5, 20);
        const tokens = await arenaApi.getGraduatingTokens(count);
        res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/graduated", requireApiKey, async (req, res) => {
    try {
        const count = Math.min(parseInt(req.query.count) || 10, 50);
        const tokens = await arenaApi.getGraduatedTokens(count);
        res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/top-volume", requireApiKey, async (req, res) => {
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
// Intelligence endpoints
app.get("/launchpad/token", requireApiKey, async (req, res) => {
    try {
        const tokenId = req.query.tokenId;
        const tokenAddress = req.query.address;
        if (!tokenId && !tokenAddress)
            return res.status(400).json({ error: "?tokenId= or ?address= required" });
        // Get on-chain data (for accurate price/curve data)
        let onChainInfo = null;
        if (tokenId) {
            try {
                onChainInfo = await builder.getTokenInfo(tokenId);
            }
            catch { }
        }
        // Get rich data from Arena API (fast direct lookup by address)
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
app.get("/launchpad/quote", requireApiKey, async (req, res) => {
    try {
        const tokenId = req.query.tokenId;
        const side = req.query.side;
        if (!tokenId || !side)
            return res.status(400).json({ error: "?tokenId= and ?side=buy|sell required" });
        const amount = side === "buy" ? req.query.avax : req.query.tokenAmount;
        if (!amount)
            return res.status(400).json({ error: side === "buy" ? "?avax= required for buy" : "?tokenAmount= required for sell" });
        const quote = await builder.getTokenQuote(tokenId, amount, side);
        res.json(quote);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/portfolio", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        if (!wallet)
            return res.status(400).json({ error: "?wallet= required" });
        const tokenIds = (0, positions_1.getPositions)(wallet);
        const portfolio = await builder.getPortfolio(wallet, tokenIds);
        res.json(portfolio);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/market-cap", requireApiKey, async (req, res) => {
    try {
        const tokenId = req.query.tokenId;
        if (!tokenId)
            return res.status(400).json({ error: "?tokenId= required" });
        const mcap = await builder.getMarketCap(tokenId);
        res.json(mcap);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/activity", requireApiKey, async (req, res) => {
    try {
        const tokenId = req.query.tokenId;
        const tokenAddress = req.query.address;
        const count = Math.min(parseInt(req.query.count) || 20, 50);
        if (!tokenId && !tokenAddress)
            return res.status(400).json({ error: "?tokenId= or ?address= required" });
        // If we have tokenAddress, use Arena API for rich trade data
        let addr = tokenAddress;
        if (!addr && tokenId) {
            try {
                const info = await builder.getTokenInfo(tokenId);
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
                    costOrReward: {
                        eth: Math.abs(t.user_eth),
                        usd: Math.abs(t.user_usd),
                    },
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
        // Fallback to on-chain events
        if (tokenId) {
            const activity = await builder.getActivity(tokenId, count);
            return res.json(activity);
        }
        res.status(400).json({ error: "Could not resolve token address" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Holders endpoint (new — powered by Arena API)
app.get("/launchpad/holders", requireApiKey, async (req, res) => {
    try {
        const tokenAddress = req.query.address;
        const tokenId = req.query.tokenId;
        const count = Math.min(parseInt(req.query.count) || 20, 50);
        let addr = tokenAddress;
        if (!addr && tokenId) {
            try {
                const info = await builder.getTokenInfo(tokenId);
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
app.get("/launchpad/overview", requireApiKey, async (req, res) => {
    try {
        const overview = await builder.getOverview();
        res.json(overview);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Global trades feed — all trades across all tokens
app.get("/launchpad/trades", requireApiKey, async (req, res) => {
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
            value: {
                eth: Math.abs(t.user_eth),
                usd: Math.abs(t.user_usd),
            },
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
// Trading endpoints
app.get("/launchpad/build/buy", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const tokenId = req.query.tokenId;
        const avax = req.query.avax;
        const slippage = req.query.slippage;
        if (!wallet || !tokenId || !avax)
            return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?avax= required" });
        const tx = await builder.buildLaunchpadBuyTx(wallet, tokenId, avax, slippage ? Number(slippage) : undefined);
        // Track position for portfolio
        (0, positions_1.trackPosition)(wallet, Number(tokenId));
        res.json(tx);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get("/launchpad/build/sell", requireApiKey, async (req, res) => {
    try {
        const wallet = req.query.wallet;
        const tokenId = req.query.tokenId;
        const amount = req.query.amount;
        const slippage = req.query.slippage;
        if (!wallet || !tokenId || !amount)
            return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?amount= required" });
        const txs = await builder.buildLaunchpadSellTx(wallet, tokenId, amount, slippage ? Number(slippage) : undefined);
        // If selling max, remove position tracking
        if (amount === "max")
            (0, positions_1.removePosition)(wallet, Number(tokenId));
        res.json({ transactions: txs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.listen(PORT, () => {
    console.log(`Arena Agent Plugin running on port ${PORT}`);
    console.log(`Fee: 0.3% on buys via ArenaRouter`);
    console.log(`Router: ${builder.routerAddress || "NOT SET — deploy contract and set ARENA_ROUTER env var"}`);
    console.log(`\nAdmin endpoints (X-Admin-Secret header):`);
    console.log(`  POST   /admin/keys    - Generate API key`);
    console.log(`  GET    /admin/keys    - List API keys`);
    console.log(`  DELETE /admin/keys    - Revoke API key`);
    console.log(`\nAgent endpoints (X-API-Key header):`);
    console.log(`  GET  /balances?wallet=0x...          - Wallet balances`);
    console.log(`  GET  /quote?avax=0.1                 - Price quote`);
    console.log(`  GET  /stake/info?wallet=0x...        - Staking position`);
    console.log(`  GET  /build/buy?wallet=...&avax=0.1  - Build buy tx`);
    console.log(`  GET  /build/stake?wallet=...&amount= - Build stake txs`);
    console.log(`  GET  /build/buy-and-stake?wallet=... - Build buy+stake txs`);
    console.log(`  GET  /build/unstake?wallet=...       - Build unstake tx`);
    console.log(`  POST /broadcast                      - Broadcast signed tx`);
});
//# sourceMappingURL=server.js.map