# Arena Agent Plugin

Buy and stake ARENA tokens on Avalanche — built for AI agents.

Provides REST API endpoints and an MCP server so any AI agent can interact with [The Arena](https://arena.social) SocialFi platform on Avalanche C-Chain.

## What it does

- **Buy ARENA** — Swap AVAX → ARENA via LFJ (Trader Joe) DEX
- **Stake ARENA** — Deposit into Arena staking to become an Arena Champion (earn 2.5% of every graduating bonding curve token)
- **Buy & Stake** — One-call combo
- **Unstake** — Withdraw + claim rewards
- **Quotes & Balances** — Read-only price checks and wallet info

## Deploy to Railway (Recommended)

Each user deploys their own instance with their own private key.

### 1. Fork this repo

### 2. Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template)

Or manually:
1. Go to [railway.com](https://railway.com) and create a new project
2. Select "Deploy from GitHub repo" and pick your fork
3. Add these environment variables in Railway dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Your wallet private key (no 0x prefix) |
| `PORT` | No | Server port (Railway sets this automatically) |
| `RPC_URL` | No | Avalanche RPC (defaults to `https://api.avax.network/ext/bc/C/rpc`) |
| `SLIPPAGE_BPS` | No | Default slippage in basis points (default: 100 = 1%) |

4. Railway will build and deploy automatically. You'll get a public URL like `https://your-app.up.railway.app`

### 3. Test it

```bash
curl https://your-app.up.railway.app/health
curl https://your-app.up.railway.app/balances
```

## API Endpoints

| Method | Endpoint | Description | Params |
|--------|----------|-------------|--------|
| GET | `/health` | Health check | — |
| GET | `/balances` | AVAX + ARENA balances | — |
| GET | `/quote?avax=0.1` | Price quote (read-only) | `avax` |
| GET | `/stake/info` | Staked amount + pending rewards | — |
| GET/POST | `/buy?avax=0.1` | Buy ARENA with AVAX | `avax`, `slippage?` |
| GET/POST | `/stake?amount=max` | Stake ARENA tokens | `amount` or `"max"` |
| GET/POST | `/buy-and-stake?avax=0.1` | Buy + stake in one call | `avax`, `slippage?` |
| GET/POST | `/unstake?amount=max` | Withdraw staked ARENA | `amount` or `"max"` |
| GET | `/openapi.json` | OpenAPI spec for agent discovery | — |

## Agent Integration

### OpenAPI (any agent framework)

Point your agent to the OpenAPI spec:
```
https://your-app.up.railway.app/openapi.json
```

Works with OpenAI GPTs, LangChain, CrewAI, AutoGPT, and any framework that consumes OpenAPI specs.

### MCP (Claude agents)

Add to your Claude MCP config:
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

### Direct API calls

```bash
# Get a quote
curl "https://your-app.up.railway.app/quote?avax=1"

# Buy ARENA
curl "https://your-app.up.railway.app/buy?avax=0.1"

# Stake all ARENA
curl "https://your-app.up.railway.app/stake?amount=max"

# Buy and stake in one call
curl "https://your-app.up.railway.app/buy-and-stake?avax=0.1"

# Check staking position
curl "https://your-app.up.railway.app/stake/info"

# Unstake
curl "https://your-app.up.railway.app/unstake?amount=max"
```

## Run Locally

```bash
npm install
cp .env.example .env   # Add your private key
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
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` |

All on Avalanche C-Chain (chainId: 43114).

## Security

- Each user deploys their own instance with their own private key
- Private keys never leave your Railway environment
- No shared wallets or custodial access
