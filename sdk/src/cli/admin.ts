#!/usr/bin/env node

import { Logiqical } from "../client.js";
import { AgentWallet, CHAINS } from "../wallet.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";

const CONFIG_DIR = join(homedir(), ".logiqical");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const KEYS_DIR = join(CONFIG_DIR, "keys");

// ── Helpers ──

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadConfig(): Record<string, any> {
  if (existsSync(CONFIG_FILE)) return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  return {};
}

function saveConfig(config: Record<string, any>) {
  ensureDir(CONFIG_DIR);
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function log(msg: string) { console.log(msg); }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m`; }

// ── Commands ──

async function setup() {
  log("");
  log(bold("  Logiqical Agent Setup"));
  log(dim("  Non-custodial agent wallet for Avalanche + Arena"));
  log("");

  // Step 1: Wallet
  const keystorePath = join(KEYS_DIR, "agent.json");
  let agent: Logiqical;

  if (existsSync(keystorePath)) {
    log(green("  [1/4] Wallet found"));
    agent = await Logiqical.boot();
    log(`        Address: ${agent.address}`);
  } else {
    log(bold("  [1/4] Creating wallet..."));
    agent = await Logiqical.boot();
    log(green(`        Created: ${agent.address}`));
    log(`        Keystore: ~/.logiqical/keys/agent.json`);
  }

  // Step 2: Check balance
  log("");
  log(bold("  [2/4] Checking balance..."));
  const balance = await agent.getBalance();
  log(`        AVAX: ${balance}`);
  if (parseFloat(balance) === 0) {
    log(yellow("        Wallet is empty. Send AVAX to your agent address to start trading."));
    log(`        ${agent.address}`);
  }

  // Step 3: Arena API key
  log("");
  const config = loadConfig();
  if (config.arenaApiKey) {
    log(green("  [3/4] Arena API key configured"));
  } else {
    log(bold("  [3/4] Arena API key"));
    log(dim("        Required for social, perps, and tickets."));
    log(dim("        Get one at https://arena.social or use agent_register tool."));
    const key = await ask("        Arena API key (or press Enter to skip): ");
    if (key) {
      config.arenaApiKey = key;
      saveConfig(config);
      log(green("        Saved!"));
    } else {
      log(dim("        Skipped. You can set it later with: logiqical config arena-key <key>"));
    }
  }

  // Step 4: Spending policy
  log("");
  if (config.policy) {
    log(green("  [4/4] Spending policy configured"));
    log(`        Max per tx: ${config.policy.maxPerTx || "none"}`);
    log(`        Max per day: ${config.policy.maxPerDay || "none"}`);
  } else {
    log(bold("  [4/4] Spending policy"));
    log(dim("        Protect your agent with guardrails."));
    const maxPerTx = await ask("        Max AVAX per transaction (or Enter for 1.0): ");
    const maxPerDay = await ask("        Max AVAX per day (or Enter for 10.0): ");
    const simulate = await ask("        Simulate before sending? (Y/n): ");

    config.policy = {
      maxPerTx: maxPerTx || "1.0",
      maxPerDay: maxPerDay || "10.0",
      simulateBeforeSend: simulate.toLowerCase() !== "n",
    };
    saveConfig(config);
    log(green("        Policy saved!"));
  }

  // Done
  log("");
  log(green("  Setup complete!"));
  log("");
  log("  Next steps:");
  log(`    ${dim("1.")} Fund your wallet: send AVAX to ${agent.address}`);
  log(`    ${dim("2.")} Start MCP server: ${bold("npx logiqical-mcp")}`);
  log(`    ${dim("3.")} Or use the SDK: ${bold("import { Logiqical } from 'logiqical'")}`);
  log("");
}

async function wallet() {
  const agent = await Logiqical.boot();
  const balance = await agent.getBalance();
  log("");
  log(bold("  Agent Wallet"));
  log(`  Address:  ${agent.address}`);
  log(`  Balance:  ${balance} AVAX`);
  log(`  Network:  Avalanche C-Chain (43114)`);
  log(`  Keystore: ~/.logiqical/keys/agent.json`);
  log(`  Can sign: ${agent.canSign ? green("yes") : "no"}`);
  log("");
}

async function status() {
  const config = loadConfig();
  const keystorePath = join(KEYS_DIR, "agent.json");
  const hasWallet = existsSync(keystorePath);

  log("");
  log(bold("  Logiqical Status"));
  log("");

  if (hasWallet) {
    const agent = await Logiqical.boot();
    const balance = await agent.getBalance();
    log(`  Wallet:      ${green(agent.address)}`);
    log(`  Balance:     ${balance} AVAX`);
  } else {
    log(`  Wallet:      ${yellow("not created")} — run ${bold("logiqical setup")}`);
  }

  log(`  Arena key:   ${config.arenaApiKey ? green("configured") : yellow("not set")}`);

  if (config.policy) {
    log(`  Policy:      max/tx: ${config.policy.maxPerTx}, max/day: ${config.policy.maxPerDay}, simulate: ${config.policy.simulateBeforeSend}`);
  } else {
    log(`  Policy:      ${yellow("not set")} — run ${bold("logiqical setup")}`);
  }

  log(`  Config:      ${CONFIG_FILE}`);
  log(`  Keystore:    ${KEYS_DIR}/`);
  log("");
}

async function policy(args: string[]) {
  const config = loadConfig();

  if (args.length === 0) {
    // Show current policy
    if (!config.policy) {
      log("  No policy set. Run: logiqical setup");
      return;
    }
    log("");
    log(bold("  Spending Policy"));
    log(`  Max per tx:    ${config.policy.maxPerTx || "none"}`);
    log(`  Max per hour:  ${config.policy.maxPerHour || "none"}`);
    log(`  Max per day:   ${config.policy.maxPerDay || "none"}`);
    log(`  Simulate:      ${config.policy.simulateBeforeSend ?? true}`);
    log(`  Dry run:       ${config.policy.dryRun ?? false}`);
    log("");
    return;
  }

  // Set policy: logiqical policy max-per-tx 2.0
  const [key, value] = args;
  if (!config.policy) config.policy = {};

  const keyMap: Record<string, string> = {
    "max-per-tx": "maxPerTx",
    "max-per-hour": "maxPerHour",
    "max-per-day": "maxPerDay",
    "simulate": "simulateBeforeSend",
    "dry-run": "dryRun",
  };

  const configKey = keyMap[key];
  if (!configKey) {
    log(`  Unknown policy key: ${key}`);
    log(`  Valid keys: ${Object.keys(keyMap).join(", ")}`);
    return;
  }

  if (configKey === "simulateBeforeSend" || configKey === "dryRun") {
    config.policy[configKey] = value === "true" || value === "yes" || value === "1";
  } else {
    config.policy[configKey] = value;
  }

  saveConfig(config);
  log(green(`  Policy updated: ${key} = ${value}`));
}

async function configCmd(args: string[]) {
  const config = loadConfig();

  if (args.length === 0) {
    log(JSON.stringify(config, null, 2));
    return;
  }

  const [key, ...rest] = args;
  const value = rest.join(" ");

  if (key === "arena-key") {
    config.arenaApiKey = value;
    saveConfig(config);
    log(green(`  Arena API key saved.`));
  } else if (key === "network") {
    if (!CHAINS[value]) {
      log(`  Unknown network: ${value}`);
      log(`  Available: ${Object.keys(CHAINS).join(", ")}`);
      return;
    }
    config.network = value;
    saveConfig(config);
    log(green(`  Network set to: ${value}`));
  } else {
    log(`  Unknown config key: ${key}`);
    log(`  Valid keys: arena-key, network`);
  }
}

function help() {
  log("");
  log(bold("  logiqical") + " — agent wallet CLI for Avalanche + Arena");
  log("");
  log("  Commands:");
  log(`    ${bold("setup")}              Interactive wallet + policy setup`);
  log(`    ${bold("wallet")}             Show wallet address and balance`);
  log(`    ${bold("status")}             Show full agent status`);
  log(`    ${bold("policy")}             Show spending policy`);
  log(`    ${bold("policy")} <key> <val> Set a policy value`);
  log(`    ${bold("config")}             Show config`);
  log(`    ${bold("config")} arena-key   Set Arena API key`);
  log(`    ${bold("config")} network     Set default network`);
  log(`    ${bold("mcp")}                Start MCP server (stdio)`);
  log(`    ${bold("vault")}              Start vault daemon (signer)`);
  log(`    ${bold("help")}               Show this help`);
  log("");
  log("  Examples:");
  log(`    logiqical setup`);
  log(`    logiqical policy max-per-tx 2.0`);
  log(`    logiqical config arena-key arena_abc123`);
  log(`    logiqical mcp`);
  log("");
}

// ── Main ──

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "setup": return setup();
    case "wallet": return wallet();
    case "status": return status();
    case "policy": return policy(args);
    case "config": return configCmd(args);
    case "help": case "--help": case "-h": case undefined: return help();
    default:
      log(`  Unknown command: ${cmd}`);
      help();
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
