import fs from "fs";
import path from "path";

const LOG_FILE = fs.existsSync("/data") ? "/data/trade-log.json" : path.join(process.cwd(), "trade-log.json");

export interface TradeEntry {
  timestamp: string;
  agent: string;
  wallet: string;
  action: string;
  details: string;
  module: "swap" | "staking" | "launchpad" | "dex";
}

function loadLog(): TradeEntry[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveLog(entries: TradeEntry[]) {
  // Keep last 500 entries
  const trimmed = entries.slice(-500);
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2));
}

export function logTrade(agent: string, wallet: string, action: string, details: string, module: TradeEntry["module"]) {
  const entries = loadLog();
  entries.push({
    timestamp: new Date().toISOString(),
    agent,
    wallet,
    action,
    details,
    module,
  });
  saveLog(entries);
}

export function getRecentTrades(count = 50): TradeEntry[] {
  const entries = loadLog();
  return entries.slice(-count).reverse();
}

export function getTradeStats(): { total: number; last24h: number; byModule: Record<string, number> } {
  const entries = loadLog();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = entries.filter(e => new Date(e.timestamp).getTime() > cutoff).length;
  const byModule: Record<string, number> = {};
  for (const e of entries) {
    byModule[e.module] = (byModule[e.module] || 0) + 1;
  }
  return { total: entries.length, last24h, byModule };
}
