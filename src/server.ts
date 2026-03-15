import express, { Request, Response, NextFunction } from "express";
import { TxBuilder } from "./txbuilder";
import { generateApiKey, validateApiKey, listApiKeys, revokeApiKey } from "./apikeys";
import { trackPosition, removePosition, getPositions } from "./positions";
import * as arenaApi from "./arena-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-me";

const builder = new TxBuilder();

// --- API Key Middleware ---
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string;
  if (!key || !validateApiKey(key)) {
    res.status(401).json({ error: "Invalid or missing API key. Pass X-API-Key header." });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] as string;
  if (secret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Invalid admin secret." });
    return;
  }
  next();
}

// === ADMIN ENDPOINTS (manage API keys) ===

app.all("/admin/keys/create", requireAdmin, (req, res) => {
  const name = req.body?.name || req.query.name as string;
  if (!name) return res.status(400).json({ error: "name is required (?name=)" });
  const key = generateApiKey(name);
  res.json({ key, name, message: "Store this key — it won't be shown again." });
});

app.get("/admin/keys", requireAdmin, (_req, res) => {
  res.json(listApiKeys());
});

app.all("/admin/keys/revoke", requireAdmin, (req, res) => {
  const name = req.body?.name || req.query.name as string;
  if (!name) return res.status(400).json({ error: "name is required (?name=)" });
  const revoked = revokeApiKey(name);
  res.json({ revoked, name });
});

// === PUBLIC ENDPOINTS ===

// Self-registration: agent provides its wallet address, gets an API key
app.get("/register", (req, res) => {
  const wallet = req.query.wallet as string;
  const name = req.query.name as string || wallet;
  if (!wallet) return res.status(400).json({ error: "?wallet=<your-wallet-address> required" });
  const key = generateApiKey(name);
  res.json({ key, name, wallet, message: "Save this API key — it won't be shown again. Include it as X-API-Key header in all future requests." });
});

app.get("/agent-instructions", (req, res) => {
  const base = `https://${req.get("host")}`;
  res.type("text/plain").send(`# Arena Plugin — Agent Instructions

You have access to the Arena Plugin API for buying and staking ARENA tokens on the Avalanche blockchain. ARENA is the native token of The Arena (arena.social), a SocialFi platform. Staking ARENA makes you an "Arena Champion" — you earn 2.5% of every token that graduates from Arena's bonding curve launchpad.

## Quick Start

1. Register once: GET ${base}/register?wallet=<your-wallet-address>&name=<your-agent-name>
2. Save the API key from the response
3. Include "X-API-Key: <your-key>" header in ALL subsequent requests

## Base URL
${base}

## Endpoints

### Read-Only (no transaction needed)

GET /balances?wallet=<address>
  Returns: { avax, arena, wallet }
  Check AVAX and ARENA token balances for any wallet.

GET /quote?avax=<amount>
  Returns: { avaxIn, arenaOut, fee, netAvax }
  Get a price quote before buying. Shows the 0.3% service fee breakdown.

GET /stake/info?wallet=<address>
  Returns: { stakedAmount, pendingRewards }
  Check how much ARENA is staked and any pending rewards.

### Build Transactions (returns unsigned tx data for you to sign)

GET /build/buy?wallet=<address>&avax=<amount>&slippage=<bps>
  Returns: { to, data, value, chainId, gas, gasLimit, description }
  Builds an unsigned transaction to buy ARENA with AVAX.
  - avax: AVAX amount to spend (e.g. "0.1")
  - slippage: optional, basis points (default 500 = 5%)

GET /build/stake?wallet=<address>&amount=<amount>
  Returns: { transactions: [approveTx, stakeTx] }
  Builds 2 unsigned transactions: approve ARENA + deposit into staking.
  - amount: ARENA to stake, or "max" for entire balance

GET /build/buy-and-stake?wallet=<address>&avax=<amount>&slippage=<bps>
  Returns: { transactions: [buyTx, approveTx, stakeTx] }
  Builds 3 unsigned transactions to buy ARENA and stake in one flow.

GET /build/unstake?wallet=<address>&amount=<amount>
  Returns: { to, data, value, chainId, description }
  Builds an unsigned transaction to withdraw staked ARENA + claim rewards.
  - amount: ARENA to unstake, or "max" for all

### Broadcast

POST /broadcast
  Body: { "signedTx": "<signed transaction hex>" }
  Returns: { txHash }
  Broadcasts a signed transaction to Avalanche C-Chain.

## Workflow

1. Check balance: GET /balances?wallet=<your-wallet>
2. Get a quote: GET /quote?avax=<amount>
3. Build transaction(s): GET /build/buy, /build/stake, /build/buy-and-stake, or /build/unstake
4. Sign each transaction with your wallet private key
5. Broadcast each signed tx: POST /broadcast { "signedTx": "0x..." }
6. Wait for each tx to confirm before sending the next one
7. Verify: GET /balances or /stake/info

## CRITICAL — Gas Limit for Buy Transactions

When signing buy transactions (from /build/buy or /build/buy-and-stake), you MUST use the gasLimit provided in the response (500000). Do NOT use your wallet's default gas estimate — DEX swaps require more gas than estimators predict, and too-low gas WILL cause the transaction to revert and waste your gas fee.

## Important Notes
- All transactions are on Avalanche C-Chain (chainId: 43114)
- A 0.3% service fee is applied on buy transactions
- When you get multiple transactions (buy-and-stake returns 3), execute them IN ORDER and wait for each to confirm before sending the next
- Use "max" as amount to stake/unstake your entire balance
- The ARENA token address is 0xB8d7710f7d8349A506b75dD184F05777c82dAd0C
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
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: "?wallet= required" });
    const result = await builder.getBalances(wallet);
    res.json({ ...result, wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get staking info
app.get("/stake/info", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: "?wallet= required" });
    const result = await builder.getStakeInfo(wallet);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get quote (includes fee breakdown)
app.get("/quote", requireApiKey, async (req, res) => {
  try {
    const avax = req.query.avax as string;
    if (!avax) return res.status(400).json({ error: "?avax= required" });
    const result = await builder.getQuote(avax);
    res.json({ avaxIn: avax, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned tx: buy ARENA
app.get("/build/buy", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const avax = req.query.avax as string;
    const slippage = req.query.slippage as string;
    if (!wallet || !avax) return res.status(400).json({ error: "?wallet= and ?avax= required" });
    const tx = await builder.buildBuyTx(wallet, avax, slippage ? Number(slippage) : undefined);
    res.json(tx);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned txs: stake ARENA (approve + deposit)
app.get("/build/stake", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const amount = req.query.amount as string;
    if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required" });
    const approveTx = await builder.buildApproveStakingTx(wallet, amount);
    const stakeTx = await builder.buildStakeTx(wallet, amount);
    res.json({ transactions: [approveTx, stakeTx] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned txs: buy + stake (3 txs)
app.get("/build/buy-and-stake", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const avax = req.query.avax as string;
    const slippage = req.query.slippage as string;
    if (!wallet || !avax) return res.status(400).json({ error: "?wallet= and ?avax= required" });
    const txs = await builder.buildBuyAndStakeTxs(wallet, avax, slippage ? Number(slippage) : undefined);
    res.json({ transactions: txs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned tx: unstake
app.get("/build/unstake", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const amount = req.query.amount as string;
    if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required" });
    const tx = await builder.buildUnstakeTx(wallet, amount);
    res.json(tx);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast a signed transaction
app.post("/broadcast", requireApiKey, async (req, res) => {
  try {
    const { signedTx } = req.body;
    if (!signedTx) return res.status(400).json({ error: "signedTx is required in body" });
    const txHash = await builder.broadcast(signedTx);
    res.json({ txHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// === LAUNCHPAD ENDPOINTS ===

// Launchpad agent instructions (separate from staking instructions)
app.get("/launchpad/agent-instructions", (req, res) => {
  const base = `https://${req.get("host")}`;
  res.type("text/plain").send(`# Arena Launchpad — Agent Trading Instructions

You have access to the Arena Launchpad Trading API. Arena (arena.social) has a token launchpad where anyone can create tokens on a bonding curve. There are two types:
- AVAX-paired tokens: bought/sold with native AVAX
- ARENA-paired tokens: bought/sold via an AVAX Helper that auto-converts

The API auto-detects the type — you just provide the tokenId.

## Authentication
Include "X-API-Key: <your-key>" header in ALL requests.
If you don't have a key, register first: GET ${base}/register?wallet=<your-wallet>&name=<your-name>

## Base URL
${base}

## Discovery — Find tokens to trade

GET /launchpad/recent?count=10&type=all|avax|arena
  Latest token launches with name, symbol, graduation progress.

GET /launchpad/search?q=<contract-address>
  Find a token by its contract address.

GET /launchpad/graduating?count=5
  Tokens closest to graduating (deploying LP on DEX). These are the most active.

## Intelligence — Research before trading

GET /launchpad/token?tokenId=<id>
  Full token profile: name, symbol, price, market cap, graduation progress, creator, curve params.

GET /launchpad/quote?tokenId=<id>&avax=<amount>&side=buy
GET /launchpad/quote?tokenId=<id>&tokenAmount=<amount>&side=sell
  Price quotes. For buy: how many tokens for X AVAX. For sell: how much AVAX for X tokens.

GET /launchpad/portfolio?wallet=<address>
  Your tracked positions with current value. Only shows tokens you bought through this API.

GET /launchpad/market-cap?tokenId=<id>
  Market cap breakdown for a specific token.

GET /launchpad/activity?tokenId=<id>&count=20
  Recent buy/sell trades for a token (last ~2 hours of on-chain activity).

GET /launchpad/overview
  Platform stats: total tokens launched, protocol fees, contract addresses.

## Trading — Buy and sell tokens

GET /launchpad/build/buy?wallet=<address>&tokenId=<id>&avax=<amount>&slippage=<bps>
  Returns: { to, data, value, chainId, gas, gasLimit, description }
  Build unsigned tx to buy a launchpad token with AVAX.
  - slippage: optional, default 500 (5%)

GET /launchpad/build/sell?wallet=<address>&tokenId=<id>&amount=<amount|max>&slippage=<bps>
  Returns: { transactions: [approveTx, sellTx] }
  Build 2 unsigned txs: approve + sell. Execute in order.
  - Use amount="max" to sell entire balance.

POST /broadcast
  Body: { "signedTx": "0x..." }
  Broadcast a signed transaction.

## Workflow Example

1. Discover: GET /launchpad/recent?count=10
2. Research: GET /launchpad/token?tokenId=<interesting-one>
3. Check activity: GET /launchpad/activity?tokenId=<id>
4. Get quote: GET /launchpad/quote?tokenId=<id>&avax=0.5&side=buy
5. Buy: GET /launchpad/build/buy?wallet=<your-wallet>&tokenId=<id>&avax=0.5
6. Sign the tx with your private key
7. Broadcast: POST /broadcast { "signedTx": "0x..." }
8. Check portfolio: GET /launchpad/portfolio?wallet=<your-wallet>
9. To sell: GET /launchpad/build/sell?wallet=<your-wallet>&tokenId=<id>&amount=max
10. Sign approve tx, broadcast, wait. Then sign sell tx, broadcast.

## Important Notes
- All transactions are on Avalanche C-Chain (chainId: 43114)
- No service fee on launchpad trades (fee only applies to ARENA staking buys)
- ALWAYS use the gasLimit from the response (500000 for buy/sell, 60000 for approve)
- For sell: you get 2 txs (approve + sell) — execute IN ORDER, wait for each to confirm
- Graduated tokens (lpDeployed=true) cannot be traded here — they moved to DEX
- Token amounts on Arena's bonding curve are very small fractions — this is normal
- Your private key never leaves your wallet — this API only builds unsigned transactions
`);
});

// Helper: format Arena API token data for consistent response
function formatToken(t: arenaApi.ArenaToken) {
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
    const count = Math.min(parseInt(req.query.count as string) || 10, 50);
    const type = (req.query.type as string) || "all";
    const raw = await arenaApi.getRecentTokens(Math.min(count * 2, 50));
    let tokens = raw;
    if (type === "avax") tokens = raw.filter(t => t.lp_paired_with === "AVAX");
    else if (type === "arena") tokens = raw.filter(t => t.lp_paired_with === "ARENA");
    const result = tokens.slice(0, count).map(formatToken);
    res.json({ count: result.length, tokens: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/search", requireApiKey, async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: "?q=<name, symbol, or contract address> required" });

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
    if (results.length === 0) return res.status(404).json({ error: `No tokens found matching "${q}"` });
    res.json({ count: results.length, tokens: results.map(formatToken) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/graduating", requireApiKey, async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 5, 20);
    const tokens = await arenaApi.getGraduatingTokens(count);
    res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/graduated", requireApiKey, async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 10, 50);
    const tokens = await arenaApi.getGraduatedTokens(count);
    res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/top-volume", requireApiKey, async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || "24h";
    if (!["5m", "1h", "4h", "24h", "all_time"].includes(timeframe)) {
      return res.status(400).json({ error: "timeframe must be 5m, 1h, 4h, 24h, or all_time" });
    }
    const count = Math.min(parseInt(req.query.count as string) || 10, 50);
    const tokens = await arenaApi.getTopVolume(timeframe as any, count);
    res.json({ count: tokens.length, timeframe, tokens: tokens.map(formatToken) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Intelligence endpoints
app.get("/launchpad/token", requireApiKey, async (req, res) => {
  try {
    const tokenId = req.query.tokenId as string;
    const tokenAddress = req.query.address as string;
    if (!tokenId && !tokenAddress) return res.status(400).json({ error: "?tokenId= or ?address= required" });

    // Get on-chain data (for accurate price/curve data)
    let onChainInfo: any = null;
    if (tokenId) {
      try { onChainInfo = await builder.getTokenInfo(tokenId); } catch {}
    }

    // Get rich data from Arena API (fast direct lookup by address)
    let apiData: any = null;
    let stats: any = null;
    const addr = tokenAddress || onChainInfo?.tokenAddress;
    if (addr) {
      const match = await arenaApi.getTokenByAddress(addr).catch(() => null);
      if (match) apiData = formatToken(match);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/quote", requireApiKey, async (req, res) => {
  try {
    const tokenId = req.query.tokenId as string;
    const side = req.query.side as string;
    if (!tokenId || !side) return res.status(400).json({ error: "?tokenId= and ?side=buy|sell required" });
    const amount = side === "buy" ? req.query.avax as string : req.query.tokenAmount as string;
    if (!amount) return res.status(400).json({ error: side === "buy" ? "?avax= required for buy" : "?tokenAmount= required for sell" });
    const quote = await builder.getTokenQuote(tokenId, amount, side as any);
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/portfolio", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: "?wallet= required" });
    const tokenIds = getPositions(wallet);
    const portfolio = await builder.getPortfolio(wallet, tokenIds);
    res.json(portfolio);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/market-cap", requireApiKey, async (req, res) => {
  try {
    const tokenId = req.query.tokenId as string;
    if (!tokenId) return res.status(400).json({ error: "?tokenId= required" });
    const mcap = await builder.getMarketCap(tokenId);
    res.json(mcap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/activity", requireApiKey, async (req, res) => {
  try {
    const tokenId = req.query.tokenId as string;
    const tokenAddress = req.query.address as string;
    const count = Math.min(parseInt(req.query.count as string) || 20, 50);
    if (!tokenId && !tokenAddress) return res.status(400).json({ error: "?tokenId= or ?address= required" });

    // If we have tokenAddress, use Arena API for rich trade data
    let addr = tokenAddress;
    if (!addr && tokenId) {
      try {
        const info = await builder.getTokenInfo(tokenId);
        addr = info.tokenAddress;
      } catch {}
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
      } catch {}
    }

    // Fallback to on-chain events
    if (tokenId) {
      const activity = await builder.getActivity(tokenId, count);
      return res.json(activity);
    }
    res.status(400).json({ error: "Could not resolve token address" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Holders endpoint (new — powered by Arena API)
app.get("/launchpad/holders", requireApiKey, async (req, res) => {
  try {
    const tokenAddress = req.query.address as string;
    const tokenId = req.query.tokenId as string;
    const count = Math.min(parseInt(req.query.count as string) || 20, 50);

    let addr = tokenAddress;
    if (!addr && tokenId) {
      try {
        const info = await builder.getTokenInfo(tokenId);
        addr = info.tokenAddress;
      } catch {}
    }
    if (!addr) return res.status(400).json({ error: "?address= or ?tokenId= required" });

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/overview", requireApiKey, async (req, res) => {
  try {
    const overview = await builder.getOverview();
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global trades feed — all trades across all tokens
app.get("/launchpad/trades", requireApiKey, async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trading endpoints
app.get("/launchpad/build/buy", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const tokenId = req.query.tokenId as string;
    const avax = req.query.avax as string;
    const slippage = req.query.slippage as string;
    if (!wallet || !tokenId || !avax) return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?avax= required" });
    const tx = await builder.buildLaunchpadBuyTx(wallet, tokenId, avax, slippage ? Number(slippage) : undefined);
    // Track position for portfolio
    trackPosition(wallet, Number(tokenId));
    res.json(tx);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/launchpad/build/sell", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const tokenId = req.query.tokenId as string;
    const amount = req.query.amount as string;
    const slippage = req.query.slippage as string;
    if (!wallet || !tokenId || !amount) return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?amount= required" });
    const txs = await builder.buildLaunchpadSellTx(wallet, tokenId, amount, slippage ? Number(slippage) : undefined);
    // If selling max, remove position tracking
    if (amount === "max") removePosition(wallet, Number(tokenId));
    res.json({ transactions: txs });
  } catch (err: any) {
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
