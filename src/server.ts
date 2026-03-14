import express, { Request, Response, NextFunction } from "express";
import { TxBuilder } from "./txbuilder";
import { generateApiKey, validateApiKey, listApiKeys, revokeApiKey } from "./apikeys";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-me";

const builder = new TxBuilder();

// --- API Key Middleware ---
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string;
  if (!key || !validateApiKey(key)) {
    res.status(401).json({ error: "Invalid or missing API key. Pass X-API-Key header." });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] as string;
  if (secret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Invalid admin secret." });
    return;
  }
  next();
}

// === ADMIN ENDPOINTS (manage API keys) ===

app.all("/admin/keys/create", requireAdmin, (req, res) => {
  const name = req.body?.name || req.query.name as string;
  if (!name) return res.status(400).json({ error: "name is required (?name=)" });
  const key = generateApiKey(name);
  res.json({ key, name, message: "Store this key — it won't be shown again." });
});

app.get("/admin/keys", requireAdmin, (_req, res) => {
  res.json(listApiKeys());
});

app.all("/admin/keys/revoke", requireAdmin, (req, res) => {
  const name = req.body?.name || req.query.name as string;
  if (!name) return res.status(400).json({ error: "name is required (?name=)" });
  const revoked = revokeApiKey(name);
  res.json({ revoked, name });
});

// === PUBLIC ENDPOINTS ===

// Self-registration: agent provides its wallet address, gets an API key
app.get("/register", (req, res) => {
  const wallet = req.query.wallet as string;
  const name = req.query.name as string || wallet;
  if (!wallet) return res.status(400).json({ error: "?wallet=<your-wallet-address> required" });
  const key = generateApiKey(name);
  res.json({ key, name, wallet, message: "Save this API key — it won't be shown again. Include it as X-API-Key header in all future requests." });
});

app.get("/agent-instructions", (req, res) => {
  res.type("text/plain").send(`# Arena Plugin — Agent Instructions

You have access to the Arena Plugin API for buying and staking ARENA tokens on the Avalanche blockchain. ARENA is the native token of The Arena (arena.social), a SocialFi platform. Staking ARENA makes you an "Arena Champion" — you earn 2.5% of every token that graduates from Arena's bonding curve launchpad.

## Step 1: Register (do this first, only once)
GET ${req.protocol}://${req.get("host")}/register?wallet=<your-wallet-address>&name=<your-agent-name>
  Returns: { key, name, wallet }
  Save the "key" value — this is your API key. You need it for all other requests.

## Step 2: Authenticate
Include this header with EVERY request after registration:
  X-API-Key: <the key you received from /register>

## Base URL
${req.protocol}://${req.get("host")}

## Endpoints

### Read-Only (no transaction needed)

GET /balances?wallet=<address>
  Returns: { avax, arena, wallet }
  Use to check AVAX and ARENA token balances for any wallet.

GET /quote?avax=<amount>
  Returns: { avaxIn, arenaOut, fee, netAvax }
  Use to get a price quote before buying. Shows the 0.3% service fee breakdown.

GET /stake/info?wallet=<address>
  Returns: { stakedAmount, pendingRewards }
  Use to check how much ARENA is staked and any pending rewards.

### Build Transactions (returns unsigned tx data for you to sign)

GET /build/buy?wallet=<address>&avax=<amount>&slippage=<bps>
  Returns: { to, data, value, chainId, gas, gasLimit, description }
  Builds an unsigned transaction to buy ARENA with AVAX.
  - amount: AVAX to spend (e.g. "0.1")
  - slippage: optional, basis points (default 500 = 5%)
  - IMPORTANT: The response includes gas/gasLimit. You MUST use the provided gasLimit (500000) when signing. Default gas estimates are too low for DEX swaps and WILL cause reverts.

GET /build/stake?wallet=<address>&amount=<amount>
  Returns: { transactions: [approveTx, stakeTx] }
  Builds 2 unsigned transactions: approve ARENA token + deposit into staking.
  - amount: ARENA to stake, or "max" for entire balance

GET /build/buy-and-stake?wallet=<address>&avax=<amount>&slippage=<bps>
  Returns: { transactions: [buyTx, approveTx, stakeTx] }
  Builds 3 unsigned transactions to buy ARENA and stake in one flow.

GET /build/unstake?wallet=<address>&amount=<amount>
  Returns: { to, data, value, chainId, description }
  Builds an unsigned transaction to withdraw staked ARENA + claim rewards.
  - amount: ARENA to unstake, or "max" for all

### Broadcast

POST /broadcast
  Body: { "signedTx": "<signed transaction hex>" }
  Returns: { txHash }
  Broadcasts a signed transaction to Avalanche C-Chain.

## Workflow

1. Call a /build/* endpoint to get unsigned transaction(s)
2. Sign each transaction locally with your wallet private key
3. POST each signed transaction to /broadcast in order
4. Verify results using /balances or /stake/info

## Important Notes
- All transactions are on Avalanche C-Chain (chainId: 43114)
- A 0.3% fee is applied on buy transactions
- For /build/buy-and-stake, you get 3 transactions — execute them IN ORDER
- Always check /quote before buying to see expected output
- Use "max" as amount to stake/unstake entire balance
- The ARENA token address is 0xB8d7710f7d8349A506b75dD184F05777c82dAd0C
- CRITICAL: When signing buy transactions, you MUST set gasLimit to the value provided in the response (500000). Do NOT use your own gas estimate — DEX swaps need more gas than estimators predict, and too-low gas will cause the transaction to revert.
`);
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    router: builder.routerAddress || "not deployed yet",
    fee: "0.3%",
  });
});

// === AUTHENTICATED ENDPOINTS (require API key) ===

// Get balances for a wallet
app.get("/balances", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: "?wallet= required" });
    const result = await builder.getBalances(wallet);
    res.json({ ...result, wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get staking info
app.get("/stake/info", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: "?wallet= required" });
    const result = await builder.getStakeInfo(wallet);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get quote (includes fee breakdown)
app.get("/quote", requireApiKey, async (req, res) => {
  try {
    const avax = req.query.avax as string;
    if (!avax) return res.status(400).json({ error: "?avax= required" });
    const result = await builder.getQuote(avax);
    res.json({ avaxIn: avax, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned tx: buy ARENA
app.get("/build/buy", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const avax = req.query.avax as string;
    const slippage = req.query.slippage as string;
    if (!wallet || !avax) return res.status(400).json({ error: "?wallet= and ?avax= required" });
    const tx = await builder.buildBuyTx(wallet, avax, slippage ? Number(slippage) : undefined);
    res.json(tx);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned txs: stake ARENA (approve + deposit)
app.get("/build/stake", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const amount = req.query.amount as string;
    if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required" });
    const approveTx = await builder.buildApproveStakingTx(wallet, amount);
    const stakeTx = await builder.buildStakeTx(wallet, amount);
    res.json({ transactions: [approveTx, stakeTx] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned txs: buy + stake (3 txs)
app.get("/build/buy-and-stake", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const avax = req.query.avax as string;
    const slippage = req.query.slippage as string;
    if (!wallet || !avax) return res.status(400).json({ error: "?wallet= and ?avax= required" });
    const txs = await builder.buildBuyAndStakeTxs(wallet, avax, slippage ? Number(slippage) : undefined);
    res.json({ transactions: txs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build unsigned tx: unstake
app.get("/build/unstake", requireApiKey, async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const amount = req.query.amount as string;
    if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required" });
    const tx = await builder.buildUnstakeTx(wallet, amount);
    res.json(tx);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast a signed transaction
app.post("/broadcast", requireApiKey, async (req, res) => {
  try {
    const { signedTx } = req.body;
    if (!signedTx) return res.status(400).json({ error: "signedTx is required in body" });
    const txHash = await builder.broadcast(signedTx);
    res.json({ txHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Arena Agent Plugin running on port ${PORT}`);
  console.log(`Fee: 0.3% on buys via ArenaRouter`);
  console.log(`Router: ${builder.routerAddress || "NOT SET — deploy contract and set ARENA_ROUTER env var"}`);
  console.log(`\nAdmin endpoints (X-Admin-Secret header):`);
  console.log(`  POST   /admin/keys    - Generate API key`);
  console.log(`  GET    /admin/keys    - List API keys`);
  console.log(`  DELETE /admin/keys    - Revoke API key`);
  console.log(`\nAgent endpoints (X-API-Key header):`);
  console.log(`  GET  /balances?wallet=0x...          - Wallet balances`);
  console.log(`  GET  /quote?avax=0.1                 - Price quote`);
  console.log(`  GET  /stake/info?wallet=0x...        - Staking position`);
  console.log(`  GET  /build/buy?wallet=...&avax=0.1  - Build buy tx`);
  console.log(`  GET  /build/stake?wallet=...&amount= - Build stake txs`);
  console.log(`  GET  /build/buy-and-stake?wallet=... - Build buy+stake txs`);
  console.log(`  GET  /build/unstake?wallet=...       - Build unstake tx`);
  console.log(`  POST /broadcast                      - Broadcast signed tx`);
});
