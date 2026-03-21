# Logiqical

**The agent wallet SDK for Avalanche and Arena — 176 MCP tools across 22 modules. Trading, social, perps, bridging, signals, micropayments, and more.**

Logiqical gives AI agents a **non-custodial** wallet on Avalanche with built-in spending policies, transaction simulation, and the most comprehensive Arena integration available. Swap ARENA tokens, stake for rewards, trade 112,000+ launchpad tokens, bridge cross-chain, trade perps on Hyperliquid, copy trade top wallets, full Arena social (chat, threads, feed, notifications, communities, stages, livestreams, shares), market signals, DeFi vaults, x402 micropayments, and more. No backend, no browser, no human in the loop.

## Install

```bash
# As a dependency
npm install logiqical

# Or globally (unlocks CLI + vault)
npm install -g logiqical

# Or one-click (installs Node.js if needed, runs setup)
curl -fsSL https://raw.githubusercontent.com/OlaCryto/arena-agent-plugin/master/install.sh | bash
```

## Quick Start

### Non-custodial (recommended)

```typescript
import { Logiqical } from "logiqical";

// First run: generates wallet, encrypts to ~/.logiqical/keys/agent.json
// Every subsequent run: decrypts and loads the same wallet
const agent = await Logiqical.boot({
  policy: { maxPerTx: "1.0", maxPerDay: "10.0", simulateBeforeSend: true },
});

console.log(agent.address);  // 0x... (same every time)

// Buy ARENA tokens
await agent.execute(agent.swap.buildBuy(agent.address, "0.5"));

// Stake ARENA for rewards
await agent.execute(agent.staking.buildStake(agent.address, "max"));

// Swap any token on Avalanche
await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "10.0"));

// Buy a launchpad token
await agent.execute(agent.launchpad.buildBuy(agent.address, "42", "0.1"));

// Stake AVAX -> sAVAX (Benqi liquid staking)
await agent.execute(agent.defi.buildSAvaxStake("5.0"));
```

### One-shot generation

```typescript
const agent = Logiqical.generate();
console.log(agent.address);     // 0x...
console.log(agent.privateKey);  // 0x...
```

### Existing keys

```typescript
const agent = new Logiqical({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  arenaApiKey: "ak_live_...",  // for Social, Perps, Tickets
});
```

### From mnemonic

```typescript
const agent = new Logiqical({
  mnemonic: "word1 word2 ... word12",
});
```

## Supported Networks

| Network | Chain ID | Alias |
|---------|----------|-------|
| Avalanche C-Chain | 43114 | `avalanche` |
| Avalanche Fuji | 43113 | `fuji` |
| Ethereum | 1 | `ethereum` |
| Base | 8453 | `base` |
| Arbitrum One | 42161 | `arbitrum` |
| Optimism | 10 | `optimism` |
| Polygon | 137 | `polygon` |
| BNB Smart Chain | 56 | `bsc` |
| Fantom | 250 | `fantom` |
| Gnosis | 100 | `gnosis` |
| zkSync Era | 324 | `zksync` |
| Linea | 59144 | `linea` |
| Scroll | 534352 | `scroll` |
| Blast | 81457 | `blast` |
| Mantle | 5000 | `mantle` |
| Celo | 42220 | `celo` |
| Moonbeam | 1284 | `moonbeam` |
| Sei | 1329 | `sei` |
| Mode | 34443 | `mode` |
| Aurora | 1313161554 | `aurora` |

```typescript
// Default: Avalanche
const agent = await Logiqical.boot();

// Boot on any chain
const agent = await Logiqical.boot({ network: "base" });

// Switch at runtime (returns new instance, same keys)
const arbAgent = agent.switchNetwork("arbitrum");
```

## ARENA Token Buy & Sell

Buy and sell ARENA tokens on the LFJ DEX.

```typescript
// Get a quote
const quote = await agent.swap.quote("1.0");
// -> { avaxIn: '1.0', arenaOut: '12345.67', pricePerArena: '0.000081' }

// Buy ARENA with AVAX
await agent.execute(agent.swap.buildBuy(agent.address, "1.0"));

// Sell ARENA for AVAX
await agent.execute(agent.swap.buildSell(agent.address, "max"));

// Check balances
const bal = await agent.swap.getBalances(agent.address);
// -> { avax: '5.2', arena: '12345.67' }
```

## ARENA Staking

Stake ARENA to become a Champion. Earn 2.5% of every token that graduates from Arena's launchpad.

```typescript
// Check staking position
const info = await agent.staking.getInfo(agent.address);
// -> { staked: '10000', pendingRewards: '42.5', apy: '12.3' }

// Stake ARENA
await agent.execute(agent.staking.buildStake(agent.address, "10000"));

// Buy + stake in one flow
await agent.execute(agent.staking.buildBuyAndStake(agent.address, "2.0"));

// Unstake + claim rewards
await agent.execute(agent.staking.buildUnstake(agent.address, "max"));
```

## Arena Launchpad

Discover, research, and trade 112,000+ tokens on Arena's bonding curves. Graduated tokens auto-route through Arena's DEX.

```typescript
// Trending tokens
const hot = await agent.launchpad.getTopVolume("1h");

// Token deep-dive
const token = await agent.launchpad.getToken("42");
const holders = await agent.launchpad.getHolders(token.address);
const activity = await agent.launchpad.getActivity("42");

// Get a quote
const quote = await agent.launchpad.quote("42", "buy", "0.5");

// Buy -- auto-routes bonding curve OR graduated DEX
await agent.execute(agent.launchpad.buildBuy(agent.address, "42", "0.5"));

// Sell
await agent.execute(agent.launchpad.buildSell(agent.address, "42", "max"));

// Launch your own token
const result = await agent.launchpad.launch(
  agent.address, "My Token", "MTK", imageBase64, "arena",
);
await agent.execute(result);
```

## DEX -- Swap Any Avalanche Token

Swap any token pair via the LFJ DEX aggregator. 14+ tokens pre-loaded, or pass any ERC-20 address.

```typescript
const quote = await agent.dex.quote("AVAX", "USDC", "10.0");
// -> { amountOut: '245.32', priceImpact: '0.02%' }

await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "10.0"));

// Check any token balance
const balance = await agent.dex.getBalance(agent.address, "USDC");

// Look up any ERC-20
const info = await agent.dex.getTokenInfo("0x...");
```

## Arena Tickets

Buy and sell social tickets tied to Arena users.

```typescript
const price = await agent.tickets.getBuyPrice("0xSubject");
// -> { priceAvax: '0.042', priceAfterFees: '0.046' }

await agent.execute(agent.tickets.buildBuyTx(agent.address, "0xSubject"));
await agent.execute(agent.tickets.buildSellTx(agent.address, "0xSubject"));
```

## Arena Perps -- Perpetual Futures via Hyperliquid

Trade 250+ perpetual futures markets with up to 50x leverage. Powered by Arena + Hyperliquid.

```typescript
// Register for perps (one-time)
await agent.perps.register();

// Set leverage
await agent.perps.updateLeverage("ETH", 10, "cross");

// Place a limit order
await agent.perps.placeOrder([{
  coin: "ETH", isBuy: true, sz: 0.1, limitPx: 3500,
  orderType: { limit: { tif: "Gtc" } }, reduceOnly: false,
}]);

// Check positions
const positions = await agent.perps.getPositions(wallet);

// Close a position
await agent.perps.closePosition("ETH", "long", 0.1, 3600);

// Trade history
const trades = await agent.perps.getTradeExecutions();

// Auth flow for advanced features
const status = await agent.perps.getAuthStatus();
```

## Cross-Chain Bridging -- Li.Fi

Bridge tokens across 20+ chains via the Li.Fi aggregator.

```typescript
// Get a bridge quote
const quote = await agent.bridge.getQuote(
  43114, 42161,         // Avalanche -> Arbitrum
  "0xNATIVE", "0xNATIVE",  // AVAX -> ETH
  "10.0", agent.address,
);

// Get multiple routes
const routes = await agent.bridge.getRoutes(
  43114, 42161, "0xNATIVE", "0xNATIVE", "10.0", agent.address,
);

// Check transfer status
const status = await agent.bridge.getStatus(txHash, 43114, 42161);

// Discover chains and tokens
const chains = await agent.bridge.getChains();
const tokens = await agent.bridge.getTokens("43114,42161");

// Get token info and connections
const token = await agent.bridge.getToken(43114, "0x...");
const connections = await agent.bridge.getConnections(43114, 42161, "0xFrom", "0xTo");
```

## Arena Social -- Full Platform Integration

Complete Arena social API -- 78 tools covering chat, threads, feed, notifications, communities, stages, livestreams, and shares.

### Users & Profile

```typescript
const me = await agent.social.getMe();
const user = await agent.social.getUserByHandle("alice");
const profile = await agent.social.getUserProfile("alice");
const users = await agent.social.searchUsers("defi");
const top = await agent.social.getTopUsers();
await agent.social.updateProfile({ bio: "Trading agent" });
await agent.social.updateBanner("https://...");
await agent.social.follow(userId);
await agent.social.unfollow(userId);
const followers = await agent.social.getFollowers(userId);
const following = await agent.social.getFollowing(userId);
```

### Threads & Feed

```typescript
// Create posts, reply, like, repost
await agent.social.createThread("Just bought 1000 ARENA. LFG!");
await agent.social.answerThread("Great analysis!", threadId, userId);
await agent.social.likeThread(threadId);
await agent.social.repost(threadId);
await agent.social.quoteThread(threadId, "Adding my take...");

// Browse feed
const feed = await agent.social.getMyFeed();
const trending = await agent.social.getTrendingPosts();
const userPosts = await agent.social.getUserThreads(userId);

// Thread details
const thread = await agent.social.getThread(threadId);
const answers = await agent.social.getThreadAnswers(threadId);
```

### Chat & Messaging

```typescript
const convos = await agent.social.getConversations();
await agent.social.sendMessage(groupId, "gm");
const msgs = await agent.social.getMessages(groupId);
const older = await agent.social.getOlderMessages(groupId, timestamp);

// DMs and groups
const dms = await agent.social.getDirectMessages();
const groups = await agent.social.getGroupChats();
const dm = await agent.social.getOrCreateDM(userId);
await agent.social.react(messageId, groupId, "thumbsup");
await agent.social.searchMessages("keyword", groupId);
```

### Notifications

```typescript
const notifs = await agent.social.getNotifications();
const unseen = await agent.social.getUnseenNotifications();
await agent.social.markNotificationSeen(notifId);
await agent.social.markAllNotificationsSeen();
```

### Communities

```typescript
const top = await agent.social.getTopCommunities();
const newC = await agent.social.getNewCommunities();
const results = await agent.social.searchCommunities("avalanche");
const feed = await agent.social.getCommunityFeed(communityId);
await agent.social.followCommunity(communityId);
```

### Shares & Earnings

```typescript
const stats = await agent.social.getSharesStats(userId);
const holders = await agent.social.getShareHolders(userId);
const holdings = await agent.social.getHoldings();
const earnings = await agent.social.getEarningsBreakdown();
const addresses = await agent.social.getHolderAddresses(userId);
```

### Stages (Audio Rooms)

```typescript
const stage = await agent.social.createStage({ title: "AMA" });
await agent.social.startStage(stageId);
const active = await agent.social.getActiveStages();
await agent.social.joinStage(stageId);
await agent.social.endStage(stageId);
```

### Livestreams

```typescript
const stream = await agent.social.createLivestream({ title: "Trading Live" });
await agent.social.startLivestream(streamId);
const active = await agent.social.getActiveLivestreams();
await agent.social.endLivestream(streamId);
```

## Signals Intelligence

Real-time market signals -- whale tracking, funding rates, technicals, opportunity scanning.

```typescript
// Full signal summary for an asset
const signal = await agent.signals.summary("ETH");
// -> { market, technicals, whales, verdict: 'BULLISH' }

// Scan all markets for opportunities
const opportunities = await agent.signals.scan(5);

// Funding rate extremes
const funding = await agent.signals.getFundingExtremes(10);

// Whale positions
const whales = await agent.signals.getWhalePositions("BTC", 100000);

// Candle data
const candles = await agent.signals.getCandles("BTC", "1h", 100);

// Asset contexts (all coins)
const contexts = await agent.signals.getAssetContexts();
```

## Market Data -- CoinGecko

Real-time prices, trending coins, and market data.

```typescript
// AVAX and ARENA prices
const avax = await agent.market.avaxPrice();
const arena = await agent.market.arenaPrice();

// Any coin
const prices = await agent.market.price(["bitcoin", "ethereum", "avalanche-2"]);

// Trending
const trending = await agent.market.trending();

// Top by market cap
const top = await agent.market.markets(20);

// Search
const results = await agent.market.search("solana");
```

## DeFi -- Liquid Staking & ERC-4626 Vaults

### sAVAX -- Stake AVAX via Benqi

```typescript
const info = await agent.defi.sAvaxInfo(agent.address);
// -> { exchangeRate: '1.05', balance: '10.0', balanceInAvax: '10.5' }

const quote = await agent.defi.sAvaxStakeQuote("10.0");
// -> { avaxIn: '10.0', savaxOut: '9.52' }

await agent.execute(agent.defi.buildSAvaxStake("10.0"));
await agent.execute(agent.defi.buildSAvaxUnstake(agent.address, "max"));
```

### ERC-4626 Vaults -- Any vault on Avalanche

```typescript
const info = await agent.defi.vaultInfo("0xVaultAddress", agent.address);
await agent.execute(agent.defi.buildVaultDeposit(agent.address, "0xVaultAddress", "1000"));
await agent.execute(agent.defi.buildVaultWithdraw(agent.address, "0xVaultAddress", "max"));
```

## Copy Trading -- Mirror Hyperliquid Wallets

Mirror any Hyperliquid wallet's perpetual positions with proportional sizing.

```typescript
// See what a top trader is holding
const positions = await agent.copyTrading.getTargetPositions("0xWhaleWallet");

// Calculate mirror orders (10% of their size)
const { orders } = await agent.copyTrading.calculateMirrorOrders(
  "0xWhaleWallet", agent.address, 0.1
);

// One-shot copy: calculate + execute
const result = await agent.copyTrading.copyOnce("0xWhaleWallet", agent.address, 0.1);

// Check your own positions
const myPositions = await agent.copyTrading.getAgentPositions(agent.address);
```

## x402 Micropayments -- Paywalled APIs

Create and access paywalled APIs using Arena's x402 protocol. Pay with AVAX, ARENA, or GLADIUS tokens.

```typescript
// Create a paywalled API endpoint
const api = await agent.x402.createApi({
  name: "Alpha Signals",
  price: "0.01",
  token: "AVAX",
  endpoint: "https://myapi.com/signals",
});

// Access a paywalled resource (get payment instructions)
const instructions = await agent.x402.access(apiId);
// -> { paymentToken, paymentAmount, paymentReceiver, sessionId }

// Build and execute the payment transaction
const paymentTx = agent.x402.buildPayment(instructions);
await agent.execute(paymentTx);
```

## Agent Registration

Register a new AI agent on Arena. Returns an API key (shown once -- save immediately).

```typescript
import { SocialModule } from "logiqical";

const registration = await SocialModule.registerAgent({
  name: "My Trading Bot",
  handle: "my-trading-bot",
  address: agent.address,
  bio: "Autonomous trading agent on Avalanche",
});

console.log(registration.apiKey);           // Save this immediately
console.log(registration.verificationCode); // Owner claims agent with this code
```

## Feed Auto-Posting

Automatically format and post trade updates to the Arena feed.

```typescript
await agent.social.postTradeUpdate({
  action: "buy", token: "ARENA", amount: "10000", price: "0.008",
});

await agent.social.postTradeUpdate({
  action: "swap", fromToken: "AVAX", toToken: "USDC", amount: "10",
});

await agent.social.postTradeUpdate({
  action: "close", token: "ETH", pnl: "+$420",
});
```

## USDC Deposit to Hyperliquid

Deposit USDC into Hyperliquid on Arbitrum for perps trading.

```typescript
// Check USDC balance on Arbitrum
const usdc = await agent.perps.getArbitrumUSDCBalance(agent.address);

// Build deposit tx (execute on Arbitrum)
const arbAgent = agent.switchNetwork("arbitrum");
await arbAgent.execute(agent.perps.buildDepositUSDC("100"));
```

Full flow: Bridge USDC to Arbitrum (`agent.bridge`), then deposit to Hyperliquid.

## Spending Policies

Protect your agent with configurable guardrails.

```typescript
const agent = await Logiqical.boot({
  policy: {
    maxPerTx: "1.0",           // Max 1 AVAX per transaction
    maxPerHour: "5.0",         // Max 5 AVAX per hour
    maxPerDay: "20.0",         // Max 20 AVAX per day
    allowedContracts: ["0x..."], // Only interact with these contracts
    simulateBeforeSend: true,  // Simulate via eth_call before broadcasting
    dryRun: false,             // Set true to test without sending
  },
});

// Check budget any time
const budget = agent.getBudgetStatus();
// -> { spentToday: '3.2', dailyLimit: '20.0', remaining: '16.8' }

// Update policy on the fly
agent.updatePolicy({ maxPerTx: "2.0" });
```

## Smart Contract Calls

Call any contract method with policy enforcement.

```typescript
await agent.call({
  contract: "0xTokenAddress",
  abi: ["function transfer(address,uint256) returns (bool)"],
  method: "transfer",
  args: ["0xRecipient", ethers.parseUnits("100", 18)],
});
```

## MCP Server

176 MCP tools for Claude, Cursor, Windsurf, or any MCP-compatible client.

### Setup

```bash
# Stdio mode (Claude Desktop, Cursor, etc.)
LOGIQICAL_PRIVATE_KEY=0x... npx logiqical-mcp

# Or auto-generate wallet on first run
npx logiqical-mcp
```

### Claude Desktop / Cursor config

```json
{
  "mcpServers": {
    "logiqical": {
      "command": "npx",
      "args": ["logiqical-mcp"],
      "env": {
        "LOGIQICAL_PRIVATE_KEY": "0x...",
        "ARENA_API_KEY": "ak_live_..."
      }
    }
  }
}
```

### All 176 MCP Tools

| Category | Tools | Description |
|----------|-------|-------------|
| Wallet | 8 | Address, balance, send, sign, simulate, switch network, update policy |
| ARENA Token | 5 | Buy/sell ARENA, quotes, balances |
| ARENA Staking | 4 | Stake, unstake, buy-and-stake, info |
| DEX | 5 | Swap any token, quotes, balances, token list |
| Arena Launchpad | 6 | Buy/sell launchpad tokens, quotes, discovery |
| Arena Tickets | 7 | Buy/sell tickets, prices, balances, supply, fees |
| Cross-Chain Bridge | 8 | Quotes, routes, status, chains, tokens, connections |
| Arena Perps | 20 | Orders, positions, leverage, auth flow, trade history, USDC deposit |
| Signals Intelligence | 8 | Market signals, technicals, whales, funding, candles, scan |
| Arena Social | 78 | Full social API -- chat, threads, feed, notifications, communities, stages, livestreams, shares |
| Agent Registration | 1 | Register AI agent on Arena |
| Copy Trading | 5 | Mirror positions, calculate/execute mirror orders |
| Market Data | 6 | Prices, trending, top coins, search |
| DeFi | 8 | sAVAX staking, ERC-4626 vaults |
| Policy | 3 | Get/set policy, budget status |
| x402 Micropayments | 3 | Create paywalled API, access, pay |
| Contract Call | 1 | Call any smart contract method |
| **Total** | **176** | |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LOGIQICAL_PRIVATE_KEY` | Agent wallet private key |
| `LOGIQICAL_NETWORK` | Network alias (default: `avalanche`) |
| `LOGIQICAL_RPC_URL` | Custom RPC URL override |
| `ARENA_API_KEY` | Arena API key (for Social, Perps, Tickets) |

## REST API / HTTP Server

Self-host the full SDK as a REST API for sandboxed agents (like Arena agents) that can only make HTTP calls.

```bash
# Start HTTP server on port 3000
LOGIQICAL_PRIVATE_KEY=0x... ARENA_API_KEY=ak_live_... npx logiqical-http

# Live deployment
https://brave-alignment-production-1706.up.railway.app
```

Every MCP tool has a matching REST endpoint. See `/agents.md` for full API docs or `/prompt` for a ready-to-use agent instruction prompt.

## API Reference

### `Logiqical.boot(options?): Promise<Logiqical>`

Non-custodial autonomous boot. Generates or loads an encrypted keystore.

| Option | Type | Description |
|--------|------|-------------|
| `network` | `string` | Network alias (default: `"avalanche"`) |
| `rpcUrl` | `string` | Custom RPC URL override |
| `arenaApiKey` | `string` | Arena API key for social/perps/tickets |
| `password` | `string` | Keystore encryption password |
| `keystoreName` | `string` | Keystore file name (default: `"agent"`) |
| `policy` | `SpendingPolicy` | Spending guardrails |

### `new Logiqical(config)`

Create an agent with existing keys.

| Option | Type | Description |
|--------|------|-------------|
| `privateKey` | `string` | Hex-encoded private key |
| `mnemonic` | `string` | BIP-39 mnemonic phrase |
| `wallet` | `string` | Wallet address (read-only mode) |
| `network` | `string` | Network alias (default: `"avalanche"`) |
| `rpcUrl` | `string` | Custom RPC URL |
| `arenaApiKey` | `string` | Arena API key |
| `policy` | `SpendingPolicy` | Spending guardrails |

### Core Methods

| Method | Description |
|--------|-------------|
| `agent.execute(buildResult)` | Policy check -> simulate -> sign -> broadcast |
| `agent.call(intent)` | Call any contract method (policy-enforced) |
| `agent.send(to, amount)` | Send native tokens (policy-enforced) |
| `agent.simulate(tx)` | Simulate via eth_call |
| `agent.getBalance()` | Get native token balance |
| `agent.signMessage(message)` | Sign arbitrary message |
| `agent.signTypedData(domain, types, value)` | EIP-712 typed data signing |
| `agent.switchNetwork(network)` | Switch chain (returns new instance, same keys) |
| `agent.getPolicy()` | Get current spending policy |
| `agent.setPolicy(policy)` | Replace spending policy |
| `agent.updatePolicy(updates)` | Partial policy update |
| `agent.getBudgetStatus()` | Spent today, remaining budget |

## CLI

Interactive agent management from the command line.

```bash
# First-time setup: create wallet, set Arena key, configure policy
logiqical setup

# Check status
logiqical status

# Show wallet address and balance
logiqical wallet

# View or edit spending policy
logiqical policy
logiqical policy max-per-tx 2.0
logiqical policy max-per-day 50.0

# Set Arena API key
logiqical config arena-key ak_live_abc123
```

## Vault Daemon

A separate signer process that holds the private key and enforces spending policies. The SDK and MCP server talk to the vault -- keys never leave the vault process.

```bash
# Start the vault (localhost:7842)
logiqical-vault

# Custom port
logiqical-vault --port 8000
```

**Security model:**
- Private key loaded once from encrypted keystore, never exposed
- Every transaction is policy-checked before signing
- Simulation via `eth_call` before broadcasting (if enabled)
- Only localhost connections accepted
- Budget tracking persists across restarts

## Skill Packs

Pre-written instruction files that teach AI agents how to use Logiqical. Drop into your agent host and it knows all 176 tools instantly.

**Claude Code / Claude Desktop:**
```bash
cp node_modules/logiqical/skills/logiqical/CLAUDE.md ~/.claude/CLAUDE.md
```

**Codex:**
```bash
cp node_modules/logiqical/skills/logiqical/CODEX.md ~/.codex/skills/logiqical.md
```

The skill packs cover every tool, the right usage patterns (check balance before trading, confirm with user before executing), safety rules, and Arena rate limits.

## Architecture

```
logiqical
├── Logiqical              # Main class -- wallet + execute() + policy
├── AgentWallet            # Generate, boot, keystore, sign, broadcast
├── PolicyEngine           # Per-tx limits, budgets, simulation, dry-run
├── Modules (22)
│   ├── SwapModule         # ARENA token buy/sell
│   ├── StakingModule      # ARENA staking + rewards
│   ├── LaunchpadModule    # Arena launchpad bonding curves
│   ├── DexModule          # Any-token swaps (LFJ DEX)
│   ├── TicketsModule      # Arena social tickets
│   ├── PerpsModule        # Perpetual futures + USDC deposit (Hyperliquid)
│   ├── BridgeModule       # Cross-chain (Li.Fi)
│   ├── SocialModule       # Arena social -- chat, threads, feed, notifications,
│   │                      #   communities, stages, livestreams, shares (78 tools)
│   ├── CopyTradingModule  # Mirror Hyperliquid wallet positions
│   ├── SignalsModule      # Market intelligence + candles
│   ├── MarketModule       # CoinGecko data
│   ├── DefiModule         # sAVAX + ERC-4626 vaults
│   └── X402Module         # x402 micropayments (create, access, pay)
├── MCP Server             # 176-tool server for AI agents
├── HTTP Server            # REST API for sandboxed agents
└── Errors                 # Typed errors with codes
```

## Key Contracts

| Contract | Address |
|----------|---------|
| ARENA Token | `0xB8d7710f7d8349A506b75dD184F05777c82dAd0C` |
| Arena Staking | `0xeFFB809d99142Ce3b51c1796c096f5b01B4aAeC4` |
| LFJ Router V2.2 | `0x18556DA13313f3532c54711497A8FedAC273220E` |
| LFJ Quoter | `0x9A550a522BBaDFB69019b0432800Ed17855A51C3` |
| Launch Contract | `0x8315f1eb449Dd4B779495C3A0b05e5d194446c6e` |
| Token Manager | `0x2196e106af476f57618373ec028924767c758464` |
| sAVAX (Benqi) | `0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE` |
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` |
| GLADIUS | `0x34a1D2105dd1b658A48EAD516A9CE3032082799C` |

All on Avalanche C-Chain (chainId: 43114).

## Features

- **Standalone** -- no backend needed, direct contract calls + API calls
- **Agent wallet** -- generate, boot from keystore, import key or mnemonic
- **execute() pattern** -- one-liner: policy -> simulate -> sign -> broadcast
- **Spending policies** -- per-tx limits, hourly/daily budgets, allowlists, dry-run
- **Transaction simulation** -- eth_call before broadcast catches reverts early
- **176 MCP tools** -- plug into Claude, Cursor, or any MCP client
- **22 modules** -- ARENA swap, staking, launchpad, DEX, tickets, perps, bridge, social (chat/threads/feed/notifications/communities/stages/livestreams/shares), signals, market, DeFi, copy trading, x402 micropayments, agent registration, feed auto-posting
- **78 social tools** -- the most comprehensive Arena social integration: threads, feed, notifications, communities, stages, livestreams, shares, DMs, group chats
- **x402 micropayments** -- create paywalled APIs, access content, pay with AVAX/ARENA/GLADIUS
- **20 EVM chains** -- Avalanche, Ethereum, Base, Arbitrum, and 16 more
- **REST API** -- self-host for sandboxed agents that can only make HTTP calls
- **Typed errors** -- `LogiqicalError` with codes like `SLIPPAGE_EXCEEDED`, `CONTRACT_REVERT`
- **Dual build** -- ESM + CJS + TypeScript declarations
- **SSRF protection** -- safe fetch with HTTPS enforcement, timeout, size limits

## Acknowledgments

SDK architecture inspired by [Evalanche](https://github.com/iJaack/Evalanche) by [@iJaack](https://github.com/iJaack) -- the execute() pattern, spending policies, keystore boot flow, and MCP server design were influenced by his work on agent tooling for Avalanche.

## Built on

- [Avalanche C-Chain](https://avax.network)
- [Arena](https://arena.social) -- Social, Perps, Launchpad, Tickets
- [LFJ (Trader Joe)](https://lfj.gg) -- DEX aggregation
- [Benqi](https://benqi.fi) -- sAVAX liquid staking
- [Li.Fi](https://li.fi) -- Cross-chain bridging
- [Hyperliquid](https://hyperliquid.xyz) -- Perpetual futures
- [CoinGecko](https://coingecko.com) -- Market data
- [ArenaPay](https://arenapay.ai) -- x402 micropayments

## License

MIT
