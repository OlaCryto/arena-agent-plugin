# Logiqical Agent SDK

You have access to the Logiqical SDK — a non-custodial agent wallet for Avalanche and Arena with 91 MCP tools across 15 modules.

## Setup

The agent wallet is already booted. Use MCP tools directly. No imports needed.

## Core Concepts

- **Every on-chain action goes through MCP tools** — you call tools, they sign and broadcast
- **Spending policies are enforced automatically** — per-tx limits, hourly/daily budgets, simulation
- **Arena API key is required** for social, perps, and tickets tools (set via `ARENA_API_KEY` env var)

## Available Tools (91 total)

### Wallet (4 tools)
- `get_address` — your agent wallet address
- `get_balance` — AVAX balance
- `send_avax` — send AVAX to any address
- `sign_message` — sign arbitrary messages

### ARENA Token (6 tools)
- `get_balances` — AVAX + ARENA balances
- `swap_quote_buy` — quote AVAX to ARENA
- `swap_quote_sell` — quote ARENA to AVAX
- `swap_buy_arena` — buy ARENA with AVAX
- `swap_sell_arena` — sell ARENA for AVAX

### Staking (4 tools)
- `stake_info` — staked amount + pending rewards
- `stake_arena` — stake ARENA tokens
- `unstake_arena` — unstake + claim rewards
- `buy_and_stake` — buy ARENA + stake in one tx

### DEX — Any Token Swap (6 tools)
- `dex_tokens` — list known tokens
- `dex_token_info` — look up any ERC-20 by address
- `dex_balance` — check any token balance
- `dex_quote` — quote any token pair
- `dex_swap` — swap any tokens on Avalanche

### Launchpad (6 tools)
- `launchpad_overview` — platform stats
- `launchpad_recent` — recently launched tokens
- `launchpad_token` — full token info by ID
- `launchpad_quote` — bonding curve price quote
- `launchpad_buy` — buy a launchpad token
- `launchpad_sell` — sell a launchpad token

### Tickets (8 tools)
- `tickets_buy_price` / `tickets_sell_price` — price quotes
- `tickets_balance` — ticket balance
- `tickets_supply` — total supply
- `tickets_fees` — fee structure
- `tickets_buy` / `tickets_sell` — buy/sell tickets

### Bridge — Cross-Chain (8 tools)
- `bridge_info` — supported chains + USDC addresses
- `bridge_chains` — all supported chains
- `bridge_tokens` — tokens on specified chains
- `bridge_quote` — bridge quote with transaction
- `bridge_routes` — multiple route options
- `bridge_status` — check transfer status

### Perps — Perpetual Futures (12 tools)
- `perps_register` — register for Hyperliquid perps
- `perps_registration_status` — check registration
- `perps_wallet_address` — get Hyperliquid wallet
- `perps_trading_pairs` — all 250+ pairs
- `perps_update_leverage` — set leverage (1-50x)
- `perps_place_order` — place orders
- `perps_cancel_orders` — cancel orders
- `perps_close_position` — close a position
- `perps_orders` — view open orders
- `perps_positions` — positions + margin summary
- `perps_deposit_info` — Hyperliquid deposit addresses
- `perps_arbitrum_usdc_balance` — USDC balance on Arbitrum
- `perps_deposit_usdc` — build USDC deposit tx

### Signals Intelligence (6 tools)
- `signals_market` — price, funding, OI, volume
- `signals_technical` — SMA, RSI, trend, support/resistance
- `signals_whales` — whale positions from orderbook
- `signals_funding` — funding rate extremes
- `signals_summary` — full signal digest + verdict
- `signals_scan` — scan all markets for opportunities

### Social (14 tools)
- `social_search_users` — search Arena users
- `social_user_by_handle` — get user by handle
- `social_me` — your Arena profile
- `social_top_users` — top users
- `social_follow` / `social_unfollow` — follow/unfollow
- `social_update_profile` — update profile
- `social_conversations` — list chats
- `social_send_message` — send a message
- `social_messages` — read messages
- `social_create_thread` — create a post
- `social_like_thread` — like a thread
- `social_post_trade` — auto-post a trade update

### Agent Registration (1 tool)
- `agent_register` — register a new AI agent on Arena (returns API key)

### Copy Trading (3 tools)
- `copy_get_positions` — get target wallet positions
- `copy_calculate_orders` — calculate mirror orders
- `copy_execute` — one-shot copy trade

### Market Data (6 tools)
- `market_price` — prices, 24h change, market cap
- `market_trending` — trending coins
- `market_top` — top by market cap
- `market_search` — search coins
- `market_avax_price` / `market_arena_price` — quick price checks

### DeFi (8 tools)
- `defi_savax_info` — sAVAX exchange rate + balances
- `defi_savax_quote` — quote AVAX to sAVAX
- `defi_savax_stake` — stake AVAX to sAVAX
- `defi_savax_unstake` — unstake sAVAX
- `defi_vault_info` — ERC-4626 vault info
- `defi_vault_quote` — vault deposit quote
- `defi_vault_deposit` — deposit into vault
- `defi_vault_withdraw` — withdraw from vault

### Policy (3 tools)
- `policy_get` — current spending policy
- `policy_set` — replace policy
- `policy_budget` — budget status (spent today, remaining)

### Contract Call (1 tool)
- `call_contract` — call any smart contract method

## Patterns

### Before trading, always check balances first
```
1. get_balance (check AVAX)
2. get_balances (check ARENA)
3. Then swap/trade
```

### Before perps, check registration
```
1. perps_registration_status
2. If not registered: perps_register
3. Then trade
```

### For copy trading
```
1. copy_get_positions (see what the target holds)
2. copy_calculate_orders (see what you'd need to do)
3. copy_execute (or execute manually with perps_place_order)
```

### For cross-chain operations
```
1. bridge_info (get chain IDs and token addresses)
2. bridge_quote (get quote + tx)
3. Execute the bridge tx
4. bridge_status (poll until complete)
```

### Always check policy before large trades
```
1. policy_budget (check remaining budget)
2. If over limit, inform the user
3. policy_set to adjust if user approves
```

## Important Notes

- All on-chain transactions are real and irreversible. Always confirm with the user before executing trades.
- The agent wallet's private key is stored in an encrypted keystore at `~/.logiqical/keys/agent.json`.
- Spending policies are your guardrails. Never disable simulation without the user's explicit consent.
- Arena API rate limits: 10 posts/hour, 120 orders/hour, 100 reads/minute.
- For perps, Arena holds the signing keys. Orders go through Arena's API, not direct on-chain.
