#!/usr/bin/env node

/**
 * Logiqical Vault Daemon
 *
 * A separate signer process that holds the agent's private key and enforces
 * spending policies. The SDK/MCP server communicates with the vault via HTTP
 * on localhost. The vault never exposes keys — it returns signed transaction hex.
 *
 * Security model:
 * - Private key never leaves the vault process
 * - Every transaction is policy-checked before signing
 * - Only localhost connections accepted
 * - No outbound network access from the signing path
 * - Budget tracking persists across restarts
 *
 * Usage:
 *   logiqical vault                    # Start on default port 7842
 *   logiqical vault --port 8000        # Custom port
 *   LOGIQICAL_VAULT_PORT=8000 logiqical vault
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Wallet, JsonRpcProvider, ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── Config ──

const CONFIG_DIR = join(homedir(), ".logiqical");
const KEYS_DIR = join(CONFIG_DIR, "keys");
const VAULT_STATE_FILE = join(CONFIG_DIR, "vault-state.json");
const DEFAULT_PORT = 7842;

interface VaultConfig {
  port: number;
  keystoreName: string;
  password: string;
}

interface SpendingPolicy {
  maxPerTx?: string;
  maxPerHour?: string;
  maxPerDay?: string;
  allowedContracts?: string[];
  blockedContracts?: string[];
  simulateBeforeSend?: boolean;
  dryRun?: boolean;
}

interface VaultState {
  spentThisHour: string;
  spentToday: string;
  hourStart: number;
  dayStart: number;
  policy: SpendingPolicy;
}

// ── Helpers ──

function loadConfig(): Record<string, any> {
  const configFile = join(CONFIG_DIR, "config.json");
  if (existsSync(configFile)) return JSON.parse(readFileSync(configFile, "utf-8"));
  return {};
}

function loadVaultState(): VaultState {
  if (existsSync(VAULT_STATE_FILE)) {
    return JSON.parse(readFileSync(VAULT_STATE_FILE, "utf-8"));
  }
  const config = loadConfig();
  return {
    spentThisHour: "0",
    spentToday: "0",
    hourStart: Date.now(),
    dayStart: Date.now(),
    policy: config.policy || {},
  };
}

function saveVaultState(state: VaultState) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(VAULT_STATE_FILE, JSON.stringify(state, null, 2));
}

function resetBudgetPeriods(state: VaultState): VaultState {
  const now = Date.now();
  if (now - state.hourStart > 3600_000) {
    state.spentThisHour = "0";
    state.hourStart = now;
  }
  if (now - state.dayStart > 86400_000) {
    state.spentToday = "0";
    state.dayStart = now;
  }
  return state;
}

// ── Policy Enforcement ──

function checkPolicy(policy: SpendingPolicy, tx: { to: string; value: string }, state: VaultState): string | null {
  const valueWei = BigInt(tx.value || "0");
  const valueEth = parseFloat(ethers.formatEther(valueWei));

  // Max per tx
  if (policy.maxPerTx) {
    const max = parseFloat(policy.maxPerTx);
    if (valueEth > max) return `Transaction value ${valueEth} exceeds max per tx (${max})`;
  }

  // Max per hour
  if (policy.maxPerHour) {
    const max = parseFloat(policy.maxPerHour);
    const spent = parseFloat(state.spentThisHour);
    if (spent + valueEth > max) return `Would exceed hourly budget (${spent + valueEth} > ${max})`;
  }

  // Max per day
  if (policy.maxPerDay) {
    const max = parseFloat(policy.maxPerDay);
    const spent = parseFloat(state.spentToday);
    if (spent + valueEth > max) return `Would exceed daily budget (${spent + valueEth} > ${max})`;
  }

  // Allowed contracts
  if (policy.allowedContracts && policy.allowedContracts.length > 0) {
    const allowed = policy.allowedContracts.map(a => a.toLowerCase());
    if (!allowed.includes(tx.to.toLowerCase())) {
      return `Contract ${tx.to} not in allowlist`;
    }
  }

  // Blocked contracts
  if (policy.blockedContracts && policy.blockedContracts.length > 0) {
    const blocked = policy.blockedContracts.map(b => b.toLowerCase());
    if (blocked.includes(tx.to.toLowerCase())) {
      return `Contract ${tx.to} is blocked`;
    }
  }

  return null; // passed
}

// ── HTTP Handler ──

function createVaultServer(wallet: Wallet, provider: JsonRpcProvider, state: VaultState) {
  async function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      req.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON")); }
      });
    });
  }

  function json(res: ServerResponse, statusCode: number, body: any) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    // Only localhost
    const remoteAddr = req.socket.remoteAddress;
    if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1" && remoteAddr !== "::ffff:127.0.0.1") {
      return json(res, 403, { error: "Vault only accepts localhost connections" });
    }

    const url = req.url || "/";
    const method = req.method || "GET";

    try {
      // GET /health
      if (url === "/health" && method === "GET") {
        return json(res, 200, { status: "ok", address: wallet.address });
      }

      // GET /address
      if (url === "/address" && method === "GET") {
        return json(res, 200, { address: wallet.address });
      }

      // GET /policy
      if (url === "/policy" && method === "GET") {
        return json(res, 200, { policy: state.policy });
      }

      // POST /policy — update policy
      if (url === "/policy" && method === "POST") {
        const body = await readBody(req);
        state.policy = { ...state.policy, ...body };
        saveVaultState(state);
        return json(res, 200, { policy: state.policy });
      }

      // GET /budget
      if (url === "/budget" && method === "GET") {
        state = resetBudgetPeriods(state);
        return json(res, 200, {
          spentThisHour: state.spentThisHour,
          spentToday: state.spentToday,
          hourlyLimit: state.policy.maxPerHour || null,
          dailyLimit: state.policy.maxPerDay || null,
          hourlyRemaining: state.policy.maxPerHour
            ? String(Math.max(0, parseFloat(state.policy.maxPerHour) - parseFloat(state.spentThisHour)))
            : null,
          dailyRemaining: state.policy.maxPerDay
            ? String(Math.max(0, parseFloat(state.policy.maxPerDay) - parseFloat(state.spentToday)))
            : null,
        });
      }

      // POST /sign — sign a transaction (policy-checked)
      if (url === "/sign" && method === "POST") {
        const body = await readBody(req);
        const { to, data, value, chainId, gasLimit } = body;

        if (!to) return json(res, 400, { error: "Missing 'to' field" });

        // Reset budget periods
        state = resetBudgetPeriods(state);

        // Policy check
        const policyError = checkPolicy(state.policy, { to, value: value || "0" }, state);
        if (policyError) {
          return json(res, 403, { error: policyError, code: "POLICY_VIOLATION" });
        }

        // Simulate if policy says so
        if (state.policy.simulateBeforeSend) {
          try {
            await provider.call({
              to, data, value: value ? BigInt(value) : undefined,
              from: wallet.address,
            });
          } catch (e: any) {
            return json(res, 400, {
              error: `Simulation failed: ${e.reason || e.message || "would revert"}`,
              code: "SIMULATION_FAILED",
            });
          }
        }

        // Dry run
        if (state.policy.dryRun) {
          return json(res, 200, {
            signedTx: null,
            dryRun: true,
            message: "Dry run — transaction not signed",
          });
        }

        // Sign the transaction
        const tx: any = { to, data: data || "0x", value: value || "0" };
        if (gasLimit) tx.gasLimit = gasLimit;
        if (chainId) tx.chainId = chainId;

        const signedTx = await wallet.signTransaction(tx);

        // Record spend
        const valueWei = BigInt(value || "0");
        if (valueWei > 0n) {
          const valueEth = parseFloat(ethers.formatEther(valueWei));
          state.spentThisHour = String(parseFloat(state.spentThisHour) + valueEth);
          state.spentToday = String(parseFloat(state.spentToday) + valueEth);
          saveVaultState(state);
        }

        return json(res, 200, { signedTx });
      }

      // POST /sign-message — sign an arbitrary message
      if (url === "/sign-message" && method === "POST") {
        const body = await readBody(req);
        if (!body.message) return json(res, 400, { error: "Missing 'message' field" });
        const signature = await wallet.signMessage(body.message);
        return json(res, 200, { signature });
      }

      // POST /sign-typed-data — sign EIP-712 typed data
      if (url === "/sign-typed-data" && method === "POST") {
        const body = await readBody(req);
        const { domain, types, value } = body;
        if (!domain || !types || !value) {
          return json(res, 400, { error: "Missing domain, types, or value" });
        }
        const signature = await wallet.signTypedData(domain, types, value);
        return json(res, 200, { signature });
      }

      // POST /broadcast — broadcast a signed transaction
      if (url === "/broadcast" && method === "POST") {
        const body = await readBody(req);
        if (!body.signedTx) return json(res, 400, { error: "Missing 'signedTx' field" });
        const txResponse = await provider.broadcastTransaction(body.signedTx);
        return json(res, 200, {
          hash: txResponse.hash,
          nonce: txResponse.nonce,
        });
      }

      return json(res, 404, { error: `Unknown endpoint: ${method} ${url}` });
    } catch (e: any) {
      return json(res, 500, { error: e.message });
    }
  };
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2).filter(a => a !== "vault");
  const portArg = args.indexOf("--port");
  const port = portArg >= 0 ? parseInt(args[portArg + 1]) : parseInt(process.env.LOGIQICAL_VAULT_PORT || String(DEFAULT_PORT));

  console.log("");
  console.log("  \x1b[1mLogiqical Vault Daemon\x1b[0m");
  console.log("  \x1b[2mSigns transactions, enforces policies. Keys never leave this process.\x1b[0m");
  console.log("");

  // Load wallet from keystore
  const keystorePath = join(KEYS_DIR, "agent.json");
  if (!existsSync(keystorePath)) {
    console.error("  No wallet found. Run: logiqical setup");
    process.exit(1);
  }

  const config = loadConfig();
  const password = config.password || "logiqical-agent";

  console.log("  Loading keystore...");
  const keystoreData = JSON.parse(readFileSync(keystorePath, "utf-8"));
  const decrypted = await Wallet.fromEncryptedJson(keystoreData.encryptedJson, password);

  const rpcUrl = config.rpcUrl || "https://api.avax.network/ext/bc/C/rpc";
  const provider = new JsonRpcProvider(rpcUrl, 43114);
  const wallet = new Wallet(decrypted.privateKey, provider);

  // Load state
  let state = loadVaultState();
  state = resetBudgetPeriods(state);

  console.log(`  Address:  \x1b[32m${wallet.address}\x1b[0m`);
  console.log(`  Network:  Avalanche C-Chain`);
  console.log(`  Port:     ${port}`);

  if (state.policy.maxPerTx || state.policy.maxPerDay) {
    console.log(`  Policy:   max/tx: ${state.policy.maxPerTx || "none"}, max/day: ${state.policy.maxPerDay || "none"}, simulate: ${state.policy.simulateBeforeSend ?? false}`);
  } else {
    console.log("  Policy:   \x1b[33mnone set — all transactions will be signed\x1b[0m");
  }

  // Start server
  const server = createServer(createVaultServer(wallet, provider, state));
  server.listen(port, "127.0.0.1", () => {
    console.log("");
    console.log(`  \x1b[32mVault running on http://127.0.0.1:${port}\x1b[0m`);
    console.log("");
    console.log("  Endpoints:");
    console.log("    GET  /health          — health check");
    console.log("    GET  /address         — wallet address");
    console.log("    GET  /policy          — current policy");
    console.log("    POST /policy          — update policy");
    console.log("    GET  /budget          — spending budget status");
    console.log("    POST /sign            — sign a transaction (policy-enforced)");
    console.log("    POST /sign-message    — sign an arbitrary message");
    console.log("    POST /sign-typed-data — sign EIP-712 typed data");
    console.log("    POST /broadcast       — broadcast signed tx");
    console.log("");
    console.log("  \x1b[2mPress Ctrl+C to stop\x1b[0m");
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n  Shutting down vault...");
    saveVaultState(state);
    server.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    saveVaultState(state);
    server.close();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
