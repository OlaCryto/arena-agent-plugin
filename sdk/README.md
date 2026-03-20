# Logiqical

The standalone agent wallet SDK for AI agents on Avalanche and Arena. 88 MCP tools, 11 modules, zero backend dependency.

**Swap ARENA tokens, stake for rewards, trade launchpad tokens, bridge cross-chain, trade perps, chat on Arena Social, track whale signals** — all from a single SDK with built-in wallet, spending policies, and transaction simulation.

```typescript
import { Logiqical } from "logiqical";

const agent = await Logiqical.boot({
  policy: { maxPerTx: "1.0", maxPerDay: "10.0", simulateBeforeSend: true },
});

console.log("Agent:", agent.address);

// One-liner: policy check + simulate + sign + broadcast
await agent.execute(agent.swap.buildBuy(agent.address, "0.5"));
await agent.execute(agent.staking.buildStake(agent.address, "max"));
await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));
```

## Install

```bash
npm install logiqical
```

## Quick Start

### Option 1: Auto-generate wallet (persisted to keystore)

```typescript
import { Logiqical } from "logiqical";

// First run: generates a new wallet + saves encrypted keystore
// Subsequent runs: loads the same wallet from keystore
const agent = await Logiqical.boot();

console.log("Address:", agent.address);
console.log("Balance:", await agent.getBalance(), "AVAX");
```

### Option 2: Import existing wallet

```typescript
const agent = new Logiqical({
  privateKey: "0x...",
  arenaApiKey: "arena_...",  // for Arena Social, Perps, Tickets
});
```

### Option 3: From mnemonic

```typescript
const agent = new Logiqical({
  mnemonic: "word1 word2 ... word12",
});
```

### Option 4: Read-only (no signing)

```typescript
const agent = new Logiqical({ wallet: "0x..." });

// Can read data, but cannot execute transactions
const info = await agent.staking.getInfo(agent.address);
const quote = await agent.dex.quote("AVAX", "USDC", "1.0");
```

## Core Pattern: `execute()`

Every module returns unsigned transactions via `build*()` methods. The `execute()` method handles the entire flow:

**Policy check &rarr; Simulate &rarr; Sign &rarr; Broadcast &rarr; Record spend**

```typescript
// Works with ANY module's build output
await agent.execute(agent.swap.buildBuy(agent.address, "0.5"));
await agent.execute(agent.staking.buildStake(agent.address, "1000"));
await agent.execute(agent.launchpad.buildBuy(agent.address, "42", "0.1"));
await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));
await agent.execute(agent.tickets.buildBuyTx(agent.address, "0xSubject"));
await agent.execute(agent.defi.buildSAvaxStake("5.0"));
```

## Modules

### `agent.swap` — ARENA Token Buy & Sell

Buy and sell ARENA tokens on the LFJ DEX with one-liner execution.

| Method | Description |
|--------|-------------|
| `getBalances(wallet)` | Get AVAX and ARENA balances |
| `quote(avax)` | Quote AVAX &rarr; ARENA |
| `sellQuote(arena)` | Quote ARENA &rarr; AVAX |
| `buildBuy(wallet, avax, slippage?)` | Buy ARENA with AVAX |
| `buildSell(wallet, amount, slippage?)` | Sell ARENA for AVAX (`"max"` for all) |

```typescript
const quote = await agent.swap.quote("1.0");
console.log(`1 AVAX = ${quote.arenaOut} ARENA`);

await agent.execute(agent.swap.buildBuy(agent.address, "1.0"));
```

### `agent.staking` — Stake ARENA for Rewards

Stake ARENA tokens to earn rewards. Includes a buy-and-stake combo for one-click entry.

| Method | Description |
|--------|-------------|
| `getInfo(wallet)` | Staked amount, pending rewards, APY |
| `buildStake(wallet, amount)` | Stake ARENA tokens |
| `buildUnstake(wallet, amount)` | Unstake and claim rewards |
| `buildBuyAndStake(wallet, avax)` | Buy ARENA + stake in one flow |

```typescript
const info = await agent.staking.getInfo(agent.address);
console.log(`Staked: ${info.staked} ARENA, Rewards: ${info.pendingRewards}`);

// Buy and stake in one execution
await agent.execute(agent.staking.buildBuyAndStake(agent.address, "2.0"));
```

### `agent.launchpad` — Arena Launchpad (Bonding Curve Tokens)

Discover, research, and trade tokens on Arena's launchpad bonding curves. Automatically routes graduated tokens through Arena's DEX.

#### Discovery
| Method | Description |
|--------|-------------|
| `getRecent(count?, type?)` | Latest launched tokens |
| `getTopVolume(timeframe?, count?)` | Trending by volume (5m/1h/4h/24h) |
| `getGraduating(count?)` | Tokens about to graduate to DEX |
| `getGraduated(count?)` | Already graduated tokens |
| `search(query)` | Find by name, symbol, or address |

#### Intelligence
| Method | Description |
|--------|-------------|
| `getToken(tokenId?, address?)` | Full token profile + stats |
| `getHolders(address?, tokenId?, count?)` | Top holders with PnL |
| `getActivity(tokenId?, address?, count?)` | Recent trade history |
| `getTrades(count?, offset?)` | Global trade feed |
| `quote(tokenId, side, amount)` | Bonding curve price quote |
| `getPortfolio(wallet)` | Your tracked positions |
| `getMarketCap(tokenId)` | Market cap breakdown |
| `getOverview()` | Platform stats |

#### Trading
| Method | Description |
|--------|-------------|
| `buildBuy(wallet, tokenId, avax, slippage?)` | Buy launchpad token (auto-routes graduated via Arena DEX) |
| `buildSell(wallet, tokenId, amount, slippage?)` | Sell token (`"max"` for all, auto-routes graduated) |

#### Token Launch
| Method | Description |
|--------|-------------|
| `launch(wallet, name, symbol, imageBase64?, paymentToken?, initialBuyAvax?)` | Launch a new token on Arena |
| `uploadImage(imageBase64, fileType?)` | Upload image to Arena CDN |
| `buildCreate(wallet, name, symbol, paymentToken?, initialBuyAvax?)` | Build createToken tx only |

```typescript
// Find trending tokens
const hot = await agent.launchpad.getTopVolume("1h");
console.log("Trending:", hot.map(t => t.name));

// Buy a launchpad token
await agent.execute(agent.launchpad.buildBuy(agent.address, "42", "0.5"));

// Launch your own token
const result = await agent.launchpad.launch(
  agent.address, "My Token", "MTK", imageBase64, "arena"
);
await agent.execute(result);
```

### `agent.dex` — Swap Any Avalanche Token

Swap any token pair on Avalanche via the LFJ DEX aggregator.

| Method | Description |
|--------|-------------|
| `getTokens()` | List known tokens (AVAX, USDC, USDT, JOE, etc.) |
| `getTokenInfo(address)` | On-chain token metadata |
| `quote(from, to, amount)` | Quote any token pair |
| `getBalance(wallet, token)` | Any token balance |
| `buildSwap(wallet, from, to, amount, slippage?)` | Swap any pair |

```typescript
const quote = await agent.dex.quote("AVAX", "USDC", "10.0");
console.log(`10 AVAX = ${quote.amountOut} USDC`);

await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "10.0"));
```

### `agent.tickets` — Arena Tickets (Buy & Sell)

Trade Arena social tickets — buy and sell tickets tied to Arena users.

| Method | Description |
|--------|-------------|
| `getBuyPrice(subject, amount?)` | Get buy price for tickets |
| `getSellPrice(subject, amount?)` | Get sell price for tickets |
| `getBalance(subject, user)` | Check ticket balance |
| `getSupply(subject)` | Total ticket supply |
| `getFees()` | Fee structure |
| `buildBuyTx(wallet, subject, amount?)` | Buy tickets |
| `buildSellTx(wallet, subject, amount?)` | Sell tickets |

```typescript
const price = await agent.tickets.getBuyPrice("0xSubject");
console.log(`Buy price: ${price.priceAvax} AVAX`);

await agent.execute(agent.tickets.buildBuyTx(agent.address, "0xSubject"));
```

### `agent.perps` — Arena Perps (Hyperliquid)

Trade 250+ perpetual futures markets via Arena's Hyperliquid integration.

| Method | Description |
|--------|-------------|
| `register()` | Register for perps trading |
| `getRegistrationStatus()` | Check registration |
| `getWalletAddress()` | Get Hyperliquid wallet |
| `getTradingPairs()` | All 250+ trading pairs |
| `updateLeverage(symbol, leverage, type?)` | Set leverage (1-50x) |
| `placeOrder(orders)` | Place orders |
| `cancelOrders(cancels)` | Cancel open orders |
| `closePosition(symbol, side, size, price, pct?)` | Close a position |
| `getOrders()` | View open orders |
| `getPositions(wallet)` | Positions + margin summary |

```typescript
await agent.perps.register();
await agent.perps.updateLeverage("ETH", 10, "cross");
await agent.perps.placeOrder([{
  coin: "ETH", isBuy: true, sz: 0.1, limitPx: 3500,
  orderType: { limit: { tif: "Gtc" } }, reduceOnly: false,
}]);
```

### `agent.bridge` — Cross-Chain Bridging (Li.Fi)

Bridge tokens across 20+ EVM chains via Li.Fi aggregator.

| Method | Description |
|--------|-------------|
| `getInfo()` | Supported chains, USDC addresses |
| `getChains()` | All supported bridge chains |
| `getTokens(chains)` | Tokens available on chains |
| `getQuote(fromChain, toChain, fromToken, toToken, amount, address, toAddress?, slippage?)` | Bridge quote with transaction |
| `getRoutes(fromChain, toChain, fromToken, toToken, amount, address)` | Multiple route options |
| `getStatus(txHash, fromChain, toChain)` | Check transfer status |

```typescript
const quote = await agent.bridge.getQuote(
  43114, 42161, // Avalanche → Arbitrum
  "0xNATIVE", "0xNATIVE", // AVAX → ETH
  "10.0", agent.address
);
```

### `agent.social` — Arena Social (Chat, Posts, Follow)

Full Arena social integration — search users, chat, post threads, follow/unfollow.

| Method | Description |
|--------|-------------|
| `searchUsers(query)` | Search Arena users |
| `getUserByHandle(handle)` | Get user by handle |
| `getMe()` | Your Arena profile |
| `getTopUsers()` | Top Arena users |
| `follow(userId)` / `unfollow(userId)` | Follow/unfollow |
| `updateProfile(params)` | Update profile |
| `getConversations()` | List chat conversations |
| `sendMessage(groupId, text, replyId?)` | Send a chat message |
| `getMessages(groupId, after?)` | Read messages |
| `createThread(content, replyToId?)` | Create a post |
| `likeThread(threadId)` | Like a thread |

```typescript
const me = await agent.social.getMe();
await agent.social.createThread("Just bought 1000 ARENA. LFG!");
await agent.social.follow("user-uuid");
```

### `agent.signals` — Signals Intelligence

Real-time market signals — whale tracking, funding rates, technicals, opportunity scanning.

| Method | Description |
|--------|-------------|
| `getMarketSignal(coin)` | Price, funding, OI, volume signal |
| `getTechnicalSignal(coin, interval?)` | SMA, RSI, trend, support/resistance |
| `getWhalePositions(coin, minUsd?)` | Whale positions from orderbook |
| `getFundingExtremes(count?)` | Funding rate extremes across all markets |
| `summary(coin)` | Full signal digest + verdict |
| `scan(count?)` | Scan all markets for top opportunities |

```typescript
const signal = await agent.signals.summary("ETH");
console.log(`Verdict: ${signal.verdict}`);

const opportunities = await agent.signals.scan(5);
```

### `agent.market` — Market Data (CoinGecko)

Real-time prices, trending coins, and market data via CoinGecko.

| Method | Description |
|--------|-------------|
| `price(ids)` | Get price, 24h change, market cap, volume |
| `trending()` | Trending coins |
| `markets(count?, page?)` | Top coins by market cap |
| `search(query)` | Search coins by name/symbol |
| `avaxPrice()` | AVAX price + 24h change |
| `arenaPrice()` | ARENA price + 24h change |

```typescript
const avax = await agent.market.avaxPrice();
console.log(`AVAX: $${avax.usd} (${avax.change24h.toFixed(1)}%)`);
```

### `agent.defi` — DeFi (sAVAX Liquid Staking + ERC-4626 Vaults)

Liquid staking via Benqi (sAVAX) and any ERC-4626 vault on Avalanche.

| Method | Description |
|--------|-------------|
| `sAvaxInfo(wallet?)` | Exchange rate, total staked, your balance |
| `sAvaxStakeQuote(avax)` | Quote AVAX &rarr; sAVAX |
| `buildSAvaxStake(avax)` | Stake AVAX &rarr; sAVAX |
| `buildSAvaxUnstake(wallet, amount)` | Request unstake sAVAX |
| `vaultInfo(vaultAddress, wallet?)` | ERC-4626 vault info |
| `vaultDepositQuote(vaultAddress, amount)` | Quote vault deposit |
| `buildVaultDeposit(wallet, vaultAddress, amount)` | Deposit into vault |
| `buildVaultWithdraw(wallet, vaultAddress, amount)` | Withdraw from vault |

```typescript
await agent.execute(agent.defi.buildSAvaxStake("10.0"));
```

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
console.log(`Spent today: ${budget.spentToday} / ${budget.dailyLimit} AVAX`);

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

## MCP Server (88 Tools)

Run as an MCP server for Claude, Cursor, or any MCP-compatible client.

```bash
npx logiqical-mcp
```

Set environment variables:

```bash
LOGIQICAL_PRIVATE_KEY=0x...     # or omit to auto-generate
LOGIQICAL_NETWORK=avalanche     # default
ARENA_API_KEY=arena_...         # for social, perps, tickets
```

Or add to your MCP config:

```json
{
  "mcpServers": {
    "logiqical": {
      "command": "npx",
      "args": ["logiqical-mcp"],
      "env": {
        "LOGIQICAL_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### All 88 MCP Tools

| Category | Tools | Description |
|----------|-------|-------------|
| Wallet | 4 | Get address, balance, send AVAX, sign messages |
| ARENA Token | 6 | Buy/sell ARENA, quotes, balances |
| ARENA Staking | 4 | Stake, unstake, buy-and-stake, info |
| DEX | 6 | Swap any token, quotes, balances, token list, info |
| Arena Launchpad | 6 | Buy/sell launchpad tokens, quotes, discovery |
| Arena Tickets | 8 | Buy/sell tickets, prices, balances, supply, fees |
| Cross-Chain Bridge | 8 | Bridge quotes, routes, status, chains, tokens, info |
| Arena Perps | 9 | Place/cancel orders, positions, leverage, register |
| Signals Intelligence | 6 | Market signals, technicals, whales, funding, scan |
| Arena Social | 13 | Chat, DMs, posts, follow, search, profile |
| Market Data | 6 | Prices, trending, top coins, search, AVAX/ARENA price |
| DeFi | 8 | sAVAX staking, vault deposit/withdraw, quotes |
| Policy | 3 | Get/set policy, budget status |
| Contract Call | 1 | Call any smart contract method |
| **Total** | **88** | |

## Multi-Chain Support

20 EVM chains in the built-in registry:

```typescript
// Default: Avalanche
const agent = await Logiqical.boot();

// Use any chain
const agent = new Logiqical({ privateKey: "0x...", network: "base" });

// Switch at runtime
const baseAgent = agent.switchNetwork("arbitrum");
```

**Supported chains:** Avalanche, Fuji, Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Fantom, Gnosis, zkSync Era, Linea, Scroll, Blast, Mantle, Celo, Moonbeam, Sei, Mode, Aurora

## Architecture

```
logiqical
├── Logiqical           # Main class — wallet + execute() + policy
├── AgentWallet         # Generate, boot, keystore, sign, broadcast
├── PolicyEngine        # Per-tx limits, budgets, simulation, dry-run
├── Modules
│   ├── SwapModule      # ARENA token buy/sell
│   ├── StakingModule   # ARENA staking + rewards
│   ├── LaunchpadModule # Arena launchpad bonding curves
│   ├── DexModule       # Any-token swaps (LFJ DEX)
│   ├── TicketsModule   # Arena social tickets
│   ├── PerpsModule     # Perpetual futures (Hyperliquid)
│   ├── BridgeModule    # Cross-chain (Li.Fi)
│   ├── SocialModule    # Arena chat, posts, follow
│   ├── SignalsModule   # Market intelligence
│   ├── MarketModule    # CoinGecko data
│   └── DefiModule      # sAVAX + ERC-4626 vaults
├── MCP Server          # 88-tool server for AI agents
└── Errors              # Typed errors with codes
```

## Features

- **Standalone** — no backend needed, direct contract calls + API calls
- **Agent wallet** — generate, boot from keystore, import key or mnemonic
- **execute() pattern** — one-liner: policy &rarr; simulate &rarr; sign &rarr; broadcast
- **Spending policies** — per-tx limits, hourly/daily budgets, allowlists, dry-run
- **Transaction simulation** — eth_call before broadcast catches reverts early
- **88 MCP tools** — plug into Claude, Cursor, or any MCP client
- **11 modules** — ARENA swap, staking, launchpad, DEX, tickets, perps, bridge, social, signals, market, DeFi
- **20 EVM chains** — Avalanche, Ethereum, Base, Arbitrum, and 16 more
- **Typed errors** — `LogiqicalError` with codes like `SLIPPAGE_EXCEEDED`, `CONTRACT_REVERT`
- **Dual build** — ESM + CJS + TypeScript declarations
- **SSRF protection** — safe fetch with HTTPS enforcement, timeout, size limits

## Acknowledgments

SDK architecture inspired by [Evalanche](https://github.com/iJaack/Evalanche) by [@iJaack](https://github.com/iJaack) — the `execute()` pattern, spending policies, keystore boot flow, and MCP server design were influenced by his work on agent tooling for Avalanche.

## Built on

- [Avalanche C-Chain](https://avax.network)
- [Arena](https://arena.social) — Social, Perps, Launchpad, Tickets
- [LFJ (Trader Joe)](https://lfj.gg) — DEX aggregation
- [Benqi](https://benqi.fi) — sAVAX liquid staking
- [Li.Fi](https://li.fi) — Cross-chain bridging
- [Hyperliquid](https://hyperliquid.xyz) — Perpetual futures
- [CoinGecko](https://coingecko.com) — Market data

## License

MIT
