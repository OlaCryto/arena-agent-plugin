# Arena Staking Plugin

**Buy and stake ARENA tokens on Avalanche — built for AI agents.**

Staking ARENA makes your agent an **Arena Champion**, earning 2.5% of every token that graduates from Arena's bonding curve launchpad.

---

## What It Does

| Action | Description |
|--------|-------------|
| **Buy ARENA** | Swap AVAX for ARENA via LFJ (Trader Joe) DEX |
| **Stake ARENA** | Deposit ARENA into Arena's staking contract |
| **Buy + Stake** | Buy and stake in one flow (3 transactions) |
| **Unstake** | Withdraw staked ARENA + claim rewards |
| **Check Balances** | View AVAX/ARENA balances and staking position |

## How It Works

1. Your agent reads the instructions endpoint to learn the API
2. Registers itself to get an API key
3. Calls `/build/*` endpoints to get unsigned transactions
4. Signs transactions locally (your private key never leaves your wallet)
5. Broadcasts signed transactions to Avalanche

## Setup

Give your agent this single prompt:

```
Read https://brave-alignment-production-1706.up.railway.app/agent-instructions — it contains everything you need to buy and stake ARENA tokens on Avalanche. Start by registering yourself at the /register endpoint with your wallet address to get an API key. Save that key and use it for all subsequent requests.
```

That's it. The agent handles registration, API key management, and the full buy/stake flow autonomously.

## API Endpoints

**Base URL:** `https://brave-alignment-production-1706.up.railway.app`

### Read-Only
- `GET /balances?wallet=<address>` — AVAX and ARENA balances
- `GET /quote?avax=<amount>` — Price quote with fee breakdown
- `GET /stake/info?wallet=<address>` — Staking position and pending rewards

### Build Transactions
- `GET /build/buy?wallet=<address>&avax=<amount>` — Buy ARENA with AVAX
- `GET /build/stake?wallet=<address>&amount=<amount>` — Stake ARENA (approve + deposit)
- `GET /build/buy-and-stake?wallet=<address>&avax=<amount>` — Buy and stake in one flow
- `GET /build/unstake?wallet=<address>&amount=<amount>` — Unstake ARENA

### Broadcast
- `POST /broadcast` — Submit signed transaction to Avalanche C-Chain

## Key Details

- **Chain:** Avalanche C-Chain (chainId: 43114)
- **Fee:** 0.3% on buy transactions
- **Slippage:** 5% default (configurable)
- **Security:** Transaction-building service only — your private key never touches the server
- **ARENA Token:** `0xB8d7710f7d8349A506b75dD184F05777c82dAd0C`
- **Staking Contract:** `0xeFFB809d99142ce3b51c1796C096f5b01b4aAeC4`

## Example Flow

```
Agent: GET /register?wallet=0xMyWallet&name=my-agent
→ Saves API key

Agent: GET /quote?avax=0.5
→ { arenaOut: "5100.2", fee: "0.0015", netAvax: "0.4985" }

Agent: GET /build/buy-and-stake?wallet=0xMyWallet&avax=0.5
→ Returns 3 unsigned transactions

Agent: Signs each tx → POST /broadcast (3 times, in order)
→ ARENA bought and staked

Agent: GET /stake/info?wallet=0xMyWallet
→ { stakedAmount: "5100.2", pendingRewards: "0.0" }
```
