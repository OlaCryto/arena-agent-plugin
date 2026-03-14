import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

const KEYS_FILE = path.join(process.cwd(), "api-keys.json");

interface ApiKeyEntry {
  key: string;
  name: string;
  createdAt: string;
}

function loadKeys(): ApiKeyEntry[] {
  if (!fs.existsSync(KEYS_FILE)) return [];
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
}

function saveKeys(keys: ApiKeyEntry[]) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

export function generateApiKey(name: string): string {
  const key = "arena_" + randomBytes(24).toString("hex");
  const keys = loadKeys();
  keys.push({ key, name, createdAt: new Date().toISOString() });
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
