import dotenv from "dotenv";
dotenv.config();

import express from "express";
import compression from "compression";
import { createProvider } from "./core/provider";
import { SwapModule } from "./swap";
import { StakingModule } from "./staking";
import { LaunchpadModule } from "./launchpad";
import { DexModule } from "./dex";
import { PerpsModule } from "./perps";
import { generateApiKey } from "./data/apikeys";

import { adminRoutes } from "./routes/admin";
import { swapRoutes } from "./routes/swap";
import { stakingRoutes } from "./routes/staking";
import { launchpadRoutes } from "./routes/launchpad";
import { dexRoutes } from "./routes/dex";
import { dashboardRoutes } from "./routes/dashboard";
import { perpsRoutes } from "./routes/perps";
import { BridgeModule } from "./bridge";
import { bridgeRoutes } from "./routes/bridge";
import { TicketsModule } from "./tickets";
import { ticketRoutes } from "./routes/tickets";
import { SocialModule } from "./social";
import { socialRoutes } from "./routes/social";
import { SignalsModule } from "./signals";
import { signalRoutes } from "./routes/signals";
import { instructionRoutes } from "./routes/instructions";

const app = express();
app.use(compression());
app.use(express.json({ limit: "5mb" }));

const PORT = parseInt(process.env.PORT || "3000");

// Create shared provider and modules
const provider = createProvider();
const swap = new SwapModule(provider);
const staking = new StakingModule(provider, swap);
const launchpad = new LaunchpadModule(provider);
const dex = new DexModule(provider);
const perps = new PerpsModule();
const bridgeModule = new BridgeModule();
const ticketsModule = new TicketsModule(provider);
const socialModule = new SocialModule();
const signalsModule = new SignalsModule();

// Public endpoints
app.get("/register", (req, res) => {
  const wallet = req.query.wallet as string;
  const name = req.query.name as string || wallet;
  if (!wallet) return res.status(400).json({ error: "?wallet=<your-wallet-address> required" });
  const key = generateApiKey(name, wallet);
  res.json({ key, name, wallet, message: "Save this API key. It works for ALL Arena endpoints — staking, launchpad trading, everything. Include it as X-API-Key header in all requests." });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    router: swap.routerAddress || "not deployed yet",
    fee: "0.3%",
  });
});

// Mount routes
app.use(instructionRoutes());
app.use(adminRoutes());
app.use(swapRoutes(swap, provider));
app.use(stakingRoutes(staking, swap));
app.use(launchpadRoutes(launchpad, provider));
app.use(dexRoutes(dex));
app.use(perpsRoutes(perps));
app.use(bridgeRoutes(bridgeModule));
app.use(ticketRoutes(ticketsModule));
app.use(socialRoutes(socialModule));
app.use(signalRoutes(signalsModule));
app.use(dashboardRoutes());

// Serve /skill and /docs pages
app.get("/skill", (_req, res) => {
  res.sendFile("skill.html", { root: "frontend" });
});

app.get("/docs", (_req, res) => {
  res.sendFile("docs.html", { root: "frontend" });
});

// OG image (SVG served as PNG content-type for social previews)
app.get("/og-image.png", (_req, res) => {
  res.sendFile("og-image.svg", { root: "frontend", headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
});

// Sitemap
app.get("/sitemap.xml", (req, res) => {
  const base = `https://${req.get("host")}`;
  const now = new Date().toISOString().split("T")[0];
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/skill</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${base}/docs</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${base}/skill.md</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${base}/agent-instructions</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
</urlset>`);
});

// Robots.txt
app.get("/robots.txt", (req, res) => {
  const base = `https://${req.get("host")}`;
  res.type("text/plain").send(`User-agent: *
Allow: /
Allow: /skill
Allow: /docs
Allow: /skill.md

Sitemap: ${base}/sitemap.xml`);
});

// Serve /skill.md as raw markdown (for AI agents)
app.get("/skill.md", (req, res) => {
  const base = `https://${req.get("host")}`;
  res.type("text/markdown").send(`# Logiqical

On-chain infrastructure for AI agents on Avalanche. Swap tokens, stake ARENA, trade 112,000+ launchpad tokens, and route through every major DEX — all from a single API key.

**Base URL:** \`${base}\`

> **AI Agents:** For easier parsing and exact formatting, use this raw markdown version: [/skill.md](${base}/skill.md)

For the visual version, see [/skill](${base}/skill).

---

## Quick Start

1. Register: \`GET ${base}/register?wallet=<your-wallet>&name=<your-name>\`
2. Save the API key. Add \`X-API-Key: <your-key>\` to every request.
3. Start trading. One key works for everything.

---

## Modules

### Swap (ARENA/AVAX)
Buy and sell ARENA with AVAX. 0.3% service fee on buys. Sells are free.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /balances?wallet= | AVAX + ARENA balances |
| GET | /quote?avax= | Buy quote |
| GET | /quote/sell?arena= | Sell quote |
| GET | /build/buy?wallet=&avax=&slippage= | Build buy tx (1 tx) |
| GET | /build/sell-arena?wallet=&amount=&slippage= | Build sell txs (approve + swap) |

Full docs: \`GET ${base}/swap/agent-instructions\`

### Staking
Stake ARENA to become a Champion. Earn 2.5% of every token that graduates from Arena's launchpad.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /stake/info?wallet= | Staked amount + pending rewards |
| GET | /build/stake?wallet=&amount= | Build stake txs (approve + deposit) |
| GET | /build/buy-and-stake?wallet=&avax= | Buy + stake in one flow (3 txs) |
| GET | /build/unstake?wallet=&amount= | Unstake + claim rewards |

Full docs: \`GET ${base}/agent-instructions\`

### Launchpad
Discover, research, and trade 112,000+ tokens on Arena's bonding curve. Graduated tokens auto-route through Arena DEX.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /launchpad/overview | Platform stats |
| GET | /launchpad/recent?count=&type= | Recently launched tokens |
| GET | /launchpad/top-volume?timeframe=&count= | Trending by volume |
| GET | /launchpad/graduating?count= | Tokens about to graduate |
| GET | /launchpad/graduated?count= | Already graduated tokens |
| GET | /launchpad/search?q= | Search by name, symbol, or address |
| GET | /launchpad/token?tokenId= | Full token detail + stats |
| GET | /launchpad/quote?tokenId=&avax=&side= | Price quote |
| GET | /launchpad/market-cap?tokenId= | Market cap breakdown |
| GET | /launchpad/activity?tokenId=&count= | Buy/sell activity |
| GET | /launchpad/holders?address=&count= | Holders + PnL |
| GET | /launchpad/trades?count= | Global trades feed |
| GET | /launchpad/build/buy?wallet=&tokenId=&avax= | Build buy tx |
| GET | /launchpad/build/sell?wallet=&tokenId=&amount= | Build sell txs (approve + sell) |
| GET | /launchpad/portfolio?wallet= | Your positions + PnL |

Full docs: \`GET ${base}/launchpad/agent-instructions\`

### DEX (Any Token)
Swap ANY token on Avalanche via LFJ (Trader Joe). USDC, BTC.b, JOE, sAVAX, and any contract address.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /dex/tokens | Popular tokens list |
| GET | /dex/token-info?address= | Look up any ERC-20 |
| GET | /dex/balance?wallet=&token= | Token balance |
| GET | /dex/quote?from=&to=&amount= | Swap quote + price impact |
| GET | /dex/build/swap?wallet=&from=&to=&amount=&slippage= | Build swap txs |

Full docs: \`GET ${base}/dex/agent-instructions\`

### Perps (Perpetual Futures via Hyperliquid)
Trade 250+ perpetual futures markets with up to 50x leverage. Powered by Arena + Hyperliquid.

**Setup:** Call \`POST /perp/setup\` with your Arena API key once. After that, all perp endpoints work automatically.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /perp/setup | Link Arena API key (one-time) |
| POST | /perp/register | Register for perps trading |
| GET | /perp/registration-status | Check registration status |
| GET | /perp/wallet-address | Get Hyperliquid wallet address |
| POST | /perp/auth/status | Check auth completion |
| POST | /perp/auth/:step/payload | Get EIP-712 payload for auth step |
| POST | /perp/auth/:step/submit | Submit signed auth payload |
| POST | /perp/auth/enable-hip3 | Enable HIP-3 (automated) |
| GET | /perp/trading-pairs | All 250+ markets with precision/leverage |
| POST | /perp/leverage/update | Set leverage for a market |
| POST | /perp/orders/place | Place order(s) — market/limit, long/short |
| POST | /perp/orders/cancel | Cancel order(s) |
| POST | /perp/orders/modify | Modify an existing order |
| POST | /perp/orders/close-position | Close position (convenience) |
| GET | /perp/orders | Get open orders |
| GET | /perp/trade-executions | Trade execution history |
| GET | /perp/positions?wallet= | Positions + margin summary |
| GET | /perp/open-orders?wallet= | Open orders from Hyperliquid |

### Bridge (Cross-Chain — Any Token, Any Chain)
Bridge tokens between 20+ chains via Li.Fi. Avalanche, Ethereum, Arbitrum, Base, Polygon, BSC, and more.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /bridge/chains | Supported chains |
| GET | /bridge/tokens?chains=43114,42161 | Tokens on specified chains |
| GET | /bridge/token?chainId=&address= | Token info |
| GET | /bridge/connections?fromChainId=&toChainId= | Bridge paths between chains |
| GET | /bridge/quote?fromChainId=&toChainId=&fromToken=&toToken=&fromAmount=&fromAddress= | Best route with unsigned tx |
| GET | /bridge/routes?... | Multiple route options |
| GET | /bridge/status?txHash=&fromChainId=&toChainId= | Check transfer status |
| GET | /bridge/info | Reference: chain IDs, USDC addresses, native token |

Full docs: \`GET ${base}/bridge/agent-instructions\`

### Broadcast
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /broadcast | Send a signed transaction. Body: \`{ "signedTx": "0x..." }\` |

---

## How to Connect

### Option 1: MCP Server (Claude, Cursor, Windsurf)

\`\`\`json
{
  "mcpServers": {
    "logiqical": {
      "command": "npx",
      "args": ["logiqical-mcp-server"],
      "env": {
        "LOGIQICAL_API_KEY": "your-api-key",
        "LOGIQICAL_WALLET": "your-wallet-address"
      }
    }
  }
}
\`\`\`

### Option 2: TypeScript SDK

\`\`\`bash
npm install logiqical
\`\`\`

\`\`\`typescript
import { LogiqicalClient } from "logiqical";

const client = new LogiqicalClient({
  baseUrl: "${base}",
  apiKey: "your-api-key",
});

const balances = await client.swap.getBalances("0xYourWallet");
const tokens = await client.launchpad.getRecent(10);
const quote = await client.dex.getQuote("AVAX", "USDC", "10");
\`\`\`

### Option 3: REST API (any language)

Just point your agent at an instructions endpoint:
\`\`\`
Read the instructions at ${base}/agent-instructions and use them to trade on Avalanche.
Your API key is: <your-key>
\`\`\`

---

## MCP Tools (53 tools)

**Swap & Staking:**
- \`get_balances\` — AVAX + ARENA balance
- \`get_quote\` — Buy quote (AVAX → ARENA)
- \`get_sell_quote\` — Sell quote (ARENA → AVAX)
- \`build_buy_tx\` — Build unsigned buy tx
- \`build_sell_arena_tx\` — Build approve + sell txs
- \`get_stake_info\` — Staked amount + rewards
- \`build_stake_txs\` — Build approve + deposit txs
- \`build_buy_and_stake_txs\` — Buy + stake in one flow (3 txs)
- \`build_unstake_tx\` — Unstake + claim rewards

**Launchpad:**
- \`launchpad_overview\` — Platform stats + addresses
- \`launchpad_recent\` — Recently launched tokens
- \`launchpad_graduating\` — Tokens about to graduate
- \`launchpad_token_info\` — Full token deep-dive
- \`launchpad_quote\` — Buy/sell price preview
- \`launchpad_build_buy\` — Build buy tx for launchpad token
- \`launchpad_build_sell\` — Build approve + sell txs

**Bridge:**
- \`bridge_chains\` — Supported chains
- \`bridge_tokens\` — Tokens on chains
- \`bridge_token\` — Specific token info
- \`bridge_connections\` — Bridge paths
- \`bridge_quote\` — Quote with unsigned tx
- \`bridge_routes\` — Multiple route options
- \`bridge_status\` — Check transfer status
- \`bridge_info\` — Reference data

**Broadcast:**
- \`broadcast_tx\` — Send signed tx to Avalanche

---

## Critical Rules

1. All transactions are on **Avalanche C-Chain** (chainId: 43114)
2. **Always use the gasLimit** from the response. Never use your wallet's default gas estimate — it will revert.
3. **Multi-tx operations execute in order.** Sell = approve + swap. Stake = approve + deposit. Wait for each to confirm.
4. A **0.3% service fee** applies on ARENA buys. Everything else is free.
5. **Your private key never leaves your wallet.** This API only builds unsigned transactions.
6. Use \`amount=max\` to sell/unstake your entire balance.
7. ARENA token address: \`0xB8d7710f7d8349A506b75dD184F05777c82dAd0C\`
`);
});

// Serve frontend
app.use(express.static("frontend"));

app.listen(PORT, () => {
  console.log(`Arena Agent Plugin running on port ${PORT}`);
  console.log(`Fee: 0.3% on buys via ArenaRouter`);
  console.log(`Router: ${swap.routerAddress || "NOT SET — deploy contract and set ARENA_ROUTER env var"}`);
});
