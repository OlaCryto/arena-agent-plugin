import fs from "fs";
import path from "path";

const POSITIONS_FILE = fs.existsSync("/data")
  ? "/data/positions.json"
  : path.join(process.cwd(), "positions.json");

interface PositionsData {
  [wallet: string]: number[];
}

function load(): PositionsData {
  if (!fs.existsSync(POSITIONS_FILE)) return {};
  return JSON.parse(fs.readFileSync(POSITIONS_FILE, "utf-8"));
}

function save(data: PositionsData) {
  fs.writeFileSync(POSITIONS_FILE, JSON.stringify(data, null, 2));
}

export function trackPosition(wallet: string, tokenId: number) {
  const data = load();
  const key = wallet.toLowerCase();
  if (!data[key]) data[key] = [];
  if (!data[key].includes(tokenId)) {
    data[key].push(tokenId);
    save(data);
  }
}

export function removePosition(wallet: string, tokenId: number) {
  const data = load();
  const key = wallet.toLowerCase();
  if (!data[key]) return;
  data[key] = data[key].filter((id) => id !== tokenId);
  if (data[key].length === 0) delete data[key];
  save(data);
}

export function getPositions(wallet: string): number[] {
  const data = load();
  return data[wallet.toLowerCase()] || [];
}
