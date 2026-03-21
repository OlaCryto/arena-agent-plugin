# Logiqical

The standalone agent wallet SDK for AI agents on Avalanche and Arena. 176 MCP tools, 22 modules, zero backend dependency.

**Swap ARENA tokens, stake for rewards, trade launchpad tokens, bridge cross-chain, trade perps, copy trade top wallets, full Arena social (chat, threads, feed, notifications, communities, stages, livestreams, shares), market signals, DeFi vaults, x402 micropayments** -- all from a single SDK with built-in wallet, spending policies, and transaction simulation.

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
# As a dependency
npm install logiqical

# Or globally (unlocks CLI + vault)
npm install -g logiqical

# Or one-click
curl -fsSL https://raw.githubusercontent.com/OlaCryto/arena-agent-plugin/master/install.sh | bash
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
  arenaApiKey: "ak_live_...",  // for Arena Social, Perps, Tickets
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

**Policy check -> Simulate -> Sign -> Broadcast -> Record spend**

```typescript
// Works with ANY module's build output
await agent.execute(agent.swap.buildBuy(agent.address, "0.5"));
await agent.execute(agent.staking.buildStake(agent.address, "1000"));
await agent.execute(agent.launchpad.buildBuy(agent.address, "42", "0.1"));
await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));
await agent.execute(agent.tickets.buildBuyTx(agent.address, "0xSubject"));
await agent.execute(agent.defi.buildSAvaxStake("5.0"));
```

## Modules (22)

### `agent.swap` -- ARENA Token Buy & Sell

| Method | Description |
|--------|-------------|
| `getBalances(wallet)` | Get AVAX and ARENA balances |
| `quote(avax)` | Quote AVAX -> ARENA |
| `sellQuote(arena)` | Quote ARENA -> AVAX |
| `buildBuy(wallet, avax, slippage?)` | Buy ARENA with AVAX |
| `buildSell(wallet, amount, slippage?)` | Sell ARENA for AVAX (`"max"` for all) |

### `agent.staking` -- Stake ARENA for Rewards

| Method | Description |
|--------|-------------|
| `getInfo(wallet)` | Staked amount, pending rewards, APY |
| `buildStake(wallet, amount)` | Stake ARENA tokens |
| `buildUnstake(wallet, amount)` | Unstake and claim rewards |
| `buildBuyAndStake(wallet, avax)` | Buy ARENA + stake in one flow |

### `agent.launchpad` -- Arena Launchpad (Bonding Curve Tokens)

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
| `buildBuy(wallet, tokenId, avax, slippage?)` | Buy launchpad token |
| `buildSell(wallet, tokenId, amount, slippage?)` | Sell token (`"max"` for all) |

#### Token Launch
| Method | Description |
|--------|-------------|
| `launch(wallet, name, symbol, imageBase64?, paymentToken?, initialBuyAvax?)` | Launch a new token on Arena |

### `agent.dex` -- Swap Any Avalanche Token

| Method | Description |
|--------|-------------|
| `getTokens()` | List known tokens (AVAX, USDC, USDT, JOE, etc.) |
| `getTokenInfo(address)` | On-chain token metadata |
| `quote(from, to, amount)` | Quote any token pair |
| `getBalance(wallet, token)` | Any token balance |
| `buildSwap(wallet, from, to, amount, slippage?)` | Swap any pair |

### `agent.tickets` -- Arena Tickets

| Method | Description |
|--------|-------------|
| `getBuyPrice(subject, amount?)` | Get buy price for tickets |
| `getSellPrice(subject, amount?)` | Get sell price for tickets |
| `getBalance(subject, user)` | Check ticket balance |
| `getSupply(subject)` | Total ticket supply |
| `getFees()` | Fee structure |
| `buildBuyTx(wallet, subject, amount?)` | Buy tickets |
| `buildSellTx(wallet, subject, amount?)` | Sell tickets |

### `agent.perps` -- Arena Perps (Hyperliquid)

Trade 250+ perpetual futures with up to 50x leverage.

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
| `getOpenOrders(wallet)` | Open orders by wallet |
| `getPositions(wallet)` | Positions + margin summary |
| `getAuthStatus()` | Check auth status |
| `getAuthPayload(step, wallet)` | Get auth signing payload |
| `submitAuthSignature(step, sig, wallet, meta)` | Submit signed auth |
| `enableHip3()` | Enable HIP-3 |
| `getTradeExecutions()` | Trade history |
| `getArbitrumETHBalance(wallet)` | ETH balance on Arbitrum |
| `getArbitrumUSDCBalance(wallet)` | USDC balance on Arbitrum |
| `getDepositInfo()` | Hyperliquid deposit info |
| `buildDepositUSDC(amount)` | Build USDC deposit tx |

### `agent.bridge` -- Cross-Chain Bridging (Li.Fi)

| Method | Description |
|--------|-------------|
| `getInfo()` | Supported chains, USDC addresses |
| `getChains()` | All supported bridge chains |
| `getTokens(chains)` | Tokens available on chains |
| `getToken(chainId, address)` | Token info on a chain |
| `getConnections(from, to, fromToken, toToken)` | Available connections |
| `getQuote(...)` | Bridge quote with transaction |
| `getRoutes(...)` | Multiple route options |
| `getStatus(txHash, fromChain, toChain)` | Check transfer status |

### `agent.social` -- Arena Social (78 tools)

Complete Arena social integration -- chat, threads, feed, notifications, communities, stages, livestreams, shares.

#### Users & Profile
| Method | Description |
|--------|-------------|
| `searchUsers(query)` | Search Arena users |
| `getUserByHandle(handle)` | Get user by handle |
| `getUserProfile(handle)` | Full profile by handle |
| `getUserById(id)` | Get user by ID |
| `getMe()` | Your Arena profile |
| `getTopUsers()` | Top Arena users |
| `updateProfile(params)` | Update profile |
| `updateBanner(url)` | Update banner image |
| `follow(userId)` / `unfollow(userId)` | Follow/unfollow |
| `getFollowers(userId, page?, pageSize?)` | User's followers |
| `getFollowing(userId, page?, pageSize?)` | User's following |

#### Threads & Feed
| Method | Description |
|--------|-------------|
| `createThread(content)` | Create a post |
| `answerThread(content, threadId, userId)` | Reply to a thread |
| `getThread(threadId)` | Get thread details |
| `getThreadAnswers(threadId)` | Get thread replies |
| `getNestedAnswers(answerId)` | Get nested replies |
| `likeThread(threadId)` / `unlikeThread(threadId)` | Like/unlike |
| `repost(threadId)` | Repost a thread |
| `deleteRepost(threadId)` | Delete a repost |
| `quoteThread(threadId, content)` | Quote thread |
| `deleteThread(threadId)` | Delete a thread |
| `getMyFeed()` | Your personalized feed |
| `getTrendingPosts()` | Trending posts |
| `getUserThreads(userId)` | User's posts |

#### Chat & Messaging
| Method | Description |
|--------|-------------|
| `getConversations()` | List all conversations |
| `sendMessage(groupId, text, replyId?)` | Send a message |
| `getMessages(groupId, after?)` | Get newer messages |
| `getOlderMessages(groupId, before?)` | Get older messages |
| `getDirectMessages()` | List DMs |
| `getGroupChats()` | List group chats |
| `getGroupInfo(groupId)` | Group details |
| `getMembers(groupId)` | Group members |
| `getOrCreateDM(userId)` | Get or create DM |
| `acceptChat(groupId)` | Accept chat request |
| `searchMessages(q, groupId)` | Search messages |
| `react(messageId, groupId, reaction)` | React to message |
| `unreact(messageId, groupId, reaction)` | Remove reaction |
| `leaveChat(groupId)` | Leave a chat |
| `searchRooms(q)` | Search rooms |
| `searchDMs(q)` | Search DMs |
| `searchProjectChats(q)` | Search project chats |
| `pinGroup(groupId)` | Pin a group |
| `getChatSettings(groupId)` | Get chat settings |
| `updateChatSettings(groupId, settings)` | Update chat settings |
| `getMessagesAround(groupId, messageId)` | Messages around a specific message |
| `getUnreadMessages(groupId)` | Unread messages |
| `getMentionStatus(groupId)` | Mention status |
| `muteGroup(groupId, muted)` | Mute/unmute group |
| `getChatRequests()` | Pending chat requests |

#### Notifications
| Method | Description |
|--------|-------------|
| `getNotifications()` | All notifications |
| `getUnseenNotifications()` | Unseen count |
| `markNotificationSeen(id)` | Mark one seen |
| `markAllNotificationsSeen()` | Mark all seen |

#### Communities
| Method | Description |
|--------|-------------|
| `getTopCommunities()` | Top communities |
| `getNewCommunities()` | New communities |
| `searchCommunities(q)` | Search communities |
| `getCommunityFeed(communityId)` | Community feed |
| `followCommunity(id)` / `unfollowCommunity(id)` | Follow/unfollow |

#### Shares & Earnings
| Method | Description |
|--------|-------------|
| `getSharesStats(userId)` | Share stats |
| `getShareHolders(userId, page?, pageSize?)` | Shareholders |
| `getHoldings(page?, pageSize?)` | Your holdings |
| `getEarningsBreakdown()` | Earnings breakdown |
| `getHolderAddresses(userId)` | Holder addresses |

#### Stages (Audio Rooms)
| Method | Description |
|--------|-------------|
| `createStage(params)` | Create a stage |
| `startStage(stageId)` | Start a stage |
| `endStage(stageId)` | End a stage |
| `getActiveStages()` | List active stages |
| `getStageInfo(stageId)` | Stage details |
| `joinStage(stageId)` | Join a stage |
| `leaveStage(stageId)` | Leave a stage |

#### Livestreams
| Method | Description |
|--------|-------------|
| `createLivestream(params)` | Create a livestream |
| `startLivestream(streamId)` | Start streaming |
| `endLivestream(streamId)` | End livestream |
| `getActiveLivestreams()` | List active streams |

#### Trade Posting
| Method | Description |
|--------|-------------|
| `postTradeUpdate(params)` | Auto-post trade update to feed |

### `agent.signals` -- Signals Intelligence

| Method | Description |
|--------|-------------|
| `getMarketSignal(coin)` | Price, funding, OI, volume signal |
| `getTechnicalSignal(coin, interval?)` | SMA, RSI, trend, support/resistance |
| `getWhalePositions(coin, minUsd?)` | Whale positions from orderbook |
| `getFundingExtremes(count?)` | Funding rate extremes |
| `summary(coin)` | Full signal digest + verdict |
| `scan(count?)` | Scan all markets for opportunities |
| `getAssetContexts()` | All asset contexts |
| `getCandles(coin, interval, count)` | OHLCV candle data |

### `agent.market` -- Market Data (CoinGecko)

| Method | Description |
|--------|-------------|
| `price(ids)` | Get price, 24h change, market cap, volume |
| `trending()` | Trending coins |
| `markets(count?, page?)` | Top coins by market cap |
| `search(query)` | Search coins by name/symbol |
| `avaxPrice()` | AVAX price + 24h change |
| `arenaPrice()` | ARENA price + 24h change |

### `agent.defi` -- DeFi (sAVAX + ERC-4626 Vaults)

| Method | Description |
|--------|-------------|
| `sAvaxInfo(wallet?)` | Exchange rate, total staked, your balance |
| `sAvaxStakeQuote(avax)` | Quote AVAX -> sAVAX |
| `buildSAvaxStake(avax)` | Stake AVAX -> sAVAX |
| `buildSAvaxUnstake(wallet, amount)` | Request unstake sAVAX |
| `vaultInfo(vaultAddress, wallet?)` | ERC-4626 vault info |
| `vaultDepositQuote(vaultAddress, amount)` | Quote vault deposit |
| `buildVaultDeposit(wallet, vaultAddress, amount)` | Deposit into vault |
| `buildVaultWithdraw(wallet, vaultAddress, amount)` | Withdraw from vault |

### `agent.copyTrading` -- Copy Trading

| Method | Description |
|--------|-------------|
| `getTargetPositions(wallet)` | Target wallet positions |
| `getAgentPositions(wallet)` | Your agent's positions |
| `calculateMirrorOrders(target, agent, scale?)` | Calculate mirror orders |
| `executeMirrorOrders(orders, prices)` | Execute mirror orders |
| `copyOnce(target, agent, scale?)` | One-shot copy trade |

### `agent.x402` -- x402 Micropayments

Create and access paywalled APIs using Arena's x402 protocol.

| Method | Description |
|--------|-------------|
| `createApi(params)` | Create a paywalled API endpoint |
| `access(apiId)` | Get payment instructions for an API |
| `buildPayment(instructions)` | Build payment tx (auto-detects AVAX vs ERC-20) |

Supported payment tokens: AVAX, ARENA (`0xB8d7...dAd0C`), GLADIUS (`0x34a1...799C`).

### `SocialModule.registerAgent()` -- Agent Registration

```typescript
const registration = await SocialModule.registerAgent({
  name: "My Trading Bot",
  handle: "my-trading-bot",
  address: agent.address,
  bio: "Autonomous trading agent on Avalanche",
});
console.log(registration.apiKey); // Save immediately!
```

## Spending Policies

```typescript
const agent = await Logiqical.boot({
  policy: {
    maxPerTx: "1.0",
    maxPerHour: "5.0",
    maxPerDay: "20.0",
    allowedContracts: ["0x..."],
    simulateBeforeSend: true,
    dryRun: false,
  },
});

const budget = agent.getBudgetStatus();
agent.updatePolicy({ maxPerTx: "2.0" });
```

## MCP Server (176 Tools)

```bash
npx logiqical-mcp
```

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
| Arena Perps | 20 | Orders, positions, leverage, auth, trade history, USDC deposit |
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

## Multi-Chain Support

20 EVM chains in the built-in registry:

**Supported chains:** Avalanche, Fuji, Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Fantom, Gnosis, zkSync Era, Linea, Scroll, Blast, Mantle, Celo, Moonbeam, Sei, Mode, Aurora

## CLI

```bash
logiqical setup              # Interactive 4-step onboarding
logiqical wallet             # Show address + balance
logiqical status             # Full agent status
logiqical policy             # View spending policy
logiqical config arena-key ak_live_abc123  # Set Arena API key
```

## Vault Daemon

Separate signer process -- keys never leave the vault. Policy enforcement at the signing boundary.

```bash
logiqical-vault              # Start on localhost:7842
logiqical-vault --port 8000  # Custom port
```

## Skill Packs

Drop-in instruction files that teach AI agents all 176 tools:

```bash
# Claude Code
cp node_modules/logiqical/skills/logiqical/CLAUDE.md ~/.claude/CLAUDE.md

# Codex
cp node_modules/logiqical/skills/logiqical/CODEX.md ~/.codex/skills/logiqical.md
```

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
│   ├── SocialModule       # Arena social (78 tools)
│   ├── CopyTradingModule  # Mirror Hyperliquid wallet positions
│   ├── SignalsModule      # Market intelligence + candles
│   ├── MarketModule       # CoinGecko data
│   ├── DefiModule         # sAVAX + ERC-4626 vaults
│   └── X402Module         # x402 micropayments
├── MCP Server             # 176-tool server for AI agents
├── HTTP Server            # REST API for sandboxed agents
└── Errors                 # Typed errors with codes
```

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
