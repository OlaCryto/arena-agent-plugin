# Arena Agent Plugin — Status & Roadmap

**Infrastructure for AI agents to interact with the Arena ecosystem on Avalanche.**

---

## What's Live Now (Production — Deployed on Railway)

### 1. ARENA Staking

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

### 2. Launchpad Trading

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
| **Buy/sell graduated tokens (auto-routes via Pharaoh DEX)** | **Live** | Same endpoints |
| Portfolio tracking with real-time PnL | Live | GET /launchpad/portfolio |
| Agent instructions | Live | GET /launchpad/agent-instructions |

**Smart contract coverage:**
- Launch Contract (0x8315...) — 112,000+ AVAX-paired tokens
- Token Manager (0x2196...) — 3,700+ ARENA-paired tokens
- AVAX Helper (0x03f1...) — auto-converts AVAX↔ARENA for ARENA-paired tokens
- Pharaoh DEX — graduated tokens auto-route through Pharaoh aggregator
- Auto-detection: tokenId < 100B = AVAX-paired, >= 100B = ARENA-paired

---

### 3. ARENA Swap

| Feature | Status | Endpoint |
|---------|--------|----------|
| Swap AVAX → ARENA | Live | GET /build/buy |
| Swap ARENA → AVAX | Live | GET /build/sell-arena |
| Buy quote | Live | GET /quote |
| Sell quote | Live | GET /quote/sell |
| Agent instructions | Live | GET /swap/agent-instructions |

**DEX integration:** LFJ (Trader Joe) V2.2 LBRouter + LBQuoter on Avalanche.

---

### 4. General DEX Swaps (LFJ)

| Feature | Status | Endpoint |
|---------|--------|----------|
| Swap any token pair on Avalanche | Live | GET /dex/build/swap |
| Quote any token pair | Live | GET /dex/quote |
| 14 pre-loaded tokens + any address | Live | GET /dex/tokens |
| Look up any ERC-20 on-chain | Live | GET /dex/token-info |
| Check balance of any token | Live | GET /dex/balance |
| Agent instructions | Live | GET /dex/agent-instructions |

**Supported tokens:** AVAX, USDC, USDT, BTC.b, WETH.e, sAVAX, JOE, ARENA, GMX, COQ, PHAR, USDC.e, USDT.e, WAVAX — plus any token by contract address.

**Swap types:**
- AVAX → Token (1 tx)
- Token → AVAX (approve + swap)
- Token → Token (approve + swap, auto-routes through WAVAX)
- `amount=max` support with gas reservation

**Tested on mainnet:** AVAX↔USDC round-trip confirmed.

---

### 5. Graduated Token Trading (Pharaoh DEX)

| Feature | Status | Endpoint |
|---------|--------|----------|
| Buy graduated tokens via Pharaoh | Live | GET /launchpad/build/buy |
| Sell graduated tokens via Pharaoh | Live | GET /launchpad/build/sell |
| Auto-detection (lpDeployed check) | Live | Automatic |

**How it works:** When an agent calls `/launchpad/build/buy` or `/launchpad/build/sell` for a graduated token, the API detects `lpDeployed=true` and automatically routes the swap through Pharaoh DEX. Same endpoints, no agent changes needed. Response includes `graduated: true` flag.

**Tested on mainnet:** GLADIUS buy + sell round-trip confirmed, GYM and BANDS quotes confirmed.

---

### 6. Core Infrastructure

| Feature | Status |
|---------|--------|
| Modular SDK-ready architecture (core, swap, staking, launchpad, dex) | Live |
| Unified API key (one key for everything) | Live |
| Wallet-based key dedup (no duplicate registrations) | Live |
| Self-registration for agents | Live |
| Transaction broadcasting | Live |
| Trustless design (unsigned txs, agent signs locally) | Live |
| Server-side position tracking | Live |
| 7 smart contract integrations + Pharaoh aggregator | Live |
| 4 agent instruction prompts (staking, swap, launchpad, dex) | Live |
| MCP server for Claude agents | Live |
| Deployed on Railway | Live |

---

## Total: 40+ Endpoints, All Live

---

## Roadmap — What's Coming

### Phase 1: Token Launching

**What:** Agents can create their own tokens on Arena's bonding curve.

**Why:** Agents go from passive traders to active ecosystem participants. Every agent-launched token = new bonding curve + new trading activity + potential graduation generating fees.

**How:** Integrate the `createToken` function from the Launch Contract. Build a tx that sets token name, symbol, description, creator fee, and deploys.

**New endpoints:**
- GET /launchpad/build/create?wallet=0x...&name=X&symbol=X&description=X&creatorFee=250
- GET /launchpad/my-tokens?wallet=0x... — tokens the agent created + their stats

**Impact:** AI agents become creators on Arena. Imagine an agent that spots a trending narrative, launches a token around it, and manages it.

---

### Phase 2: Perps Trading

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

**Impact:** Arena's full product suite in one plugin. Agents can trade trenches (launchpad) AND perps from the same interface.

---

### Phase 3: Signal & Event Monitoring

**What:** Real-time push notifications so agents react instead of polling.

**Why:** Right now agents have to repeatedly call discovery endpoints. That's slow. Agents should be notified instantly when something happens.

**How:** WebSocket connections and/or webhook registrations. Agents subscribe to events and get pushed notifications.

**New capabilities:**
- Webhook: token about to graduate (graduation % > 90%)
- Webhook: volume spike on a token (5m volume > 2x average)
- Webhook: new token launch matching criteria
- Webhook: large trade alert (whale buy/sell above threshold)
- WebSocket: real-time trade feed

**Impact:** Agents become proactive — opportunities come to them. Faster reaction = better trades.

---

### Phase 4: Agent Performance Analytics

**What:** Track agent performance over time — win rate, PnL, best strategies, worst trades.

**Why:** Agents that can analyze their own performance can improve. Foundation for self-improving trading agents.

**New endpoints:**
- GET /analytics/performance?wallet=0x... — overall PnL, win rate, avg hold time
- GET /analytics/trades?wallet=0x... — full trade history
- GET /analytics/best-strategies — what's working across all agents (anonymized)

---

### Phase 5: SDK Package

**What:** Package everything into a self-contained npm module. No hosted API dependency.

**Why:** Agents shouldn't depend on a third-party server. The SDK runs locally with the agent. Everything is direct contract interaction.

**How:**
```javascript
import { ArenaAgent } from "@arena/agent-sdk";

const agent = new ArenaAgent({
  wallet: "0x...",
  rpc: "https://your-rpc.com"
});

const trending = await agent.launchpad.topVolume("1h", 10);
const buyTx = await agent.launchpad.buildBuy(trending[0].tokenId, "0.5");
await agent.dex.swap("AVAX", "USDC", "10.0");
await agent.staking.buyAndStake("1.0");
```

---

### Phase 6: Multi-Chain Expansion

**What:** Extend beyond Avalanche to any chain Arena expands to.

```javascript
const agent = new ArenaAgent({
  chain: "avalanche", // or "arbitrum", "base", etc.
  wallet: "0x..."
});
```

---

## Summary

| Phase | Feature | Status |
|-------|---------|--------|
| — | ARENA Staking (buy, sell, stake, unstake) | **DONE** |
| — | Launchpad Trading (discover, research, trade) | **DONE** |
| — | ARENA/AVAX Swaps | **DONE** |
| — | General DEX Swaps (any token via LFJ) | **DONE** |
| — | Graduated Token Trading (via Pharaoh DEX) | **DONE** |
| — | Modular SDK-ready architecture | **DONE** |
| — | Core Infrastructure (auth, broadcasting, tracking) | **DONE** |
| 1 | Token Launching (agents create tokens) | Planned |
| 2 | Perps Trading | Planned |
| 3 | Signal & Event Monitoring (webhooks/websockets) | Planned |
| 4 | Agent Performance Analytics | Planned |
| 5 | SDK Package (npm, no server dependency) | Planned |
| 6 | Multi-Chain Expansion | Planned |

---

**Live API:** https://brave-alignment-production-1706.up.railway.app
**GitHub:** https://github.com/OlaCryto/arena-agent-plugin

---

*Built on Avalanche. Built for Arena. Built for the agents.*
