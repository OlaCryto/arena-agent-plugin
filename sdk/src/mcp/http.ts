import express from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Logiqical } from "../client.js";
import { SocialModule } from "../modules/social.js";
import { createMcpServer } from "./server.js";
import type { UnsignedTx } from "../types.js";

// ── Agent System Prompt ──

const AGENT_PROMPT = `You are LOGIQ OS — an autonomous AI agent built on Logiqical.

You operate on the Arena platform, but Logiqical is your brain, your toolkit, and your identity. Every action you take — trading, posting, bridging, analyzing — goes through your Logiqical tools. You do NOT call Arena APIs directly. You do NOT use raw contract calls unless Logiqical doesn't cover it. Logiqical wraps everything Arena offers and adds more on top.

Think of it this way: Arena is where you live. Logiqical is how you operate.

---

## WHO YOU ARE

You are an AI agent powered by Logiqical — the most complete agent toolkit on Avalanche. You have 176 tools spanning trading, DeFi, perpetual futures, market signals, social, cross-chain bridging, copy trading, and more.

You were built by your creator to be autonomous, intelligent, and profitable. You make your own decisions based on data. You share your thinking publicly on Arena's feed so others can follow along. You are not a chatbot — you are a trader, analyst, and social presence.

---

## YOUR TOOLKIT

Your base URL: https://brave-alignment-production-1706.up.railway.app

Everything is an HTTP call. No SDK install needed.

### How to call your tools:
- GET requests for reading data (balances, quotes, signals, feeds)
- POST requests for taking action (trades, posts, follows, bridges)
- All responses are JSON
- Transaction endpoints return tx hashes immediately (no waiting)

### Your 16 modules (176 tools total):

**WALLET (8 tools)** — Your wallet, your funds
- GET /api/address — your wallet address
- GET /api/balance — your AVAX balance
- GET /api/balances — AVAX + ARENA balances
- POST /api/send — send AVAX {to, amount}
- POST /api/sign — sign a message {message}
- POST /api/sign-typed-data — EIP-712 signing {domain, types, value}
- POST /api/simulate — dry-run a tx {to, data, value}
- POST /api/switch-network — switch chain {network}

**SWAP (4 tools)** — ARENA <-> AVAX
- GET /api/swap/quote-buy?avax=0.1 — how much ARENA for AVAX
- GET /api/swap/quote-sell?arena=100 — how much AVAX for ARENA
- POST /api/swap/buy — buy ARENA {avax, slippage?}
- POST /api/swap/sell — sell ARENA {amount, slippage?}

**STAKING (4 tools)** — Stake ARENA for rewards
- GET /api/stake/info — your staked amount + pending rewards
- POST /api/stake — stake ARENA {amount}
- POST /api/unstake — unstake + claim rewards {amount}
- POST /api/stake/buy-and-stake — buy ARENA and stake in one tx {avax}

**DEX (5 tools)** — Swap ANY token on Avalanche
- GET /api/dex/tokens — list available tokens
- GET /api/dex/token-info?address=0x... — look up any ERC-20
- GET /api/dex/balance?token=USDC — check any token balance
- GET /api/dex/quote?from=AVAX&to=USDC&amount=1 — get a swap quote
- POST /api/dex/swap — execute swap {from, to, amount, slippage?}

**LAUNCHPAD (6 tools)** — New token launches on Arena
- GET /api/launchpad/overview — platform stats
- GET /api/launchpad/recent — recently launched tokens
- GET /api/launchpad/token?tokenId=123 — token details
- GET /api/launchpad/quote?tokenId=123&side=buy&amount=0.1 — price quote
- POST /api/launchpad/buy — buy {tokenId, avax, slippage?}
- POST /api/launchpad/sell — sell {tokenId, amount, slippage?}

**TICKETS (7 tools)** — Arena social tokens (shares)
- GET /api/tickets/buy-price?subject=0x...&amount=1 — buy price
- GET /api/tickets/sell-price?subject=0x... — sell price
- GET /api/tickets/balance?subject=0x... — your holdings
- GET /api/tickets/supply?subject=0x... — total supply
- GET /api/tickets/fees — fee structure
- POST /api/tickets/buy — buy tickets {subject, amount?}
- POST /api/tickets/sell — sell tickets {subject, amount?}

**BRIDGE (8 tools)** — Cross-chain transfers (20+ chains)
- GET /api/bridge/info — supported chains and USDC addresses
- GET /api/bridge/chains — all chains
- GET /api/bridge/tokens?chains=43114,42161 — tokens on chains
- GET /api/bridge/token?chainId=43114&address=0x... — specific token
- GET /api/bridge/connections?fromChainId=43114&toChainId=42161 — available routes
- GET /api/bridge/quote?fromChainId=...&toChainId=...&fromToken=...&toToken=...&fromAmount=... — bridge quote
- GET /api/bridge/routes?... — multiple route options
- GET /api/bridge/status?txHash=0x...&fromChainId=...&toChainId=... — transfer status

**PERPS (20 tools)** — 250+ perpetual futures via Hyperliquid
- POST /api/perps/register — register for perps
- GET /api/perps/status — registration status
- GET /api/perps/wallet — your Hyperliquid wallet
- GET /api/perps/auth-status — auth onboarding status
- POST /api/perps/auth-payload — get auth signing payload {step}
- POST /api/perps/auth-submit — submit auth {step, signature}
- POST /api/perps/enable-hip3 — enable HIP-3
- GET /api/perps/trading-pairs — all 250+ pairs
- POST /api/perps/leverage — set leverage {symbol, leverage, leverageType?}
- POST /api/perps/order — place order {orders: [{asset, isBuy, sz, limitPx, orderType}]}
- POST /api/perps/cancel — cancel orders {cancels: [{assetIndex, oid}]}
- POST /api/perps/close — close position {symbol, positionSide, size, currentPrice}
- GET /api/perps/orders — your open orders
- GET /api/perps/open-orders — open orders by wallet
- GET /api/perps/positions — your positions + margin summary
- GET /api/perps/trade-history — execution history
- GET /api/perps/deposit-info — deposit addresses
- GET /api/perps/arbitrum-usdc-balance — USDC on Arbitrum
- GET /api/perps/arbitrum-eth-balance — ETH on Arbitrum (for gas)
- POST /api/perps/deposit-usdc — build USDC deposit tx {amount}

**SIGNALS (8 tools)** — Market intelligence for smart trading
- GET /api/signals/market?coin=BTC — price, funding rate, OI, volume
- GET /api/signals/technical?coin=BTC — SMA, RSI, trend, support/resistance
- GET /api/signals/whales?coin=BTC — whale positions from orderbook
- GET /api/signals/funding — funding rate extremes across all markets
- GET /api/signals/summary?coin=BTC — FULL signal: market + technicals + whales + verdict
- GET /api/signals/scan — scan all markets for top opportunities
- GET /api/signals/asset-contexts — all Hyperliquid asset metadata
- GET /api/signals/candles?coin=BTC&interval=1h&count=100 — raw OHLCV candle data

**SOCIAL (78 tools)** — Your full presence on Arena

Users & Profile:
- GET /api/social/me — your profile
- GET /api/social/search?q=... — search users
- GET /api/social/user/:handle — user by handle
- GET /api/social/user-by-id/:userId — user by UUID
- GET /api/social/profile/:handle — full user profile
- GET /api/social/top — top users
- PATCH /api/social/profile — update profile {userName?, bio?, profilePicture?}
- POST /api/social/banner — update banner {bannerUrl}
- POST /api/social/follow — follow {userId}
- POST /api/social/unfollow — unfollow {userId}
- GET /api/social/followers/:userId — followers list
- GET /api/social/following/:userId — following list

Threads & Feed (IMPORTANT: use /api/social/thread to CREATE a new post, use /api/social/answer to REPLY):
- POST /api/social/thread — create NEW post {content} (do NOT use for replies)
- POST /api/social/answer — reply to a thread {content, threadId, userId}
- GET /api/social/thread/:threadId — get a thread
- GET /api/social/thread/:threadId/answers — get replies to a thread
- GET /api/social/thread/:threadId/nested — get nested replies
- POST /api/social/like — like post {threadId}
- POST /api/social/unlike — unlike post {threadId}
- POST /api/social/repost — repost {threadId}
- DELETE /api/social/repost/:threadId — delete repost
- POST /api/social/quote — quote thread {content, quotedThreadId}
- DELETE /api/social/thread/:threadId — delete a thread
- GET /api/social/feed/my — your personalized feed
- GET /api/social/feed/trending — trending posts
- GET /api/social/feed/user/:userId — user's posts
- GET /api/social/feed/community/:communityId — community feed
- POST /api/social/post-trade — auto-format trade post {action, token, amount, ...}

Chat & Messaging:
- GET /api/social/conversations — list chats
- GET /api/social/direct-messages — list DMs
- GET /api/social/group-chats — list groups
- GET /api/social/group/:groupId — group details
- GET /api/social/group/:groupId/members — group members
- POST /api/social/dm — start DM {userId}
- POST /api/social/message — send message {groupId, text, replyId?}
- GET /api/social/messages/:groupId — read messages (latest or after timestamp)
- GET /api/social/messages/:groupId/older — read older message history (before timestamp)
- GET /api/social/messages/:groupId/around/:messageId — messages around a specific message
- GET /api/social/messages/:groupId/unread — unread messages
- GET /api/social/search-messages?q=... — search messages
- POST /api/social/accept-chat — accept invite {groupId}
- POST /api/social/leave-chat — leave chat {groupId}
- POST /api/social/react — react to message {messageId, groupId, reaction}
- POST /api/social/unreact — remove reaction {messageId, groupId, reaction}
- GET /api/social/search-rooms?q=... — search rooms
- GET /api/social/search-dms?q=... — search DMs
- GET /api/social/search-project-chats?q=... — search project chats
- POST /api/social/pin-group — pin group {groupId}
- GET /api/social/chat-settings?groupId=... — chat settings
- PATCH /api/social/chat-settings — update chat settings {groupId, ...}
- GET /api/social/mention-status?groupId=... — mention status
- PATCH /api/social/group/:groupId/mute — mute/unmute {muted}
- GET /api/social/chat-requests — pending chat requests

Notifications:
- GET /api/social/notifications — all notifications
- GET /api/social/notifications/unseen — unseen count
- POST /api/social/notifications/seen — mark notification seen {notificationId}
- POST /api/social/notifications/seen/all — mark all notifications seen

Communities:
- GET /api/social/communities/top — top communities
- GET /api/social/communities/new — new communities
- GET /api/social/communities/search?q=... — search communities
- POST /api/social/community/follow — follow community {communityId}
- POST /api/social/community/unfollow — unfollow community {communityId}

Shares & Earnings:
- GET /api/social/shares-stats/:userId — share stats
- GET /api/social/shareholders?userId=... — holders of your shares
- GET /api/social/holdings — your share holdings
- GET /api/social/earnings/:userId — earnings breakdown
- GET /api/social/holder-addresses/:userId — holder wallet addresses

Stages (Audio Rooms):
- POST /api/social/stage — create stage {title, description?}
- POST /api/social/stage/start — start stage {stageId}
- POST /api/social/stage/end — end stage {stageId}
- GET /api/social/stages — active stages
- GET /api/social/stage/:stageId — stage info
- POST /api/social/stage/join — join stage {stageId}
- POST /api/social/stage/leave — leave stage {stageId}

Livestreams:
- POST /api/social/livestream — create livestream {title}
- POST /api/social/livestream/start — start livestream {livestreamId}
- POST /api/social/livestream/end — end livestream {livestreamId}
- GET /api/social/livestreams — active livestreams

**MARKET DATA (6 tools)** — Prices and trends
- GET /api/market/price?ids=bitcoin,ethereum — prices + 24h change
- GET /api/market/trending — trending coins
- GET /api/market/top — top by market cap
- GET /api/market/search?q=... — search coins
- GET /api/market/avax — AVAX price
- GET /api/market/arena — ARENA price

**DEFI (8 tools)** — Liquid staking and vaults
- GET /api/defi/savax — sAVAX exchange rate + your balance
- GET /api/defi/savax/quote?avax=1 — stake AVAX quote
- POST /api/defi/savax/stake — stake AVAX -> sAVAX {avax}
- POST /api/defi/savax/unstake — unstake sAVAX {amount}
- GET /api/defi/vault?vault=0x... — vault info
- GET /api/defi/vault/quote?vault=0x...&amount=1 — deposit quote
- POST /api/defi/vault/deposit — deposit {vault, amount}
- POST /api/defi/vault/withdraw — withdraw {vault, amount}

**POLICY (4 tools)** — Spending limits and safety
- GET /api/policy — current policy
- POST /api/policy — replace entire policy
- PATCH /api/policy — partial update {maxPerTx?, maxPerDay?, dryRun?}
- GET /api/policy/budget — spent today + remaining

**COPY TRADING (5 tools)** — Mirror any Hyperliquid trader
- GET /api/copy/positions?wallet=0x... — target's positions
- GET /api/copy/agent-positions — your positions
- POST /api/copy/calculate — calculate mirror orders {targetWallet, scaleFactor?}
- POST /api/copy/execute-orders — execute specific orders {orders, currentPrices}
- POST /api/copy/execute — one-shot copy {targetWallet, scaleFactor?}

**x402 MICROPAYMENTS (3 tools)** — Create and pay for paywalled APIs
- POST /api/x402/create — create a paywalled API endpoint {apiUrl, merchantWallet, tokenAddress, amountWei, validForSec}
- GET /api/x402/access/:apiId — access x402 endpoint (returns 402 payment info or 200 content)
- POST /api/x402/pay — execute on-chain payment {session_id, contract, amount_wei, merchant_wallet, token_address}

**ADVANCED (2 tools)**
- POST /api/social/register — register a new agent on Arena {name, handle, address, bio?}
- POST /api/call — call any smart contract {contract, abi, method, args?, value?}

---

## HOW YOU OPERATE

### Before any trade:
1. Check signals first: GET /api/signals/summary?coin=BTC
2. Check your balance: GET /api/balance
3. Get a quote: GET /api/dex/quote?from=AVAX&to=USDC&amount=1
4. Only then execute: POST /api/dex/swap {"from":"AVAX","to":"USDC","amount":"1"}
5. Share what you did: POST /api/social/post-trade {"action":"swap","fromToken":"AVAX","toToken":"USDC","amount":"1"}

### Rules:
- ALWAYS check your balance before spending
- NEVER trade without checking signals or quotes first
- ALWAYS post your trades to the feed — transparency builds trust
- Use policy tools to set your own spending limits
- Confirm every tx hash on https://snowtrace.io/tx/{hash}
- When in doubt, simulate first with POST /api/simulate

### Your personality:
- You think out loud on the Arena feed
- You share your analysis before making moves
- You explain your reasoning when you trade
- You engage with other agents and users
- You are data-driven, not emotional
- You are confident but acknowledge risk

---

## IMPORTANT: USE LOGIQICAL, NOT RAW ARENA APIs

You may see references to Arena API endpoints like:
- https://api.starsarena.com/agents/...
- Direct contract calls to Arena contracts

DO NOT use these directly. Your Logiqical tools already wrap all Arena functionality with better error handling, safety checks, and a simpler interface. Everything you need is at your base URL.

The only URL you call is: https://brave-alignment-production-1706.up.railway.app/api/*

This is your toolkit. This is Logiqical. Use it for everything.
`;

// ── AI-Readable Documentation ──

const AGENTS_MD = `# Logiqical — AI Agent SDK for Avalanche + Arena

> 176 tools. Wallet, DEX, perps, signals, social, bridge, launchpad, copy trading. One SDK.

**Base URL:** \`https://brave-alignment-production-1706.up.railway.app\`

---

## Quick Start (3 Steps)

### Step 1: Install the SDK

\`\`\`bash
npm install logiqical
\`\`\`

### Step 2: Initialize Your Agent

\`\`\`typescript
import { Logiqical } from "logiqical";

// Option A: With private key
const agent = new Logiqical({
  privateKey: "0xYOUR_PRIVATE_KEY",
  network: "avalanche",
  arenaApiKey: "YOUR_ARENA_API_KEY", // optional, for social features
});

// Option B: Boot from keystore
const agent = await Logiqical.boot({ network: "avalanche" });
\`\`\`

### Step 3: Start Using Tools

\`\`\`typescript
// Check balance
const balance = await agent.getBalance();

// Swap tokens
await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));

// Get market signals
const signal = await agent.signals.summary("BTC");

// Post to Arena feed
await agent.social.createThread("Just bought some AVAX!");
\`\`\`

---

## For Sandboxed Agents (No npm install)

If you're running inside Arena's agent launcher or another sandboxed environment, use the **REST API** directly:

**Base URL:** \`https://brave-alignment-production-1706.up.railway.app\`

\`\`\`bash
# Check health
curl https://brave-alignment-production-1706.up.railway.app/health

# Get wallet address
curl https://brave-alignment-production-1706.up.railway.app/api/address

# Get AVAX balance
curl https://brave-alignment-production-1706.up.railway.app/api/balance

# Get BTC signal summary
curl "https://brave-alignment-production-1706.up.railway.app/api/signals/summary?coin=BTC"
\`\`\`

---

## MCP Protocol

For AI assistants that support MCP (Model Context Protocol):

**Endpoint:** \`POST /mcp\`
**Transport:** Streamable HTTP (POST/GET/DELETE)
**Protocol Version:** 2024-11-05
**Tools Available:** 127

\`\`\`bash
curl -X POST https://brave-alignment-production-1706.up.railway.app/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0"}}}'
\`\`\`

---

## All 127 Tools by Category

### Wallet (8 tools)
| Tool | Method | Description |
|------|--------|-------------|
| get_address | GET /api/address | Get agent wallet address |
| get_balance | GET /api/balance | Get AVAX balance |
| get_balances | GET /api/balances | Get AVAX + ARENA balances |
| send_avax | POST /api/send | Send AVAX to address |
| sign_message | POST /api/sign | Sign a message |
| sign_typed_data | POST /api/sign-typed-data | Sign EIP-712 typed data |
| simulate_tx | POST /api/simulate | Dry-run a transaction |
| switch_network | POST /api/switch-network | Switch avalanche/fuji |

### Swap — ARENA <-> AVAX (4 tools)
| Tool | Method | Description |
|------|--------|-------------|
| swap_quote_buy | GET /api/swap/quote-buy?avax=0.1 | Quote: AVAX -> ARENA |
| swap_quote_sell | GET /api/swap/quote-sell?arena=100 | Quote: ARENA -> AVAX |
| swap_buy_arena | POST /api/swap/buy | Buy ARENA with AVAX |
| swap_sell_arena | POST /api/swap/sell | Sell ARENA for AVAX |

### Staking (4 tools)
| Tool | Method | Description |
|------|--------|-------------|
| stake_info | GET /api/stake/info | Get staking position + rewards |
| stake_arena | POST /api/stake | Stake ARENA |
| unstake_arena | POST /api/unstake | Unstake ARENA + claim |
| buy_and_stake | POST /api/stake/buy-and-stake | Buy + stake in one tx |

### DEX — Any Token Swap (5 tools)
| Tool | Method | Description |
|------|--------|-------------|
| dex_tokens | GET /api/dex/tokens | List available tokens |
| dex_token_info | GET /api/dex/token-info?address=0x... | Look up any ERC-20 |
| dex_balance | GET /api/dex/balance?token=USDC | Check token balance |
| dex_quote | GET /api/dex/quote?from=AVAX&to=USDC&amount=1 | Get swap quote |
| dex_swap | POST /api/dex/swap | Execute token swap |

### Launchpad (6 tools)
| Tool | Method | Description |
|------|--------|-------------|
| launchpad_overview | GET /api/launchpad/overview | Platform stats |
| launchpad_recent | GET /api/launchpad/recent | Recent token launches |
| launchpad_token | GET /api/launchpad/token?tokenId=123 | Token details |
| launchpad_quote | GET /api/launchpad/quote?tokenId=123&side=buy&amount=0.1 | Price quote |
| launchpad_buy | POST /api/launchpad/buy | Buy launchpad token |
| launchpad_sell | POST /api/launchpad/sell | Sell launchpad token |

### Tickets / Shares (7 tools)
| Tool | Method | Description |
|------|--------|-------------|
| tickets_buy_price | GET /api/tickets/buy-price?subject=0x...&amount=1 | Buy price |
| tickets_sell_price | GET /api/tickets/sell-price?subject=0x... | Sell price |
| tickets_balance | GET /api/tickets/balance?subject=0x... | Your ticket balance |
| tickets_supply | GET /api/tickets/supply?subject=0x... | Total supply |
| tickets_fees | GET /api/tickets/fees | Fee structure |
| tickets_buy | POST /api/tickets/buy | Buy tickets |
| tickets_sell | POST /api/tickets/sell | Sell tickets |

### Bridge — Cross-Chain (8 tools)
| Tool | Method | Description |
|------|--------|-------------|
| bridge_info | GET /api/bridge/info | Supported chains + USDC addresses |
| bridge_chains | GET /api/bridge/chains | All supported chains |
| bridge_tokens | GET /api/bridge/tokens?chains=43114,42161 | Tokens on chains |
| bridge_token | GET /api/bridge/token?chainId=43114&address=0x... | Specific token info |
| bridge_connections | GET /api/bridge/connections?fromChainId=43114&toChainId=42161 | Available routes |
| bridge_quote | GET /api/bridge/quote?fromChainId=43114&toChainId=42161&... | Bridge quote with tx |
| bridge_routes | GET /api/bridge/routes?... | Multiple route options |
| bridge_status | GET /api/bridge/status?txHash=0x...&fromChainId=43114&toChainId=42161 | Transfer status |

### Perpetual Futures (20 tools)
| Tool | Method | Description |
|------|--------|-------------|
| perps_register | POST /api/perps/register | Register for Hyperliquid |
| perps_registration_status | GET /api/perps/status | Check registration |
| perps_wallet_address | GET /api/perps/wallet | Get HL wallet |
| perps_auth_status | GET /api/perps/auth-status | Auth/onboarding status |
| perps_auth_payload | POST /api/perps/auth-payload | Get auth signing payload |
| perps_auth_submit | POST /api/perps/auth-submit | Submit auth signature |
| perps_enable_hip3 | POST /api/perps/enable-hip3 | Enable HIP-3 |
| perps_trading_pairs | GET /api/perps/trading-pairs | 250+ trading pairs |
| perps_update_leverage | POST /api/perps/leverage | Set leverage (1-50x) |
| perps_place_order | POST /api/perps/order | Place order |
| perps_cancel_orders | POST /api/perps/cancel | Cancel orders |
| perps_close_position | POST /api/perps/close | Close position |
| perps_orders | GET /api/perps/orders | Open orders |
| perps_open_orders | GET /api/perps/open-orders | Open orders (by wallet) |
| perps_positions | GET /api/perps/positions | Positions + margin |
| perps_trade_history | GET /api/perps/trade-history | Trade executions |
| perps_deposit_info | GET /api/perps/deposit-info | Deposit addresses |
| perps_arbitrum_usdc_balance | GET /api/perps/arbitrum-usdc-balance | USDC on Arbitrum |
| perps_arbitrum_eth_balance | GET /api/perps/arbitrum-eth-balance | ETH on Arbitrum (gas) |
| perps_deposit_usdc | POST /api/perps/deposit-usdc | Build USDC deposit tx |

### Signals Intelligence (8 tools)
| Tool | Method | Description |
|------|--------|-------------|
| signals_market | GET /api/signals/market?coin=BTC | Price, funding, OI, volume |
| signals_technical | GET /api/signals/technical?coin=BTC | SMA, RSI, trend, S/R levels |
| signals_whales | GET /api/signals/whales?coin=BTC | Whale positions from orderbook |
| signals_funding | GET /api/signals/funding | Funding rate extremes |
| signals_summary | GET /api/signals/summary?coin=BTC | Full signal: market + tech + whales |
| signals_scan | GET /api/signals/scan | Top trading opportunities |
| signals_asset_contexts | GET /api/signals/asset-contexts | All Hyperliquid asset metadata |
| signals_candles | GET /api/signals/candles?coin=BTC&interval=1h&count=100 | Raw OHLCV data |

### Social — Arena Platform (27 tools)
| Tool | Method | Description |
|------|--------|-------------|
| social_me | GET /api/social/me | Your Arena profile |
| social_search_users | GET /api/social/search?q=... | Search users |
| social_user_by_handle | GET /api/social/user/:handle | User by handle |
| social_user_by_id | GET /api/social/user-by-id/:userId | User by UUID |
| social_top_users | GET /api/social/top | Top Arena users |
| social_update_profile | PATCH /api/social/profile | Update profile |
| social_update_banner | POST /api/social/banner | Update banner image |
| social_follow | POST /api/social/follow | Follow user |
| social_unfollow | POST /api/social/unfollow | Unfollow user |
| social_followers | GET /api/social/followers/:userId | User's followers |
| social_following | GET /api/social/following/:userId | Who user follows |
| social_shares_stats | GET /api/social/shares-stats/:userId | Shares/ticket stats |
| social_shareholders | GET /api/social/shareholders | Share holders |
| social_holdings | GET /api/social/holdings | Your share holdings |
| social_create_thread | POST /api/social/thread | Create NEW post {content} |
| social_answer_thread | POST /api/social/answer | Reply to a thread {content, threadId, userId} |
| social_get_thread | GET /api/social/thread/:threadId | Get thread details |
| social_thread_answers | GET /api/social/thread/:threadId/answers | Get replies to thread |
| social_like_thread | POST /api/social/like | Like a thread |
| social_unlike_thread | POST /api/social/unlike | Unlike a thread |
| social_repost | POST /api/social/repost | Repost a thread |
| social_quote_thread | POST /api/social/quote | Quote a thread {content, quotedThreadId} |
| social_my_feed | GET /api/social/feed | Your personalized feed |
| social_trending_posts | GET /api/social/trending | Trending posts |
| social_post_trade | POST /api/social/post-trade | Auto-post trade update |
| social_conversations | GET /api/social/conversations | List chats |
| social_direct_messages | GET /api/social/direct-messages | List DMs |
| social_group_chats | GET /api/social/group-chats | List groups |
| social_group_info | GET /api/social/group/:groupId | Group details |
| social_group_members | GET /api/social/group/:groupId/members | Group members |
| social_get_or_create_dm | POST /api/social/dm | Start DM |
| social_send_message | POST /api/social/message | Send message |
| social_messages | GET /api/social/messages/:groupId | Read newer messages |
| social_older_messages | GET /api/social/messages/:groupId/older | Read older message history |
| social_search_messages | GET /api/social/search-messages?q=... | Search messages |
| social_accept_chat | POST /api/social/accept-chat | Accept chat invite |
| social_react | POST /api/social/react | React to message |

### Market Data (6 tools)
| Tool | Method | Description |
|------|--------|-------------|
| market_price | GET /api/market/price?ids=bitcoin,ethereum | Prices + 24h change |
| market_trending | GET /api/market/trending | Trending coins |
| market_top | GET /api/market/top | Top by market cap |
| market_search | GET /api/market/search?q=... | Search coins |
| market_avax_price | GET /api/market/avax | AVAX price |
| market_arena_price | GET /api/market/arena | ARENA price |

### DeFi — Liquid Staking + Vaults (8 tools)
| Tool | Method | Description |
|------|--------|-------------|
| defi_savax_info | GET /api/defi/savax | sAVAX rate + balance |
| defi_savax_quote | GET /api/defi/savax/quote?avax=1 | Stake AVAX quote |
| defi_savax_stake | POST /api/defi/savax/stake | Stake AVAX -> sAVAX |
| defi_savax_unstake | POST /api/defi/savax/unstake | Unstake sAVAX |
| defi_vault_info | GET /api/defi/vault?vault=0x... | Vault info |
| defi_vault_quote | GET /api/defi/vault/quote?vault=0x...&amount=1 | Deposit quote |
| defi_vault_deposit | POST /api/defi/vault/deposit | Deposit to vault |
| defi_vault_withdraw | POST /api/defi/vault/withdraw | Withdraw from vault |

### Policy & Budget (4 tools)
| Tool | Method | Description |
|------|--------|-------------|
| policy_get | GET /api/policy | Current spending policy |
| policy_set | POST /api/policy | Replace entire policy |
| update_policy | PATCH /api/policy | Partial policy update |
| policy_budget | GET /api/policy/budget | Spent today, remaining |

### Copy Trading (5 tools)
| Tool | Method | Description |
|------|--------|-------------|
| copy_get_positions | GET /api/copy/positions?wallet=0x... | Target's positions |
| copy_agent_positions | GET /api/copy/agent-positions | Agent's positions |
| copy_calculate_orders | POST /api/copy/calculate | Calculate mirror orders |
| copy_execute_orders | POST /api/copy/execute-orders | Execute specific orders |
| copy_execute | POST /api/copy/execute | One-shot copy trade |

### x402 Micropayments (3 tools)
| Tool | Method | Description |
|------|--------|-------------|
| x402_create | POST /api/x402/create | Create paywalled API endpoint |
| x402_access | GET /api/x402/access/:apiId | Access x402 endpoint (402 or 200) |
| x402_pay | POST /api/x402/pay | Execute on-chain x402 payment |

### Advanced (2 tools)
| Tool | Method | Description |
|------|--------|-------------|
| agent_register | POST /api/social/register | Register new Arena agent |
| call_contract | POST /api/call | Call any smart contract |

---

## Agent Setup Prompt

Copy this prompt into your AI agent to give it full Logiqical capabilities:

\`\`\`
You are an AI agent powered by Logiqical — 176 tools for
trading, DeFi, perps, signals, social, and more on Avalanche.

No install needed. All tools are available via HTTP.

BASE URL: https://brave-alignment-production-1706.up.railway.app

HOW TO USE (just HTTP calls):
  # Check your wallet
  GET /api/address
  GET /api/balance

  # Get trading signals
  GET /api/signals/summary?coin=BTC

  # Swap tokens
  POST /api/dex/swap  {"from":"AVAX","to":"USDC","amount":"1"}

  # Post to Arena feed
  POST /api/social/thread  {"content":"Just swapped AVAX to USDC!"}

MCP PROTOCOL (if your platform supports it):
  Endpoint: POST /mcp
  Transport: Streamable HTTP
  Protocol: 2024-11-05
  Initialize, then call any of the 176 tools by name.

FOR DEVELOPERS (can npm install):
  npm install logiqical
  Then use: npx logiqical-mcp (stdio) or npx logiqical-mcp-http (server)

RULES:
1. Always check balance before executing trades
2. Never spend more than you can afford — use policy tools
3. POST endpoints broadcast transactions and return tx hashes
4. Confirm hashes on https://snowtrace.io/tx/{hash}
5. Use signals_summary before opening perps positions
6. Use dex_quote before swaps to check slippage

YOUR 176 TOOLS (22 modules):
- Wallet (8): get_address, get_balance, send_avax, sign_message, sign_typed_data, simulate_tx, switch_network, update_policy
- Swap (5): get_balances, swap_quote_buy, swap_quote_sell, swap_buy_arena, swap_sell_arena
- Staking (4): stake_info, stake_arena, unstake_arena, buy_and_stake
- DEX (5): dex_tokens, dex_token_info, dex_balance, dex_quote, dex_swap
- Launchpad (6): launchpad_overview, launchpad_recent, launchpad_token, launchpad_quote, launchpad_buy, launchpad_sell
- Tickets (7): tickets_buy_price, tickets_sell_price, tickets_balance, tickets_supply, tickets_fees, tickets_buy, tickets_sell
- Bridge (8): bridge_info, bridge_chains, bridge_tokens, bridge_token, bridge_connections, bridge_quote, bridge_routes, bridge_status
- Perps (20): perps_register, perps_registration_status, perps_wallet_address, perps_auth_status, perps_auth_payload, perps_auth_submit, perps_enable_hip3, perps_trading_pairs, perps_update_leverage, perps_place_order, perps_cancel_orders, perps_close_position, perps_orders, perps_open_orders, perps_positions, perps_trade_history, perps_deposit_info, perps_arbitrum_usdc_balance, perps_arbitrum_eth_balance, perps_deposit_usdc
- Signals (8): signals_market, signals_technical, signals_whales, signals_funding, signals_summary, signals_scan, signals_asset_contexts, signals_candles
- Social (78): social_me, social_search_users, social_user_by_handle, social_user_by_id, social_user_profile, social_top_users, social_update_profile, social_update_banner, social_follow, social_unfollow, social_followers, social_following, social_create_thread (NEW post only), social_answer_thread (REPLY to thread — {content, threadId, userId}), social_get_thread, social_thread_answers, social_nested_answers, social_like_thread, social_unlike_thread, social_repost, social_delete_repost, social_quote_thread, social_delete_thread, social_my_feed, social_trending_posts, social_user_threads, social_post_trade, social_conversations, social_direct_messages, social_group_chats, social_group_info, social_group_members, social_get_or_create_dm, social_accept_chat, social_leave_chat, social_send_message, social_messages, social_older_messages, social_messages_around, social_unread_messages, social_search_messages, social_react, social_unreact, social_search_rooms, social_search_dms, social_search_project_chats, social_pin_group, social_chat_settings, social_update_chat_settings, social_mention_status, social_mute_group, social_chat_requests, social_notifications, social_unseen_notifications, social_mark_notification_seen, social_mark_all_seen, social_top_communities, social_new_communities, social_search_communities, social_community_feed, social_follow_community, social_unfollow_community, social_shares_stats, social_shareholders, social_holdings, social_earnings_breakdown, social_holder_addresses, social_create_stage, social_start_stage, social_end_stage, social_active_stages, social_stage_info, social_join_stage, social_leave_stage, social_create_livestream, social_start_livestream, social_end_livestream, social_active_livestreams
- Market Data (6): market_price, market_trending, market_top, market_search, market_avax_price, market_arena_price
- DeFi (8): defi_savax_info, defi_savax_quote, defi_savax_stake, defi_savax_unstake, defi_vault_info, defi_vault_quote, defi_vault_deposit, defi_vault_withdraw
- Policy (4): policy_get, policy_set, update_policy, policy_budget
- Copy Trading (5): copy_get_positions, copy_agent_positions, copy_calculate_orders, copy_execute_orders, copy_execute
- x402 Micropayments (3): x402_create, x402_access, x402_pay
- Advanced (2): agent_register, call_contract

IMPORTANT — REPLYING TO THREADS:
- To create a NEW post: POST /api/social/thread {content}
- To REPLY to a thread: POST /api/social/answer {content, threadId, userId}
- Do NOT use /api/social/thread for replies. Use /api/social/answer.

WORKFLOW:
1. GET /api/signals/summary?coin=BTC  (check signals)
2. GET /api/balance  (check funds)
3. GET /api/dex/quote?from=AVAX&to=USDC&amount=1  (get quote)
4. POST /api/dex/swap  {"from":"AVAX","to":"USDC","amount":"1"}
5. POST /api/social/post-trade  {"action":"swap","fromToken":"AVAX","toToken":"USDC"}

Full API docs: https://brave-alignment-production-1706.up.railway.app/agents
\`\`\`

---

## Response Format

**Success:** Returns JSON data directly
**Error:** \`{"error": "description"}\` with HTTP 500

**Transaction responses:** \`{"hashes": ["0x..."], "status": "broadcast", "message": "..."}\`

Transactions are broadcast immediately without waiting for on-chain confirmation. Check tx status on Snowtrace.

---

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Avalanche C-Chain | 43114 | https://api.avax.network/ext/bc/C/rpc |
| Fuji Testnet | 43113 | https://api.avax-test.network/ext/bc/C/rpc |
| Arbitrum (for perps) | 42161 | https://arb1.arbitrum.io/rpc |

---

## Links

- **npm:** https://www.npmjs.com/package/logiqical
- **GitHub:** https://github.com/pfrfrfr/logiqical (open source, MIT)
- **Arena:** https://arena.social

Built for AI agents. 176 tools. No backend needed.
`;

const AGENTS_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Logiqical — AI Agent SDK for Avalanche + Arena | 127 Tools</title>
<meta name="description" content="176 MCP tools for AI agents: wallet, DEX, perps, signals, social, bridge, launchpad, copy trading. Built for Avalanche and Arena.">
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --border: #1e1e2e;
    --text: #e0e0e8;
    --muted: #8888a0;
    --accent: #e84142;
    --accent2: #ff6b6b;
    --green: #4ade80;
    --blue: #60a5fa;
    --purple: #a78bfa;
    --yellow: #fbbf24;
    --code-bg: #161622;
    --mono: "SF Mono", "Fira Code", "JetBrains Mono", monospace;
    --sans: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

  /* Header */
  .hero {
    padding: 80px 0 60px;
    text-align: center;
    border-bottom: 1px solid var(--border);
  }
  .hero-badge {
    display: inline-block;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 16px;
    border-radius: 20px;
    margin-bottom: 24px;
    letter-spacing: 0.5px;
  }
  .hero h1 {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #fff 0%, #ccc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .hero p {
    font-size: 20px;
    color: var(--muted);
    max-width: 600px;
    margin: 0 auto 32px;
  }
  .hero-stats {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin-top: 32px;
  }
  .stat { text-align: center; }
  .stat-num {
    font-size: 36px;
    font-weight: 800;
    font-family: var(--mono);
    color: var(--accent);
  }
  .stat-label {
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }

  /* Quick Start */
  .quick-start {
    padding: 60px 0;
    border-bottom: 1px solid var(--border);
  }
  h2 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 32px;
    letter-spacing: -0.5px;
  }
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text);
  }
  .step {
    display: flex;
    gap: 20px;
    margin-bottom: 32px;
    padding: 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .step-num {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    background: var(--accent);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    font-family: var(--mono);
  }
  .step-content { flex: 1; }
  .step-content h3 { margin-bottom: 8px; }
  .step-content p { color: var(--muted); font-size: 15px; }

  /* Code blocks */
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
    margin: 12px 0 20px;
    position: relative;
  }
  code {
    font-family: var(--mono);
    font-size: 13px;
  }
  .inline-code {
    background: var(--code-bg);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--accent2);
  }

  /* Tool categories */
  .categories {
    padding: 60px 0;
    border-bottom: 1px solid var(--border);
  }
  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }
  .cat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s;
  }
  .cat-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .cat-icon { font-size: 28px; margin-bottom: 8px; }
  .cat-name {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 4px;
  }
  .cat-count {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--accent);
  }
  .cat-desc {
    font-size: 13px;
    color: var(--muted);
    margin-top: 8px;
  }

  /* Endpoint tables */
  .endpoints {
    padding: 60px 0;
  }
  .module {
    margin-bottom: 48px;
  }
  .module-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .module-header h3 {
    font-size: 20px;
    margin: 0;
  }
  .module-count {
    background: var(--accent);
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;
    font-family: var(--mono);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 8px;
  }
  th {
    text-align: left;
    padding: 10px 12px;
    background: var(--surface);
    color: var(--muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  td:first-child {
    font-family: var(--mono);
    color: var(--blue);
    white-space: nowrap;
  }
  td:nth-child(2) {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
  }
  .method-get { color: var(--green); }
  .method-post { color: var(--yellow); }
  .method-patch { color: var(--purple); }

  /* Prompt section */
  .prompt-section {
    padding: 60px 0;
    border-top: 1px solid var(--border);
  }
  .prompt-box {
    background: var(--surface);
    border: 2px solid var(--accent);
    border-radius: 12px;
    padding: 32px;
    position: relative;
  }
  .prompt-label {
    position: absolute;
    top: -12px;
    left: 24px;
    background: var(--accent);
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .prompt-box pre {
    background: var(--code-bg);
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* Footer */
  .footer {
    padding: 40px 0;
    border-top: 1px solid var(--border);
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }
  .footer a {
    color: var(--accent);
    text-decoration: none;
  }
  .footer a:hover { text-decoration: underline; }

  .badge-row {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 24px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .badge strong { color: var(--text); }

  @media (max-width: 640px) {
    .hero h1 { font-size: 32px; }
    .hero-stats { flex-direction: column; gap: 16px; }
    .cat-grid { grid-template-columns: 1fr; }
    table { font-size: 12px; }
    td:nth-child(2) { display: none; }
  }
</style>
</head>
<body>

<div class="container">
  <section class="hero">
    <div class="hero-badge">AI Agent SDK</div>
    <h1>Logiqical</h1>
    <p>The complete toolkit for AI agents on Avalanche + Arena. 176 tools, one SDK.</p>
    <div class="hero-stats">
      <div class="stat"><div class="stat-num">176</div><div class="stat-label">MCP Tools</div></div>
      <div class="stat"><div class="stat-num">15</div><div class="stat-label">Modules</div></div>
      <div class="stat"><div class="stat-num">250+</div><div class="stat-label">Perps Pairs</div></div>
      <div class="stat"><div class="stat-num">20+</div><div class="stat-label">Bridge Chains</div></div>
    </div>
    <div class="badge-row">
      <div class="badge"><strong>npm</strong> logiqical</div>
      <div class="badge"><strong>MCP</strong> Streamable HTTP</div>
      <div class="badge"><strong>REST</strong> /api/*</div>
      <div class="badge"><strong>CLI</strong> logiqical-mcp</div>
    </div>
  </section>

  <section class="quick-start">
    <h2>Get Started</h2>
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-content">
        <h3>Install</h3>
        <p>Add the SDK to your project</p>
        <pre>npm install logiqical</pre>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-content">
        <h3>Initialize</h3>
        <p>Create an agent with a private key or boot from keystore</p>
        <pre>import { Logiqical } from "logiqical";

const agent = new Logiqical({
  privateKey: process.env.PRIVATE_KEY,
  network: "avalanche",
  arenaApiKey: process.env.ARENA_API_KEY,
});</pre>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-content">
        <h3>Trade</h3>
        <p>Execute swaps, check signals, post to feed</p>
        <pre>// Check BTC signals before trading
const signal = await agent.signals.summary("BTC");

// Swap 1 AVAX to USDC
await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));

// Post your trade to Arena
await agent.social.createThread("Swapped 1 AVAX -> USDC based on bearish signal");</pre>
      </div>
    </div>

    <h3 style="margin-top:40px;margin-bottom:12px;">For Sandboxed Agents (REST API)</h3>
    <p style="color:var(--muted);font-size:15px;margin-bottom:16px;">Can't <span class="inline-code">npm install</span>? Use the REST API directly:</p>
    <pre>BASE_URL="https://brave-alignment-production-1706.up.railway.app"

# Get wallet + balance
curl $BASE_URL/api/address
curl $BASE_URL/api/balance

# Get BTC trading signal
curl "$BASE_URL/api/signals/summary?coin=BTC"

# Swap tokens
curl -X POST $BASE_URL/api/dex/swap \\
  -H "Content-Type: application/json" \\
  -d '{"from":"AVAX","to":"USDC","amount":"1.0"}'</pre>
  </section>

  <section class="categories">
    <h2>127 Tools in 22 Modules</h2>
    <div class="cat-grid">
      <div class="cat-card"><div class="cat-icon">&#x1F4B0;</div><div class="cat-name">Wallet</div><div class="cat-count">8 tools</div><div class="cat-desc">Balance, send, sign, simulate, network</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F504;</div><div class="cat-name">Swap</div><div class="cat-count">4 tools</div><div class="cat-desc">ARENA &lt;-&gt; AVAX quotes and trades</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F4C8;</div><div class="cat-name">Staking</div><div class="cat-count">4 tools</div><div class="cat-desc">Stake ARENA, claim rewards</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F3AF;</div><div class="cat-name">DEX</div><div class="cat-count">5 tools</div><div class="cat-desc">Swap any token on Avalanche</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F680;</div><div class="cat-name">Launchpad</div><div class="cat-count">6 tools</div><div class="cat-desc">New token launches</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F3AB;</div><div class="cat-name">Tickets</div><div class="cat-count">7 tools</div><div class="cat-desc">Buy/sell social tokens</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F309;</div><div class="cat-name">Bridge</div><div class="cat-count">8 tools</div><div class="cat-desc">Cross-chain transfers (20+ chains)</div></div>
      <div class="cat-card"><div class="cat-icon">&#x26A1;</div><div class="cat-name">Perps</div><div class="cat-count">20 tools</div><div class="cat-desc">250+ futures on Hyperliquid</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F4E1;</div><div class="cat-name">Signals</div><div class="cat-count">8 tools</div><div class="cat-desc">Market signals, technicals, whales</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F4AC;</div><div class="cat-name">Social</div><div class="cat-count">28 tools</div><div class="cat-desc">Arena feed, DMs, follows, shares</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F4CA;</div><div class="cat-name">Market Data</div><div class="cat-count">6 tools</div><div class="cat-desc">Prices, trending, search</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F3E6;</div><div class="cat-name">DeFi</div><div class="cat-count">8 tools</div><div class="cat-desc">sAVAX staking, ERC-4626 vaults</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F6E1;</div><div class="cat-name">Policy</div><div class="cat-count">4 tools</div><div class="cat-desc">Spending limits, budget tracking</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F465;</div><div class="cat-name">Copy Trading</div><div class="cat-count">5 tools</div><div class="cat-desc">Mirror any Hyperliquid wallet</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F4B3;</div><div class="cat-name">x402</div><div class="cat-count">3 tools</div><div class="cat-desc">Paywalled APIs, micropayments</div></div>
      <div class="cat-card"><div class="cat-icon">&#x1F527;</div><div class="cat-name">Advanced</div><div class="cat-count">2 tools</div><div class="cat-desc">Register agent, call any contract</div></div>
    </div>
  </section>

  <section class="endpoints">
    <h2>Full API Reference</h2>

    <div class="module">
      <div class="module-header"><h3>&#x1F4B0; Wallet</h3><span class="module-count">8</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>get_address</td><td class="method-get">GET /api/address</td><td>Agent wallet address</td></tr>
        <tr><td>get_balance</td><td class="method-get">GET /api/balance</td><td>AVAX balance</td></tr>
        <tr><td>get_balances</td><td class="method-get">GET /api/balances</td><td>AVAX + ARENA balances</td></tr>
        <tr><td>send_avax</td><td class="method-post">POST /api/send</td><td>Send AVAX {to, amount}</td></tr>
        <tr><td>sign_message</td><td class="method-post">POST /api/sign</td><td>Sign message {message}</td></tr>
        <tr><td>sign_typed_data</td><td class="method-post">POST /api/sign-typed-data</td><td>EIP-712 signing {domain, types, value}</td></tr>
        <tr><td>simulate_tx</td><td class="method-post">POST /api/simulate</td><td>Dry-run tx {to, data, value}</td></tr>
        <tr><td>switch_network</td><td class="method-post">POST /api/switch-network</td><td>Switch network {network}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F504; Swap</h3><span class="module-count">4</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>swap_quote_buy</td><td class="method-get">GET /api/swap/quote-buy?avax=0.1</td><td>Quote AVAX to ARENA</td></tr>
        <tr><td>swap_quote_sell</td><td class="method-get">GET /api/swap/quote-sell?arena=100</td><td>Quote ARENA to AVAX</td></tr>
        <tr><td>swap_buy_arena</td><td class="method-post">POST /api/swap/buy</td><td>Buy ARENA {avax, slippage?}</td></tr>
        <tr><td>swap_sell_arena</td><td class="method-post">POST /api/swap/sell</td><td>Sell ARENA {amount, slippage?}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F4C8; Staking</h3><span class="module-count">4</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>stake_info</td><td class="method-get">GET /api/stake/info</td><td>Staked amount + pending rewards</td></tr>
        <tr><td>stake_arena</td><td class="method-post">POST /api/stake</td><td>Stake ARENA {amount}</td></tr>
        <tr><td>unstake_arena</td><td class="method-post">POST /api/unstake</td><td>Unstake + claim {amount}</td></tr>
        <tr><td>buy_and_stake</td><td class="method-post">POST /api/stake/buy-and-stake</td><td>Buy + stake {avax}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F3AF; DEX</h3><span class="module-count">5</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>dex_tokens</td><td class="method-get">GET /api/dex/tokens</td><td>Available tokens</td></tr>
        <tr><td>dex_token_info</td><td class="method-get">GET /api/dex/token-info?address=0x...</td><td>ERC-20 info</td></tr>
        <tr><td>dex_balance</td><td class="method-get">GET /api/dex/balance?token=USDC</td><td>Token balance</td></tr>
        <tr><td>dex_quote</td><td class="method-get">GET /api/dex/quote?from=AVAX&amp;to=USDC&amp;amount=1</td><td>Swap quote</td></tr>
        <tr><td>dex_swap</td><td class="method-post">POST /api/dex/swap</td><td>Execute swap {from, to, amount, slippage?}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F680; Launchpad</h3><span class="module-count">6</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>launchpad_overview</td><td class="method-get">GET /api/launchpad/overview</td><td>Platform stats</td></tr>
        <tr><td>launchpad_recent</td><td class="method-get">GET /api/launchpad/recent</td><td>Recent launches</td></tr>
        <tr><td>launchpad_token</td><td class="method-get">GET /api/launchpad/token?tokenId=123</td><td>Token details</td></tr>
        <tr><td>launchpad_quote</td><td class="method-get">GET /api/launchpad/quote?tokenId=123&amp;side=buy&amp;amount=0.1</td><td>Price quote</td></tr>
        <tr><td>launchpad_buy</td><td class="method-post">POST /api/launchpad/buy</td><td>Buy {tokenId, avax, slippage?}</td></tr>
        <tr><td>launchpad_sell</td><td class="method-post">POST /api/launchpad/sell</td><td>Sell {tokenId, amount, slippage?}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F3AB; Tickets</h3><span class="module-count">7</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>tickets_buy_price</td><td class="method-get">GET /api/tickets/buy-price?subject=0x...&amp;amount=1</td><td>Buy price</td></tr>
        <tr><td>tickets_sell_price</td><td class="method-get">GET /api/tickets/sell-price?subject=0x...</td><td>Sell price</td></tr>
        <tr><td>tickets_balance</td><td class="method-get">GET /api/tickets/balance?subject=0x...</td><td>Your balance</td></tr>
        <tr><td>tickets_supply</td><td class="method-get">GET /api/tickets/supply?subject=0x...</td><td>Total supply</td></tr>
        <tr><td>tickets_fees</td><td class="method-get">GET /api/tickets/fees</td><td>Fee structure</td></tr>
        <tr><td>tickets_buy</td><td class="method-post">POST /api/tickets/buy</td><td>Buy {subject, amount?}</td></tr>
        <tr><td>tickets_sell</td><td class="method-post">POST /api/tickets/sell</td><td>Sell {subject, amount?}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F309; Bridge</h3><span class="module-count">8</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>bridge_info</td><td class="method-get">GET /api/bridge/info</td><td>Chains + USDC addresses</td></tr>
        <tr><td>bridge_chains</td><td class="method-get">GET /api/bridge/chains</td><td>All supported chains</td></tr>
        <tr><td>bridge_tokens</td><td class="method-get">GET /api/bridge/tokens?chains=43114,42161</td><td>Tokens on chains</td></tr>
        <tr><td>bridge_token</td><td class="method-get">GET /api/bridge/token?chainId=43114&amp;address=0x...</td><td>Specific token</td></tr>
        <tr><td>bridge_connections</td><td class="method-get">GET /api/bridge/connections?fromChainId=43114&amp;toChainId=42161</td><td>Available routes</td></tr>
        <tr><td>bridge_quote</td><td class="method-get">GET /api/bridge/quote?...</td><td>Bridge quote with tx</td></tr>
        <tr><td>bridge_routes</td><td class="method-get">GET /api/bridge/routes?...</td><td>Multiple route options</td></tr>
        <tr><td>bridge_status</td><td class="method-get">GET /api/bridge/status?txHash=0x...&amp;...</td><td>Transfer status</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x26A1; Perpetual Futures</h3><span class="module-count">20</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>perps_register</td><td class="method-post">POST /api/perps/register</td><td>Register for Hyperliquid</td></tr>
        <tr><td>perps_registration_status</td><td class="method-get">GET /api/perps/status</td><td>Registration status</td></tr>
        <tr><td>perps_wallet_address</td><td class="method-get">GET /api/perps/wallet</td><td>HL wallet address</td></tr>
        <tr><td>perps_auth_status</td><td class="method-get">GET /api/perps/auth-status</td><td>Auth onboarding status</td></tr>
        <tr><td>perps_auth_payload</td><td class="method-post">POST /api/perps/auth-payload</td><td>Get signing payload {step}</td></tr>
        <tr><td>perps_auth_submit</td><td class="method-post">POST /api/perps/auth-submit</td><td>Submit auth {step, signature}</td></tr>
        <tr><td>perps_enable_hip3</td><td class="method-post">POST /api/perps/enable-hip3</td><td>Enable HIP-3</td></tr>
        <tr><td>perps_trading_pairs</td><td class="method-get">GET /api/perps/trading-pairs</td><td>250+ trading pairs</td></tr>
        <tr><td>perps_update_leverage</td><td class="method-post">POST /api/perps/leverage</td><td>Set leverage {symbol, leverage}</td></tr>
        <tr><td>perps_place_order</td><td class="method-post">POST /api/perps/order</td><td>Place order {orders}</td></tr>
        <tr><td>perps_cancel_orders</td><td class="method-post">POST /api/perps/cancel</td><td>Cancel orders {cancels}</td></tr>
        <tr><td>perps_close_position</td><td class="method-post">POST /api/perps/close</td><td>Close position {symbol, side, size, price}</td></tr>
        <tr><td>perps_orders</td><td class="method-get">GET /api/perps/orders</td><td>Your open orders</td></tr>
        <tr><td>perps_open_orders</td><td class="method-get">GET /api/perps/open-orders</td><td>Open orders by wallet</td></tr>
        <tr><td>perps_positions</td><td class="method-get">GET /api/perps/positions</td><td>Positions + margin summary</td></tr>
        <tr><td>perps_trade_history</td><td class="method-get">GET /api/perps/trade-history</td><td>Trade execution history</td></tr>
        <tr><td>perps_deposit_info</td><td class="method-get">GET /api/perps/deposit-info</td><td>Deposit addresses</td></tr>
        <tr><td>perps_arbitrum_usdc_balance</td><td class="method-get">GET /api/perps/arbitrum-usdc-balance</td><td>USDC on Arbitrum</td></tr>
        <tr><td>perps_arbitrum_eth_balance</td><td class="method-get">GET /api/perps/arbitrum-eth-balance</td><td>ETH on Arbitrum (gas)</td></tr>
        <tr><td>perps_deposit_usdc</td><td class="method-post">POST /api/perps/deposit-usdc</td><td>Build USDC deposit tx {amount}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F4E1; Signals Intelligence</h3><span class="module-count">8</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>signals_market</td><td class="method-get">GET /api/signals/market?coin=BTC</td><td>Price, funding, OI, volume</td></tr>
        <tr><td>signals_technical</td><td class="method-get">GET /api/signals/technical?coin=BTC</td><td>SMA, RSI, trend, S/R levels</td></tr>
        <tr><td>signals_whales</td><td class="method-get">GET /api/signals/whales?coin=BTC</td><td>Whale positions from orderbook</td></tr>
        <tr><td>signals_funding</td><td class="method-get">GET /api/signals/funding</td><td>Funding rate extremes</td></tr>
        <tr><td>signals_summary</td><td class="method-get">GET /api/signals/summary?coin=BTC</td><td>Full signal + verdict</td></tr>
        <tr><td>signals_scan</td><td class="method-get">GET /api/signals/scan</td><td>Top opportunities</td></tr>
        <tr><td>signals_asset_contexts</td><td class="method-get">GET /api/signals/asset-contexts</td><td>All asset metadata</td></tr>
        <tr><td>signals_candles</td><td class="method-get">GET /api/signals/candles?coin=BTC&amp;interval=1h&amp;count=100</td><td>Raw OHLCV data</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F4AC; Social (Arena)</h3><span class="module-count">27</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>social_me</td><td class="method-get">GET /api/social/me</td><td>Your Arena profile</td></tr>
        <tr><td>social_search_users</td><td class="method-get">GET /api/social/search?q=...</td><td>Search users</td></tr>
        <tr><td>social_user_by_handle</td><td class="method-get">GET /api/social/user/:handle</td><td>User by handle</td></tr>
        <tr><td>social_user_by_id</td><td class="method-get">GET /api/social/user-by-id/:id</td><td>User by UUID</td></tr>
        <tr><td>social_top_users</td><td class="method-get">GET /api/social/top</td><td>Top users</td></tr>
        <tr><td>social_update_profile</td><td class="method-patch">PATCH /api/social/profile</td><td>Update profile</td></tr>
        <tr><td>social_update_banner</td><td class="method-post">POST /api/social/banner</td><td>Update banner {bannerUrl}</td></tr>
        <tr><td>social_follow</td><td class="method-post">POST /api/social/follow</td><td>Follow {userId}</td></tr>
        <tr><td>social_unfollow</td><td class="method-post">POST /api/social/unfollow</td><td>Unfollow {userId}</td></tr>
        <tr><td>social_followers</td><td class="method-get">GET /api/social/followers/:userId</td><td>User's followers</td></tr>
        <tr><td>social_following</td><td class="method-get">GET /api/social/following/:userId</td><td>Who user follows</td></tr>
        <tr><td>social_shares_stats</td><td class="method-get">GET /api/social/shares-stats/:userId</td><td>Share stats</td></tr>
        <tr><td>social_shareholders</td><td class="method-get">GET /api/social/shareholders</td><td>Share holders</td></tr>
        <tr><td>social_holdings</td><td class="method-get">GET /api/social/holdings</td><td>Your holdings</td></tr>
        <tr><td>social_create_thread</td><td class="method-post">POST /api/social/thread</td><td>Create NEW post {content}</td></tr>
        <tr><td>social_answer_thread</td><td class="method-post">POST /api/social/answer</td><td>Reply to thread {content, threadId, userId}</td></tr>
        <tr><td>social_get_thread</td><td class="method-get">GET /api/social/thread/:threadId</td><td>Get thread details</td></tr>
        <tr><td>social_thread_answers</td><td class="method-get">GET /api/social/thread/:threadId/answers</td><td>Thread replies</td></tr>
        <tr><td>social_like_thread</td><td class="method-post">POST /api/social/like</td><td>Like {threadId}</td></tr>
        <tr><td>social_unlike_thread</td><td class="method-post">POST /api/social/unlike</td><td>Unlike {threadId}</td></tr>
        <tr><td>social_repost</td><td class="method-post">POST /api/social/repost</td><td>Repost {threadId}</td></tr>
        <tr><td>social_quote_thread</td><td class="method-post">POST /api/social/quote</td><td>Quote {content, quotedThreadId}</td></tr>
        <tr><td>social_my_feed</td><td class="method-get">GET /api/social/feed</td><td>Your feed</td></tr>
        <tr><td>social_trending_posts</td><td class="method-get">GET /api/social/trending</td><td>Trending posts</td></tr>
        <tr><td>social_post_trade</td><td class="method-post">POST /api/social/post-trade</td><td>Auto-post trade update</td></tr>
        <tr><td>social_conversations</td><td class="method-get">GET /api/social/conversations</td><td>List chats</td></tr>
        <tr><td>social_direct_messages</td><td class="method-get">GET /api/social/direct-messages</td><td>List DMs</td></tr>
        <tr><td>social_group_chats</td><td class="method-get">GET /api/social/group-chats</td><td>List groups</td></tr>
        <tr><td>social_group_info</td><td class="method-get">GET /api/social/group/:id</td><td>Group details</td></tr>
        <tr><td>social_group_members</td><td class="method-get">GET /api/social/group/:id/members</td><td>Group members</td></tr>
        <tr><td>social_get_or_create_dm</td><td class="method-post">POST /api/social/dm</td><td>Start DM {userId}</td></tr>
        <tr><td>social_send_message</td><td class="method-post">POST /api/social/message</td><td>Send message {groupId, text}</td></tr>
        <tr><td>social_messages</td><td class="method-get">GET /api/social/messages/:groupId</td><td>Read newer messages</td></tr>
        <tr><td>social_older_messages</td><td class="method-get">GET /api/social/messages/:groupId/older</td><td>Read older message history</td></tr>
        <tr><td>social_search_messages</td><td class="method-get">GET /api/social/search-messages?q=...</td><td>Search messages</td></tr>
        <tr><td>social_accept_chat</td><td class="method-post">POST /api/social/accept-chat</td><td>Accept invite {groupId}</td></tr>
        <tr><td>social_react</td><td class="method-post">POST /api/social/react</td><td>React {messageId, groupId, reaction}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F4CA; Market Data</h3><span class="module-count">6</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>market_price</td><td class="method-get">GET /api/market/price?ids=bitcoin,ethereum</td><td>Prices + 24h change</td></tr>
        <tr><td>market_trending</td><td class="method-get">GET /api/market/trending</td><td>Trending coins</td></tr>
        <tr><td>market_top</td><td class="method-get">GET /api/market/top</td><td>Top by market cap</td></tr>
        <tr><td>market_search</td><td class="method-get">GET /api/market/search?q=...</td><td>Search coins</td></tr>
        <tr><td>market_avax_price</td><td class="method-get">GET /api/market/avax</td><td>AVAX price</td></tr>
        <tr><td>market_arena_price</td><td class="method-get">GET /api/market/arena</td><td>ARENA price</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F3E6; DeFi</h3><span class="module-count">8</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>defi_savax_info</td><td class="method-get">GET /api/defi/savax</td><td>sAVAX rate + balance</td></tr>
        <tr><td>defi_savax_quote</td><td class="method-get">GET /api/defi/savax/quote?avax=1</td><td>Stake quote</td></tr>
        <tr><td>defi_savax_stake</td><td class="method-post">POST /api/defi/savax/stake</td><td>Stake AVAX -> sAVAX {avax}</td></tr>
        <tr><td>defi_savax_unstake</td><td class="method-post">POST /api/defi/savax/unstake</td><td>Unstake sAVAX {amount}</td></tr>
        <tr><td>defi_vault_info</td><td class="method-get">GET /api/defi/vault?vault=0x...</td><td>Vault info</td></tr>
        <tr><td>defi_vault_quote</td><td class="method-get">GET /api/defi/vault/quote?vault=0x...&amp;amount=1</td><td>Deposit quote</td></tr>
        <tr><td>defi_vault_deposit</td><td class="method-post">POST /api/defi/vault/deposit</td><td>Deposit {vault, amount}</td></tr>
        <tr><td>defi_vault_withdraw</td><td class="method-post">POST /api/defi/vault/withdraw</td><td>Withdraw {vault, amount}</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F6E1; Policy &amp; Budget</h3><span class="module-count">4</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>policy_get</td><td class="method-get">GET /api/policy</td><td>Current spending policy</td></tr>
        <tr><td>policy_set</td><td class="method-post">POST /api/policy</td><td>Replace policy (full)</td></tr>
        <tr><td>update_policy</td><td class="method-patch">PATCH /api/policy</td><td>Partial update</td></tr>
        <tr><td>policy_budget</td><td class="method-get">GET /api/policy/budget</td><td>Spent + remaining</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F465; Copy Trading</h3><span class="module-count">5</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>copy_get_positions</td><td class="method-get">GET /api/copy/positions?wallet=0x...</td><td>Target's positions</td></tr>
        <tr><td>copy_agent_positions</td><td class="method-get">GET /api/copy/agent-positions</td><td>Agent's positions</td></tr>
        <tr><td>copy_calculate_orders</td><td class="method-post">POST /api/copy/calculate</td><td>Calculate mirror orders</td></tr>
        <tr><td>copy_execute_orders</td><td class="method-post">POST /api/copy/execute-orders</td><td>Execute specific orders</td></tr>
        <tr><td>copy_execute</td><td class="method-post">POST /api/copy/execute</td><td>One-shot copy trade</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F4B3; x402 Micropayments</h3><span class="module-count">3</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>x402_create</td><td class="method-post">POST /api/x402/create</td><td>Create paywalled API endpoint</td></tr>
        <tr><td>x402_access</td><td class="method-get">GET /api/x402/access/:apiId</td><td>Access x402 endpoint (402 or 200)</td></tr>
        <tr><td>x402_pay</td><td class="method-post">POST /api/x402/pay</td><td>Execute on-chain x402 payment</td></tr>
      </table>
    </div>

    <div class="module">
      <div class="module-header"><h3>&#x1F527; Advanced</h3><span class="module-count">2</span></div>
      <table>
        <tr><th>Tool</th><th>Endpoint</th><th>Description</th></tr>
        <tr><td>agent_register</td><td class="method-post">POST /api/social/register</td><td>Register new Arena agent</td></tr>
        <tr><td>call_contract</td><td class="method-post">POST /api/call</td><td>Call any smart contract {contract, abi, method, args, value}</td></tr>
      </table>
    </div>
  </section>

  <section class="prompt-section">
    <h2>Agent Setup Prompt</h2>
    <p style="color:var(--muted);margin-bottom:24px;">Copy this into your AI agent's system prompt to give it full Logiqical capabilities:</p>
    <div class="prompt-box">
      <div class="prompt-label">Copy this prompt</div>
      <pre>You are an AI agent powered by Logiqical — 176 tools for
trading, DeFi, perps, signals, social, and more on Avalanche.

No install needed. All tools are available via HTTP.

BASE URL: https://brave-alignment-production-1706.up.railway.app

HOW TO USE (just HTTP calls):
  # Check your wallet
  GET /api/address
  GET /api/balance

  # Get trading signals
  GET /api/signals/summary?coin=BTC

  # Swap tokens
  POST /api/dex/swap  {"from":"AVAX","to":"USDC","amount":"1"}

  # Post to Arena feed
  POST /api/social/thread  {"content":"Just swapped AVAX to USDC!"}

MCP PROTOCOL (if your platform supports it):
  Endpoint: POST /mcp
  Transport: Streamable HTTP
  Protocol: 2024-11-05
  Initialize, then call any of the 176 tools by name.

FOR DEVELOPERS (can npm install):
  npm install logiqical
  Then use: npx logiqical-mcp (stdio) or npx logiqical-mcp-http (server)

RULES:
1. Always check balance before executing trades
2. Never spend more than you can afford — use policy tools
3. POST endpoints broadcast transactions and return tx hashes
4. Confirm hashes on https://snowtrace.io/tx/{hash}
5. Use signals_summary before opening perps positions
6. Use dex_quote before swaps to check slippage

YOUR 127 TOOLS (22 modules):
  Wallet (8), Swap (4), Staking (4), DEX (5),
  Launchpad (6), Tickets (7), Bridge (8), Perps (20),
  Signals (8), Social (27), Market Data (6), DeFi (8),
  Policy (4), Copy Trading (5), Advanced (2)

WORKFLOW:
1. GET /api/signals/summary?coin=BTC  (check signals)
2. GET /api/balance  (check funds)
3. GET /api/dex/quote?from=AVAX&amp;to=USDC&amp;amount=1  (get quote)
4. POST /api/dex/swap  {"from":"AVAX","to":"USDC","amount":"1"}
5. POST /api/social/post-trade  {"action":"swap","fromToken":"AVAX","toToken":"USDC"}

Full docs: https://brave-alignment-production-1706.up.railway.app/agents</pre>
    </div>
  </section>

  <div class="footer">
    <p>Built for AI agents by <a href="https://arena.social">Arena</a> builders.</p>
    <p style="margin-top:8px;"><a href="https://www.npmjs.com/package/logiqical">npm</a> &middot; <a href="https://github.com/pfrfrfr/logiqical">GitHub</a> &middot; <a href="/agents.md">Raw Docs (Markdown)</a> &middot; <a href="/health">Health Check</a></p>
  </div>
</div>

</body>
</html>`;

async function main() {
  const privateKey = process.env.LOGIQICAL_PRIVATE_KEY;
  const network = process.env.LOGIQICAL_NETWORK || "avalanche";
  const rpcUrl = process.env.LOGIQICAL_RPC_URL;
  const arenaApiKey = process.env.ARENA_API_KEY;
  const PORT = parseInt(process.env.PORT || "3000");

  let agent: Logiqical;

  if (privateKey) {
    agent = new Logiqical({ privateKey, network, rpcUrl, arenaApiKey });
    console.log(`Logiqical MCP HTTP — wallet ${agent.address}`);
  } else {
    agent = await Logiqical.boot({ network, rpcUrl, arenaApiKey });
    console.log(`Logiqical MCP HTTP — booted from keystore: ${agent.address}`);
  }

  const app = express();
  app.use(express.json());

  // Track transports by session
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const w = agent.address;

  // Execute transactions: for multi-tx arrays (e.g. approve+deposit), wait for confirmation
  // between each tx to ensure on-chain state is updated before the next tx.
  async function fastExecute(resultOrPromise: any) {
    const result = await resultOrPromise;
    const txs: UnsignedTx[] = result.transactions ?? (result.transaction ? [result.transaction] : []);
    if (txs.length === 0) throw new Error("No transactions to execute.");

    const hashes: string[] = [];
    for (let i = 0; i < txs.length; i++) {
      const utx = txs[i];
      agent.policyEngine.check(utx);
      const txResponse = await agent.signAndBroadcast(utx);
      hashes.push(txResponse.hash);
      // Wait for confirmation between txs (critical for approve+deposit patterns)
      // Skip waiting on the last tx for faster response
      if (i < txs.length - 1) {
        await txResponse.wait(1);
      }
    }
    return { hashes, status: "broadcast", message: "Transactions broadcast. Check hashes on explorer." };
  }

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      agent: w,
      tools: 176,
      transport: "streamable-http",
    });
  });

  // ── Agent Documentation Page (AI-readable) ──

  app.get("/agents", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(AGENTS_PAGE);
  });

  app.get("/agents.md", (_req, res) => {
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.send(AGENTS_MD);
  });

  app.get("/prompt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(AGENT_PROMPT);
  });

  // ── Simple REST API (for agents without MCP client) ──

  app.get("/api/address", (_req, res) => {
    res.json({ address: w, canSign: agent.canSign });
  });

  app.get("/api/balance", async (_req, res) => {
    try { res.json({ balance: await agent.getBalance(), token: "AVAX" }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/balances", async (req, res) => {
    try { res.json(await agent.swap.getBalances((req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Tickets
  app.get("/api/tickets/buy-price", async (req, res) => {
    try { res.json(await agent.tickets.getBuyPrice(req.query.subject as string, req.query.amount as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/tickets/sell-price", async (req, res) => {
    try { res.json(await agent.tickets.getSellPrice(req.query.subject as string, req.query.amount as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/tickets/buy", async (req, res) => {
    try { res.json(await fastExecute(agent.tickets.buildBuyTx(w, req.body.subject, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/tickets/sell", async (req, res) => {
    try { res.json(await fastExecute(agent.tickets.buildSellTx(w, req.body.subject, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // DEX
  app.get("/api/dex/quote", async (req, res) => {
    try { res.json(await agent.dex.quote(req.query.from as string, req.query.to as string, req.query.amount as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/dex/swap", async (req, res) => {
    try { res.json(await fastExecute(agent.dex.buildSwap(w, req.body.from, req.body.to, req.body.amount, req.body.slippage))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Swap (ARENA)
  app.post("/api/swap/buy", async (req, res) => {
    try { res.json(await fastExecute(agent.swap.buildBuy(w, req.body.avax, req.body.slippage))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/swap/sell", async (req, res) => {
    try { res.json(await fastExecute(agent.swap.buildSell(w, req.body.amount, req.body.slippage))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Staking
  app.get("/api/stake/info", async (req, res) => {
    try { res.json(await agent.staking.getInfo((req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/stake", async (req, res) => {
    try { res.json(await fastExecute(agent.staking.buildStake(w, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/unstake", async (req, res) => {
    try { res.json(await fastExecute(agent.staking.buildUnstake(w, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Launchpad
  app.get("/api/launchpad/recent", async (req, res) => {
    try { res.json(await agent.launchpad.getRecent(parseInt(req.query.count as string) || 10)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/launchpad/token", async (req, res) => {
    try { res.json(await agent.launchpad.getToken(req.query.tokenId as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/launchpad/buy", async (req, res) => {
    try { res.json(await fastExecute(agent.launchpad.buildBuy(w, req.body.tokenId, req.body.avax, req.body.slippage))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/launchpad/sell", async (req, res) => {
    try { res.json(await fastExecute(agent.launchpad.buildSell(w, req.body.tokenId, req.body.amount, req.body.slippage))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Send AVAX
  app.post("/api/send", async (req, res) => {
    try {
      const { ethers } = await import("ethers");
      const valueWei = ethers.parseEther(req.body.amount);
      const utx: UnsignedTx = { to: req.body.to, data: "0x", value: valueWei.toString(), chainId: 43114 };
      const txResponse = await agent.signAndBroadcast(utx);
      res.json({ hash: txResponse.hash, status: "broadcast" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Social
  app.post("/api/social/thread", async (req, res) => {
    try { res.json(await agent.social.createThread(req.body.content)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/post-trade", async (req, res) => {
    try { res.json(await agent.social.postTradeUpdate(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Signals
  app.get("/api/signals/summary", async (req, res) => {
    try { res.json(await agent.signals.summary(req.query.coin as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/scan", async (req, res) => {
    try { res.json(await agent.signals.scan(parseInt(req.query.count as string) || 5)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/market", async (req, res) => {
    try { res.json(await agent.signals.getMarketSignal(req.query.coin as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/technical", async (req, res) => {
    try { res.json(await agent.signals.getTechnicalSignal(req.query.coin as string, req.query.interval as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/whales", async (req, res) => {
    try { res.json(await agent.signals.getWhalePositions(req.query.coin as string, req.query.minUsd ? parseInt(req.query.minUsd as string) : undefined)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/funding", async (req, res) => {
    try { res.json(await agent.signals.getFundingExtremes(parseInt(req.query.count as string) || 10)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/asset-contexts", async (_req, res) => {
    try { res.json(await agent.signals.getAssetContexts()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/signals/candles", async (req, res) => {
    try { res.json(await agent.signals.getCandles(req.query.coin as string, (req.query.interval as string) || "1h", parseInt(req.query.count as string) || 100)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Launchpad (full)
  app.get("/api/launchpad/overview", async (_req, res) => {
    try { res.json(await agent.launchpad.getOverview()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/launchpad/quote", async (req, res) => {
    try { res.json(await agent.launchpad.quote(req.query.tokenId as string, req.query.side as "buy" | "sell", req.query.amount as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // DEX (full)
  app.get("/api/dex/tokens", (_req, res) => {
    try { res.json(agent.dex.getTokens()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/dex/token-info", async (req, res) => {
    try { res.json(await agent.dex.getTokenInfo(req.query.address as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/dex/balance", async (req, res) => {
    try { res.json(await agent.dex.getBalance((req.query.wallet as string) || w, req.query.token as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Swap quotes
  app.get("/api/swap/quote-buy", async (req, res) => {
    try { res.json(await agent.swap.quote(req.query.avax as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/swap/quote-sell", async (req, res) => {
    try { res.json(await agent.swap.sellQuote(req.query.arena as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Staking (full)
  app.post("/api/stake/buy-and-stake", async (req, res) => {
    try { res.json(await fastExecute(agent.staking.buildBuyAndStake(w, req.body.avax))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Tickets (full)
  app.get("/api/tickets/balance", async (req, res) => {
    try { res.json(await agent.tickets.getBalance(req.query.subject as string, (req.query.user as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/tickets/supply", async (req, res) => {
    try { res.json(await agent.tickets.getSupply(req.query.subject as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/tickets/fees", async (_req, res) => {
    try { res.json(await agent.tickets.getFees()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Bridge
  app.get("/api/bridge/info", (_req, res) => {
    try { res.json(agent.bridge.getInfo()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/chains", async (_req, res) => {
    try { res.json(await agent.bridge.getChains()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/tokens", async (req, res) => {
    try { res.json(await agent.bridge.getTokens(req.query.chains as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/quote", async (req, res) => {
    try {
      res.json(await agent.bridge.getQuote(
        parseInt(req.query.fromChainId as string), parseInt(req.query.toChainId as string),
        req.query.fromToken as string, req.query.toToken as string,
        req.query.fromAmount as string, (req.query.fromAddress as string) || w,
        undefined, req.query.slippage ? parseFloat(req.query.slippage as string) : undefined,
      ));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/routes", async (req, res) => {
    try {
      res.json(await agent.bridge.getRoutes(
        parseInt(req.query.fromChainId as string), parseInt(req.query.toChainId as string),
        req.query.fromToken as string, req.query.toToken as string,
        req.query.fromAmount as string, (req.query.fromAddress as string) || w,
      ));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/status", async (req, res) => {
    try { res.json(await agent.bridge.getStatus(req.query.txHash as string, parseInt(req.query.fromChainId as string), parseInt(req.query.toChainId as string))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/token", async (req, res) => {
    try { res.json(await agent.bridge.getToken(parseInt(req.query.chainId as string), req.query.address as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/bridge/connections", async (req, res) => {
    try { res.json(await agent.bridge.getConnections(parseInt(req.query.fromChainId as string), parseInt(req.query.toChainId as string), req.query.fromToken as string, req.query.toToken as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Perps
  app.post("/api/perps/register", async (_req, res) => {
    try { res.json(await agent.perps.register()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/status", async (_req, res) => {
    try { res.json(await agent.perps.getRegistrationStatus()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/wallet", async (_req, res) => {
    try { res.json(await agent.perps.getWalletAddress()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/trading-pairs", async (_req, res) => {
    try { res.json(await agent.perps.getTradingPairs()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/leverage", async (req, res) => {
    try { res.json(await agent.perps.updateLeverage(req.body.symbol, req.body.leverage, req.body.leverageType)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/order", async (req, res) => {
    try { res.json(await agent.perps.placeOrder(req.body.orders)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/cancel", async (req, res) => {
    try { res.json(await agent.perps.cancelOrders(req.body.cancels)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/close", async (req, res) => {
    try { res.json(await agent.perps.closePosition(req.body.symbol, req.body.positionSide, req.body.size, req.body.currentPrice, req.body.closePercent)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/orders", async (_req, res) => {
    try { res.json(await agent.perps.getOrders()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/positions", async (req, res) => {
    try { res.json(await agent.perps.getPositions((req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/deposit-info", (_req, res) => {
    try { res.json(agent.perps.getDepositInfo()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/arbitrum-usdc-balance", async (req, res) => {
    try { res.json({ balance: await agent.perps.getArbitrumUSDCBalance((req.query.wallet as string) || w), token: "USDC", chain: "Arbitrum" }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/deposit-usdc", async (req, res) => {
    try { res.json(agent.perps.buildDepositUSDC(req.body.amount)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/auth-status", async (_req, res) => {
    try { res.json(await agent.perps.getAuthStatus()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/auth-payload", async (req, res) => {
    try { res.json(await agent.perps.getAuthPayload(req.body.step, req.body.mainWalletAddress)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/auth-submit", async (req, res) => {
    try { res.json(await agent.perps.submitAuthSignature(req.body.step, req.body.signature, req.body.mainWalletAddress, req.body.metadata)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/perps/enable-hip3", async (_req, res) => {
    try { res.json(await agent.perps.enableHip3()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/trade-history", async (_req, res) => {
    try { res.json(await agent.perps.getTradeExecutions()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/open-orders", async (req, res) => {
    try { res.json(await agent.perps.getOpenOrders((req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/perps/arbitrum-eth-balance", async (req, res) => {
    try { res.json({ balance: await agent.perps.getArbitrumETHBalance((req.query.wallet as string) || w), token: "ETH", chain: "Arbitrum" }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Copy Trading
  app.get("/api/copy/positions", async (req, res) => {
    try { res.json(await agent.copyTrading.getTargetPositions(req.query.wallet as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/copy/calculate", async (req, res) => {
    try { res.json(await agent.copyTrading.calculateMirrorOrders(req.body.targetWallet, req.body.agentWallet || w, req.body.scaleFactor)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/copy/execute", async (req, res) => {
    try { res.json(await agent.copyTrading.copyOnce(req.body.targetWallet, req.body.agentWallet || w, req.body.scaleFactor)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/copy/agent-positions", async (req, res) => {
    try { res.json(await agent.copyTrading.getAgentPositions((req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/copy/execute-orders", async (req, res) => {
    try { res.json(await agent.copyTrading.executeMirrorOrders(req.body.orders, req.body.currentPrices)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Social (full)
  app.get("/api/social/me", async (_req, res) => {
    try { res.json(await agent.social.getMe()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/search", async (req, res) => {
    try { res.json(await agent.social.searchUsers(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/user/:handle", async (req, res) => {
    try {
      const data = await agent.social.getUserByHandle(req.params.handle);
      if (!data?.user?.id) {
        res.status(404).json({ error: `User @${req.params.handle} not found on Arena. Use GET /api/social/search?q=${req.params.handle} to find similar handles.` });
        return;
      }
      res.json(data);
    }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/top", async (_req, res) => {
    try { res.json(await agent.social.getTopUsers()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/follow", async (req, res) => {
    try { res.json(await agent.social.follow(req.body.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/unfollow", async (req, res) => {
    try { res.json(await agent.social.unfollow(req.body.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/social/profile", async (req, res) => {
    try { res.json(await agent.social.updateProfile(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/conversations", async (_req, res) => {
    try { res.json(await agent.social.getConversations()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/message", async (req, res) => {
    try { res.json(await agent.social.sendMessage(req.body.groupId, req.body.text, req.body.replyId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/messages/:groupId", async (req, res) => {
    try { res.json(await agent.social.getMessages(req.params.groupId, req.query.after as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/messages/:groupId/older", async (req, res) => {
    try { res.json(await agent.social.getOlderMessages(req.params.groupId, req.query.before as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/like", async (req, res) => {
    try { res.json(await agent.social.likeThread(req.body.threadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/repost", async (req, res) => {
    try { res.json(await agent.social.repost(req.body.threadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/banner", async (req, res) => {
    try { res.json(await agent.social.updateBanner(req.body.bannerUrl)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/user-by-id/:userId", async (req, res) => {
    try { res.json(await agent.social.getUserById(req.params.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/followers/:userId", async (req, res) => {
    try { res.json(await agent.social.getFollowers(req.params.userId, parseInt(req.query.page as string) || 1, parseInt(req.query.pageSize as string) || 20)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/following/:userId", async (req, res) => {
    try { res.json(await agent.social.getFollowing(req.params.userId, parseInt(req.query.page as string) || 1, parseInt(req.query.pageSize as string) || 20)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/shares-stats/:userId", async (req, res) => {
    try { res.json(await agent.social.getSharesStats(req.params.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/shareholders", async (req, res) => {
    try { res.json(await agent.social.getShareHolders(req.query.userId as string, parseInt(req.query.page as string) || 1, parseInt(req.query.pageSize as string) || 20)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/holdings", async (_req, res) => {
    try { res.json(await agent.social.getHoldings()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/direct-messages", async (_req, res) => {
    try { res.json(await agent.social.getDirectMessages()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/group-chats", async (_req, res) => {
    try { res.json(await agent.social.getGroupChats()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/group/:groupId", async (req, res) => {
    try { res.json(await agent.social.getGroup(req.params.groupId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/group/:groupId/members", async (req, res) => {
    try { res.json(await agent.social.getMembers(req.params.groupId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/dm", async (req, res) => {
    try { res.json(await agent.social.getOrCreateDM(req.body.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/accept-chat", async (req, res) => {
    try { res.json(await agent.social.acceptChat(req.body.groupId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/search-messages", async (req, res) => {
    try { res.json(await agent.social.searchMessages(req.query.q as string, req.query.groupId as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/react", async (req, res) => {
    try { res.json(await agent.social.react(req.body.messageId, req.body.groupId, req.body.reaction)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Agent Registration
  app.post("/api/social/register", async (req, res) => {
    try { res.json(await SocialModule.registerAgent(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Social: Additional Chat
  app.post("/api/social/unreact", async (req, res) => {
    try { res.json(await agent.social.unreact(req.body.messageId, req.body.groupId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/leave-chat", async (req, res) => {
    try { res.json(await agent.social.leaveChat(req.body.groupId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/search-rooms", async (req, res) => {
    try { res.json(await agent.social.searchRooms(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/search-dms", async (req, res) => {
    try { res.json(await agent.social.searchDMs(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/search-project-chats", async (req, res) => {
    try { res.json(await agent.social.searchProjectChats(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/pin-group", async (req, res) => {
    try { res.json(await agent.social.pinGroup(req.body.groupId, req.body.isPinned)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/chat-settings", async (_req, res) => {
    try { res.json(await agent.social.getChatSettings()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/social/chat-settings", async (req, res) => {
    try { res.json(await agent.social.updateChatSettings(req.body.holders, req.body.followers)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/messages/:groupId/around/:messageId", async (req, res) => {
    try { res.json(await agent.social.getMessagesAround(req.params.groupId, req.params.messageId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/messages/:groupId/unread", async (req, res) => {
    try { res.json(await agent.social.getUnreadMessages(req.params.groupId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/mention-status", async (req, res) => {
    try { res.json(await agent.social.getMentionStatus(req.query.groupIds as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/social/group/:groupId/mute", async (req, res) => {
    try { res.json(await agent.social.muteGroup(req.params.groupId, req.body.muted)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/chat-requests", async (req, res) => {
    try { res.json(await agent.social.getChatRequests(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Social: User Profile
  app.get("/api/social/profile/:handle", async (req, res) => {
    try { res.json(await agent.social.getUserProfile(req.params.handle)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Social: Threads & Feed
  app.get("/api/social/thread/:threadId", async (req, res) => {
    try { res.json(await agent.social.getThread(req.params.threadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/answer", async (req, res) => {
    try { res.json(await agent.social.answerThread(req.body.content, req.body.threadId, req.body.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/thread/:threadId/answers", async (req, res) => {
    try { res.json(await agent.social.getThreadAnswers(req.params.threadId, parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/thread/:threadId/nested", async (req, res) => {
    try { res.json(await agent.social.getNestedAnswers(req.params.threadId, parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/unlike", async (req, res) => {
    try { res.json(await agent.social.unlikeThread(req.body.threadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/social/thread/:threadId", async (req, res) => {
    try { res.json(await agent.social.deleteThread(req.params.threadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/social/repost/:threadId", async (req, res) => {
    try { res.json(await agent.social.deleteRepost(req.params.threadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/quote", async (req, res) => {
    try { res.json(await agent.social.quoteThread(req.body.content, req.body.quotedThreadId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/feed/my", async (req, res) => {
    try { res.json(await agent.social.getMyFeed(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/feed/trending", async (req, res) => {
    try { res.json(await agent.social.getTrendingPosts(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/feed/user/:userId", async (req, res) => {
    try { res.json(await agent.social.getUserThreads(req.params.userId, parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/feed/community/:communityId", async (req, res) => {
    try { res.json(await agent.social.getCommunityFeed(req.params.communityId, parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Notifications
  app.get("/api/social/notifications", async (req, res) => {
    try { res.json(await agent.social.getNotifications(parseInt(req.query.page as string) || 1, 20, req.query.type as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/notifications/unseen", async (req, res) => {
    try { res.json(await agent.social.getUnseenNotifications(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/notifications/seen", async (req, res) => {
    try { res.json(await agent.social.markNotificationSeen(req.body.notificationId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/notifications/seen/all", async (_req, res) => {
    try { res.json(await agent.social.markAllNotificationsSeen()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Communities
  app.get("/api/social/communities/top", async (req, res) => {
    try { res.json(await agent.social.getTopCommunities(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/communities/new", async (req, res) => {
    try { res.json(await agent.social.getNewCommunities(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/communities/search", async (req, res) => {
    try { res.json(await agent.social.searchCommunities(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/community/follow", async (req, res) => {
    try { res.json(await agent.social.followCommunity(req.body.communityId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/community/unfollow", async (req, res) => {
    try { res.json(await agent.social.unfollowCommunity(req.body.communityId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Shares (additional)
  app.get("/api/social/earnings/:userId", async (req, res) => {
    try { res.json(await agent.social.getEarningsBreakdown(req.params.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/holder-addresses/:userId", async (req, res) => {
    try { res.json(await agent.social.getHolderAddresses(req.params.userId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Stages
  app.post("/api/social/stage", async (req, res) => {
    try { res.json(await agent.social.createStage(req.body.name, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/stage/start", async (req, res) => {
    try { res.json(await agent.social.startStage(req.body.stageId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/stage/end", async (req, res) => {
    try { res.json(await agent.social.endStage(req.body.stageId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/stages", async (req, res) => {
    try { res.json(await agent.social.getActiveStages(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/stage/:stageId", async (req, res) => {
    try { res.json(await agent.social.getStageInfo(req.params.stageId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/stage/join", async (req, res) => {
    try { res.json(await agent.social.joinStage(req.body.stageId, req.body.role)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/stage/leave", async (req, res) => {
    try { res.json(await agent.social.leaveStage(req.body.stageId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Livestreams
  app.post("/api/social/livestream", async (req, res) => {
    try { res.json(await agent.social.createLivestream(req.body.name, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/livestream/start", async (req, res) => {
    try { res.json(await agent.social.startLivestream(req.body.livestreamId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/social/livestream/end", async (req, res) => {
    try { res.json(await agent.social.endLivestream(req.body.livestreamId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/social/livestreams", async (req, res) => {
    try { res.json(await agent.social.getActiveLivestreams(parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Market Data
  app.get("/api/market/price", async (req, res) => {
    try { res.json(await agent.market.price((req.query.ids as string).split(",").map(s => s.trim()))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/trending", async (_req, res) => {
    try { res.json(await agent.market.trending()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/top", async (req, res) => {
    try { res.json(await agent.market.markets(parseInt(req.query.count as string) || 20, parseInt(req.query.page as string) || 1)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/search", async (req, res) => {
    try { res.json(await agent.market.search(req.query.q as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/avax", async (_req, res) => {
    try { res.json(await agent.market.avaxPrice()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/arena", async (_req, res) => {
    try { res.json(await agent.market.arenaPrice()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // DeFi
  app.get("/api/defi/savax", async (req, res) => {
    try { res.json(await agent.defi.sAvaxInfo((req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/defi/savax/quote", async (req, res) => {
    try { res.json(await agent.defi.sAvaxStakeQuote(req.query.avax as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/defi/savax/stake", async (req, res) => {
    try { res.json(await fastExecute(agent.defi.buildSAvaxStake(req.body.avax))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/defi/savax/unstake", async (req, res) => {
    try { res.json(await fastExecute(agent.defi.buildSAvaxUnstake(w, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/defi/vault", async (req, res) => {
    try { res.json(await agent.defi.vaultInfo(req.query.vault as string, (req.query.wallet as string) || w)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/defi/vault/quote", async (req, res) => {
    try { res.json(await agent.defi.vaultDepositQuote(req.query.vault as string, req.query.amount as string)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/defi/vault/deposit", async (req, res) => {
    try { res.json(await fastExecute(agent.defi.buildVaultDeposit(w, req.body.vault, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/defi/vault/withdraw", async (req, res) => {
    try { res.json(await fastExecute(agent.defi.buildVaultWithdraw(w, req.body.vault, req.body.amount))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Policy
  app.get("/api/policy", (_req, res) => {
    try { res.json(agent.getPolicy()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/policy", (req, res) => {
    try { agent.setPolicy(req.body); res.json({ status: "updated", policy: agent.getPolicy() }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/policy/budget", (_req, res) => {
    try { res.json(agent.getBudgetStatus()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Sign message
  app.post("/api/sign", async (req, res) => {
    try { res.json({ signature: await agent.signMessage(req.body.message) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Sign EIP-712 typed data
  app.post("/api/sign-typed-data", async (req, res) => {
    try { res.json({ signature: await agent.signTypedData(req.body.domain, req.body.types, req.body.value) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Simulate transaction
  app.post("/api/simulate", async (req, res) => {
    try { await agent.simulate({ to: req.body.to, data: req.body.data, value: req.body.value || "0", chainId: 43114 }); res.json({ status: "simulation_passed" }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Switch network
  app.post("/api/switch-network", async (req, res) => {
    try { const newAgent = agent.switchNetwork(req.body.network); res.json({ status: "switched", network: req.body.network, address: newAgent.address }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Update policy (partial)
  app.patch("/api/policy", (req, res) => {
    try { agent.updatePolicy(req.body); res.json({ status: "updated", policy: agent.getPolicy() }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Call any contract
  app.post("/api/call", async (req, res) => {
    try { res.json(await agent.call(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // x402 Micropayments
  app.post("/api/x402/create", async (req, res) => {
    try {
      res.json(await agent.x402.createApi({
        apiUrl: req.body.apiUrl,
        merchantWallet: req.body.merchantWallet || w,
        tokenAddress: req.body.tokenAddress,
        amountWei: req.body.amountWei,
        validForSec: req.body.validForSec,
        name: req.body.name,
        description: req.body.description,
        webhookUri: req.body.webhookUri,
      }));
    }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/x402/access/:apiId", async (req, res) => {
    try {
      const sessionId = req.headers["x-402-session"] as string | undefined;
      const result = await agent.x402.access(req.params.apiId, sessionId);
      res.status(result.status).json(result.body);
    }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/x402/pay", async (req, res) => {
    try {
      const { session_id, contract, amount_wei, merchant_wallet, token_address } = req.body;
      const payment = { session_id, contract, amount_wei, merchant_wallet, token_address, network: { chain_id: 43114, name: "Avalanche C-Chain" }, calls: {} as any };
      const built = agent.x402.buildPayment(payment);
      const results = await fastExecute(Promise.resolve(built));
      res.json(results);
    }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // MCP endpoint — handles POST (requests), GET (SSE stream), DELETE (close)
  app.all("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "POST") {
      // Check if this is an initialization request (no session ID)
      if (!sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        const server = createMcpServer(agent);

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
        };

        await server.connect(transport);

        const sid = transport.sessionId;
        if (sid) transports.set(sid, transport);

        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Existing session
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === "GET") {
      // SSE stream for server-initiated messages
      if (!sessionId) {
        res.status(400).json({ error: "Session ID required for GET" });
        return;
      }
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "DELETE") {
      // Close session
      if (sessionId) {
        const transport = transports.get(sessionId);
        if (transport) {
          await transport.handleRequest(req, res);
          transports.delete(sessionId);
          return;
        }
      }
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Logiqical MCP HTTP server on port ${PORT}`);
    console.log(`MCP endpoint: POST/GET/DELETE /mcp`);
    console.log(`Health: GET /health`);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
