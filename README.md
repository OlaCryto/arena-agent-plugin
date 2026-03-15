# Arena Agent Plugin

Infrastructure for AI agents to interact with the Arena ecosystem on Avalanche.

REST API + MCP server that lets any AI agent trade tokens, stake, explore the launchpad, and swap on LFJ DEX — all on Avalanche C-Chain.

## Features

| Module | What it does | Status |
|--------|-------------|--------|
| **ARENA Swap** | Buy/sell ARENA token (AVAX↔ARENA) via ArenaRouter | Done |
| **Staking** | Stake/unstake ARENA, earn 2.5% of graduating tokens | Done |
| **Launchpad** | Discover, research, and trade bonding curve tokens | Done |
| **General DEX Swaps** | Swap any token on Avalanche via LFJ (Trader Joe) — 14 tokens pre-loaded + any address | Done |

### General DEX Swaps — Supported Tokens

| Symbol | Name | Decimals |
|--------|------|----------|
| AVAX | Avalanche | 18 |
| USDC | USD Coin | 6 |
| USDT | Tether USD | 6 |
| BTC.b | Bitcoin (Bridged) | 8 |
| WETH.e | Wrapped Ether | 18 |
| sAVAX | Staked AVAX (Benqi) | 18 |
| JOE | Trader Joe | 18 |
| ARENA | Arena | 18 |
| GMX | GMX | 18 |
| COQ | Coq Inu | 18 |
| PHAR | Pharaoh | 18 |
| USDC.e | USD Coin (Bridged) | 6 |
| USDT.e | Tether USD (Bridged) | 6 |
| WAVAX | Wrapped AVAX | 18 |

Agents can also pass any ERC-20 contract address — not limited to the list above.

## Architecture

```
src/
├── core/        — Shared types, constants, provider
├── swap/        — SwapModule (ARENA buy/sell)
├── staking/     — StakingModule (stake/unstake/rewards)
├── launchpad/   — LaunchpadModule (discovery, intelligence, trading)
├── dex/         — DexModule (general token swaps via LFJ)
├── data/        — API keys, Arena API, position tracking
├── routes/      — Express route handlers (split by domain)
├── server.ts    — Thin Express shell
└── mcp.ts       — MCP server for Claude agents
```

## Deploy to Railway

Each user deploys their own instance — no shared wallets.

### 1. Fork this repo

### 2. Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template)

Or manually:
1. Go to [railway.com](https://railway.com) and create a new project
2. Select "Deploy from GitHub repo" and pick your fork
3. Set environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Your wallet private key |
| `ARENA_ROUTER` | Yes | ArenaRouter contract address (0.3% fee on buys) |
| `PORT` | No | Server port (Railway sets this automatically) |
| `RPC_URL` | No | Avalanche RPC (has a default) |

4. Railway builds and deploys automatically.

### 3. Register an API key

```bash
curl "https://your-app.up.railway.app/register?wallet=0xYOUR_WALLET&name=my-agent"
```

Use the returned key as `X-API-Key` header on all requests.

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/register?wallet=&name=` | Get API key (one per wallet) |

### Agent Instructions (public, no key needed)
| Endpoint | Description |
|----------|-------------|
| GET `/agent-instructions` | Staking agent prompt |
| GET `/swap/agent-instructions` | Swap agent prompt |
| GET `/launchpad/agent-instructions` | Launchpad trading agent prompt |
| GET `/dex/agent-instructions` | General DEX swap agent prompt |

### ARENA Swap (X-API-Key required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/balances?wallet=` | AVAX + ARENA balances |
| GET | `/quote?avax=` | Buy quote |
| GET | `/quote/sell?arena=` | Sell quote |
| GET | `/build/buy?wallet=&avax=` | Build unsigned buy tx |
| GET | `/build/sell-arena?wallet=&amount=` | Build unsigned sell txs (approve + swap) |
| POST | `/broadcast` | Broadcast signed tx `{ "signedTx": "0x..." }` |

### Staking (X-API-Key required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stake/info?wallet=` | Staked amount + pending rewards |
| GET | `/build/stake?wallet=&amount=` | Build stake txs (approve + deposit) |
| GET | `/build/unstake?wallet=&amount=` | Build unstake tx |
| GET | `/build/buy-and-stake?wallet=&avax=` | Buy + stake (3 txs) |

### Launchpad (X-API-Key required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/launchpad/recent` | Recently launched tokens |
| GET | `/launchpad/top-volume?timeframe=5m` | Trending tokens |
| GET | `/launchpad/graduating` | Tokens about to graduate |
| GET | `/launchpad/graduated` | Already graduated tokens |
| GET | `/launchpad/search?q=` | Search by name/symbol/address |
| GET | `/launchpad/token?tokenId=` | Full token details |
| GET | `/launchpad/market-cap?tokenId=` | Market cap breakdown |
| GET | `/launchpad/activity?tokenId=` | Recent buys/sells |
| GET | `/launchpad/holders?address=` | Holder distribution + PnL |
| GET | `/launchpad/trades` | Platform-wide trade feed |
| GET | `/launchpad/overview` | Platform stats |
| GET | `/launchpad/quote?tokenId=&avax=&side=` | Price quote |
| GET | `/launchpad/build/buy?wallet=&tokenId=&avax=` | Build buy tx |
| GET | `/launchpad/build/sell?wallet=&tokenId=&amount=` | Build sell txs |
| GET | `/launchpad/portfolio?wallet=` | Position tracking + PnL |

### General DEX Swaps (X-API-Key required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dex/tokens` | List supported tokens |
| GET | `/dex/token-info?address=` | Look up any ERC-20 |
| GET | `/dex/quote?from=&to=&amount=` | Quote any token pair |
| GET | `/dex/balance?wallet=&token=` | Check any token balance |
| GET | `/dex/build/swap?wallet=&from=&to=&amount=` | Build swap tx(s) |

## Agent Integration

### OpenAPI
Point your agent to: `https://your-app.up.railway.app/openapi.json`

Works with OpenAI GPTs, LangChain, CrewAI, AutoGPT, and any OpenAPI-compatible framework.

### MCP (Claude agents)
```json
{
  "mcpServers": {
    "arena": {
      "command": "node",
      "args": ["/path/to/plugin/dist/mcp.js"],
      "env": {
        "PRIVATE_KEY": "your_key_here"
      }
    }
  }
}
```

### Agent Instructions
Give your agent one of these URLs and it will know everything it needs:
```
https://your-app.up.railway.app/agent-instructions           # Staking
https://your-app.up.railway.app/swap/agent-instructions       # ARENA swap
https://your-app.up.railway.app/launchpad/agent-instructions  # Launchpad trading
https://your-app.up.railway.app/dex/agent-instructions        # General DEX swaps
```

## Run Locally

```bash
npm install
cp .env.example .env   # Add your private key + ARENA_ROUTER
npm run build
npm start              # REST API on port 3000
npm run mcp            # MCP server on stdio
```

## Contracts

| Contract | Address |
|----------|---------|
| ARENA Token | `0xB8d7710f7d8349A506b75dD184F05777c82dAd0C` |
| Arena Staking | `0xeFFB809d99142Ce3b51c1796c096f5b01B4aAeC4` |
| LFJ Router V2.2 | `0x18556DA13313f3532c54711497A8FedAC273220E` |
| LFJ Quoter | `0x9A550a522BBaDFB69019b0432800Ed17855A51C3` |
| Launch Contract (AVAX-paired) | `0x8315f1eb449Dd4B779495C3A0b05e5d194446c6e` |
| Token Manager (ARENA-paired) | `0x2196e106af476f57618373ec028924767c758464` |
| AVAX Helper | `0x03f1A18519aBeDbEf210FA44e13b71fec01b8dFa` |
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` |

All on Avalanche C-Chain (chainId: 43114).

## Security

- Each user deploys their own instance with their own private key
- Private keys never leave your environment
- API builds **unsigned transactions** — agents sign locally
- No shared wallets or custodial access
- API key auth on all trading endpoints
