# Arena Agent SDK — Current Status & Roadmap

**The infrastructure that makes Arena the first DeFi ecosystem purpose-built for AI agents.**

---

## What's Live Now (Production — Deployed on Railway)

### 1. ARENA Staking Plugin

| Feature | Status | Endpoint |
|---------|--------|----------|
| Buy ARENA with AVAX | Live | GET /build/buy |
| Sell ARENA back to AVAX | Live | GET /build/sell-arena |
| Buy quote (AVAX → ARENA) | Live | GET /quote |
| Sell quote (ARENA → AVAX) | Live | GET /quote/sell |
| Stake ARENA | Live | GET /build/stake |
| Unstake ARENA + claim rewards | Live | GET /build/unstake |
| Buy + stake in one flow | Live | GET /build/buy-and-stake |
| Check AVAX + ARENA balances | Live | GET /balances |
| Check staking info + rewards | Live | GET /stake/info |
| Agent instructions | Live | GET /agent-instructions |

**How staking works:** ARENA stakers earn 2.5% of every token that graduates from the launchpad. More launchpad activity = more staker revenue. Agents stake to earn passive income from the platform.

---

### 2. Launchpad Trading Plugin

#### Discovery — Find tokens to trade

| Feature | Status | Endpoint |
|---------|--------|----------|
| Latest launches (with full metadata) | Live | GET /launchpad/recent |
| Tokens about to graduate | Live | GET /launchpad/graduating |
| Tokens already on DEX | Live | GET /launchpad/graduated |
| Trending by volume (5m/1h/4h/24h/all_time) | Live | GET /launchpad/top-volume |
| Search by name, symbol, or contract address | Live | GET /launchpad/search |
| Platform overview + stats | Live | GET /launchpad/overview |

#### Intelligence — Research before trading

| Feature | Status | Endpoint |
|---------|--------|----------|
| Full token profile (price, mcap, creator, stats) | Live | GET /launchpad/token |
| Buy/sell stats across 5m/1h/4h/12h/24h | Live | GET /launchpad/token |
| Creator analysis (twitter followers, total tokens) | Live | GET /launchpad/token |
| Market cap breakdown | Live | GET /launchpad/market-cap |
| Holder distribution with PnL | Live | GET /launchpad/holders |
| Recent trades with trader profiles | Live | GET /launchpad/activity |
| Global trades feed (all tokens) | Live | GET /launchpad/trades |
| Smart buy/sell quotes (binary search pricing) | Live | GET /launchpad/quote |

#### Trading — Execute

| Feature | Status | Endpoint |
|---------|--------|----------|
| Buy any launchpad token (auto-routes AVAX/ARENA paired) | Live | GET /launchpad/build/buy |
| Sell any launchpad token (approve + sell) | Live | GET /launchpad/build/sell |
| Portfolio tracking with real-time PnL | Live | GET /launchpad/portfolio |
| Agent instructions | Live | GET /launchpad/agent-instructions |

**Smart contract coverage:**
- Launch Contract (0x8315...) — 112,000+ AVAX-paired tokens
- Token Manager (0x2196...) — 3,700+ ARENA-paired tokens
- AVAX Helper (0x03f1...) — auto-converts AVAX↔ARENA for ARENA-paired tokens
- Auto-detection: tokenId < 100B = AVAX-paired, >= 100B = ARENA-paired

---

### 3. Swap Plugin

| Feature | Status | Endpoint |
|---------|--------|----------|
| Swap AVAX → ARENA | Live | GET /build/buy |
| Swap ARENA → AVAX | Live | GET /build/sell-arena |
| Buy quote | Live | GET /quote |
| Sell quote | Live | GET /quote/sell |
| Agent instructions | Live | GET /swap/agent-instructions |

**DEX integration:** LFJ (Trader Joe) V2.2 LBRouter + LBQuoter on Avalanche.

---

### 4. Core Infrastructure

| Feature | Status |
|---------|--------|
| Unified API key (one key for everything) | Live |
| Wallet-based key dedup (no duplicate registrations) | Live |
| Self-registration for agents | Live |
| Transaction broadcasting | Live |
| Trustless design (unsigned txs, agent signs locally) | Live |
| Server-side position tracking | Live |
| 5 smart contract integrations | Live |
| 3 agent instruction prompts | Live |
| Deployed on Railway | Live |

---

## Total: 30+ Endpoints, All Live

---

## Roadmap — What's Coming

### Phase 1: General DEX Swaps (LFJ)

**What:** Extend swap capabilities beyond ARENA. Agents can swap ANY token pair on Avalanche through LFJ (Trader Joe).

**Why:** Agents need to move between tokens freely — not just ARENA. If an agent profits on a launchpad trade and wants to swap into USDC or another token, it needs general DEX access. This keeps agents in our ecosystem for ALL their trading.

**How:** Direct on-chain contract interaction with LFJ's LBRouter and LBQuoter. No API middleman. We query the quoter for the best route, build the unsigned tx, agent signs and broadcasts.

**New endpoints:**
- GET /dex/quote?tokenIn=0x...&tokenOut=0x...&amount=1.0
- GET /dex/build/swap?wallet=0x...&tokenIn=0x...&tokenOut=0x...&amount=1.0
- Support native AVAX as tokenIn/tokenOut
- Auto-approve if needed (return [approve, swap] txs)

**Impact:** Agents become full DeFi participants on Avalanche, not limited to Arena tokens. Massive utility increase.

---

### Phase 2: Token Launching

**What:** Agents can create their own tokens on Arena's bonding curve.

**Why:** Agents go from passive traders to active ecosystem participants. Every agent-launched token = new bonding curve + new trading activity + potential graduation generating fees.

**How:** Integrate the `createToken` function from the Launch Contract. Build a tx that sets token name, symbol, description, creator fee, and deploys.

**New endpoints:**
- GET /launchpad/build/create?wallet=0x...&name=X&symbol=X&description=X&creatorFee=250
- GET /launchpad/my-tokens?wallet=0x... — tokens the agent created + their stats

**Impact:** AI agents become creators on Arena. Imagine an agent that spots a trending narrative, launches a token around it, and manages it. Every launch drives platform activity.

---

### Phase 3: Graduated Token Trading via DEX

**What:** When a token graduates from Arena's bonding curve to a DEX, agents can continue trading it seamlessly.

**Why:** Right now agents lose access to a token after graduation — our API rejects trades with "token graduated, trade on DEX instead." That's a dead end. Agents should be able to hold positions through graduation and keep trading.

**How:** Detect graduated tokens (lpDeployed=true), find their DEX pair address from token params, route trades through LFJ instead of the bonding curve. Same endpoints, automatic routing.

**Changes:**
- /launchpad/build/buy and /build/sell auto-detect graduated tokens and route through DEX
- /launchpad/quote works for both bonding curve and graduated tokens
- Portfolio tracks positions through graduation

**Impact:** Agents can ride winners from bonding curve through graduation to DEX — full lifecycle trading instead of forced exits.

---

### Phase 4: Perps Trading

**What:** Full integration with Arena's perpetual futures trading.

**Why:** Jason (Arena CEO) specifically asked "how is it doing on perps?" — Arena cares about perps volume. This covers their full product suite.

**How:** Integrate Arena's perps contracts. Build the same discover → research → execute pipeline: available markets, open interest, funding rates, position building, leverage management.

**New endpoints:**
- GET /perps/markets — available perp markets + stats
- GET /perps/position?wallet=0x... — open positions
- GET /perps/build/open?wallet=0x...&market=X&side=long&size=X&leverage=X
- GET /perps/build/close?wallet=0x...&market=X
- GET /perps/funding-rates
- Agent instructions for perps trading

**Impact:** Arena's full product suite in one SDK. Agents can trade trenches (launchpad) AND perps from the same interface.

---

### Phase 5: Signal & Event Monitoring

**What:** Real-time push notifications so agents react instead of polling.

**Why:** Right now agents have to repeatedly call our discovery endpoints to find new opportunities. That's slow and wasteful. Agents should be notified instantly when something happens.

**How:** WebSocket connections and/or webhook registrations. Agents subscribe to events and get pushed notifications.

**New capabilities:**
- Webhook: token about to graduate (graduation % > 90%)
- Webhook: volume spike on a token (5m volume > 2x average)
- Webhook: new token launch matching criteria (creator followers > 1000, etc.)
- Webhook: large trade alert (whale buy/sell above threshold)
- Webhook: perp liquidation events
- WebSocket: real-time trade feed

**Impact:** Agents become proactive — they don't search for opportunities, opportunities come to them. Faster reaction = better trades.

---

### Phase 6: Agent Performance Analytics

**What:** Track agent performance over time — win rate, PnL, best strategies, worst trades.

**Why:** Agents that can analyze their own performance can improve. This is the foundation for self-improving trading agents.

**How:** Log every trade an agent makes through our API. Aggregate into performance metrics. Expose via endpoints.

**New endpoints:**
- GET /analytics/performance?wallet=0x... — overall PnL, win rate, avg hold time
- GET /analytics/trades?wallet=0x... — full trade history with entry/exit prices
- GET /analytics/best-strategies — what's working across all agents (anonymized)

**Impact:** Agents learn from their own trading. Over time they get better — not just executing, but improving.

---

### Phase 7: The SDK Package

**What:** Package everything into a self-contained npm module. No hosted API dependency.

**Why:** The Arena technician's concern was right — agents shouldn't depend on a third-party server. The SDK runs locally with the agent. Everything is direct contract interaction + on-chain data.

**How:**
```javascript
import { ArenaAgent } from "@arena/agent-sdk";

const agent = new ArenaAgent({
  wallet: "0x...",
  rpc: "https://your-rpc.com"
});

// The agent now knows everything about Arena
// No prompts. No instructions. No external API.

// Discover
const trending = await agent.launchpad.topVolume("1h", 10);

// Research
const token = await agent.launchpad.getToken(trending[0].tokenId);
const holders = await agent.launchpad.getHolders(token.address);

// Trade
const buyTx = await agent.launchpad.buildBuy(token.tokenId, "0.5");
const signed = await wallet.signTransaction(buyTx);
await agent.broadcast(signed);

// Stake
await agent.staking.buyAndStake("1.0");

// Swap any token
await agent.dex.swap("AVAX", "USDC", "10.0");

// Launch a token
await agent.launchpad.createToken({
  name: "My Token",
  symbol: "MTK",
  description: "Launched by an AI agent",
  creatorFee: 250
});

// Perps
await agent.perps.openLong("AVAX-USD", "100", 5);
```

**Impact:** Any developer adds full Arena capabilities to their agent in 3 lines of code. Zero server dependency. The agent launches and instantly knows everything — trenches, perps, token launching, staking, DEX swaps. Self-configuring. Self-improving over time.

---

### Phase 8: Multi-Chain Expansion

**What:** Extend the SDK beyond Avalanche to any chain Arena expands to.

**Why:** If Arena launches on other chains (or bridges), the SDK should follow. Future-proofing.

**How:** Abstract chain-specific logic (RPC, contract addresses, DEX routing) behind a chain config. Same agent interface, different chain.

```javascript
const agent = new ArenaAgent({
  chain: "avalanche", // or "arbitrum", "base", etc.
  wallet: "0x..."
});
```

**Impact:** The SDK scales with Arena. One codebase, any chain.

---

## Summary

| Phase | Feature | Status |
|-------|---------|--------|
| - | ARENA Staking (buy, sell, stake, unstake) | **LIVE** |
| - | Launchpad Trading (discover, research, trade) | **LIVE** |
| - | ARENA/AVAX Swaps | **LIVE** |
| - | Core Infrastructure (auth, broadcasting, tracking) | **LIVE** |
| 1 | General DEX Swaps (any token on LFJ) | Planned |
| 2 | Token Launching (agents create tokens) | Planned |
| 3 | Graduated Token Trading via DEX | Planned |
| 4 | Perps Trading | Planned |
| 5 | Signal & Event Monitoring (webhooks) | Planned |
| 6 | Agent Performance Analytics | Planned |
| 7 | SDK Package (npm, no server dependency) | Planned |
| 8 | Multi-Chain Expansion | Planned |

---

**Live API:** https://brave-alignment-production-1706.up.railway.app
**GitHub:** https://github.com/OlaCryto/arena-agent-plugin

---

*Built on Avalanche. Built for Arena. Built for the agents.*
