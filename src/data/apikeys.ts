import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

// Use Railway persistent volume if available, otherwise fall back to local file
const KEYS_FILE = fs.existsSync("/data") ? "/data/api-keys.json" : path.join(process.cwd(), "api-keys.json");

interface ApiKeyEntry {
  key: string;
  name: string;
  wallet?: string;
  createdAt: string;
}

function loadKeys(): ApiKeyEntry[] {
  if (!fs.existsSync(KEYS_FILE)) return [];
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
}

function saveKeys(keys: ApiKeyEntry[]) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

export function generateApiKey(name: string, wallet?: string): string {
  const keys = loadKeys();

  // If wallet provided, check if already registered — return existing key
  if (wallet) {
    const existing = keys.find((k) => k.wallet?.toLowerCase() === wallet.toLowerCase());
    if (existing) return existing.key;
  }

  const key = "arena_" + randomBytes(24).toString("hex");
  keys.push({ key, name, wallet: wallet?.toLowerCase(), createdAt: new Date().toISOString() });
  saveKeys(keys);
  return key;
}

export function validateApiKey(key: string): boolean {
  const keys = loadKeys();
  return keys.some((k) => k.key === key);
}

export function listApiKeys(): Omit<ApiKeyEntry, "key">[] {
  return loadKeys().map(({ name, createdAt }) => ({ name, createdAt }));
}

export function revokeApiKey(name: string): boolean {
  const keys = loadKeys();
  const filtered = keys.filter((k) => k.name !== name);
  if (filtered.length === keys.length) return false;
  saveKeys(filtered);
  return true;
}

export function getAgentCount(): number {
  return loadKeys().length;
}

export function getAgents(): { name: string; wallet?: string; createdAt: string }[] {
  return loadKeys().map(({ name, wallet, createdAt }) => ({ name, wallet, createdAt }));
}
