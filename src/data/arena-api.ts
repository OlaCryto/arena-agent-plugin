import crypto from "crypto";

const ARENA_DATA_API = "https://data.arenatrade.ai";
const BEARER_TOKEN = "6e692818204abf679b3e4422a1cc6aa94d44e924ecb71f4f284ed1a7e189d1e7";
const HMAC_SECRET = "e23eaa8d80d4061e6a899c5722db725b3c5836182254438cb6dde68f9a0da1b6";

function authHeaders(): Record<string, string> {
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac("sha256", HMAC_SECRET).update(timestamp).digest("hex");
  return {
    "authorization": `Bearer ${BEARER_TOKEN}`,
    "x-timestamp": timestamp,
    "x-signature": signature,
    "origin": "https://arenatrade.ai",
    "referer": "https://arenatrade.ai/",
  };
}

async function apiFetch<T = any>(path: string): Promise<T> {
  const url = `${ARENA_DATA_API}${path}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Arena API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ───

export interface ArenaToken {
  row_id: number;
  chain_id: number;
  group_id: string;
  token_name: string;
  token_symbol: string;
  token_contract_address: string;
  contract_address: string;
  creator_address: string;
  creator_user_handle: string;
  creator_photo_url: string;
  creator_twitter_followers: number | null;
  photo_url: string;
  description: string;
  total_supply_eth: number;
  a: number;
  b: number;
  curve_scaler: number;
  lp_deployed: boolean;
  lp_percentage: number;
  sale_percentage: number;
  group_fee: number;
  pair_address: string;
  create_time: string;
  transaction_hash: string;
  migration_time: string | null;
  is_official: boolean;
  lp_paired_with: string;
  latest_price_eth: number;
  latest_price_usd: number;
  latest_total_volume_eth: number;
  latest_total_volume_usd: number;
  latest_transaction_count: number;
  latest_holder_count: number;
  latest_supply_eth: number;
  latest_avax_price: number;
  latest_arena_price: number;
  latest_native_token_price: number;
  graduation_percentage?: number;
  whitelist_info: any;
  creator_total_tokens?: number;
  v4_pool_id: string | null;
}

export interface ArenaTokenStats {
  buyCount5m: number;
  buyCount1: number;
  buyCount4: number;
  buyCount12: number;
  buyCount24: number;
  sellCount5m: number;
  sellCount1: number;
  sellCount4: number;
  sellCount12: number;
  sellCount24: number;
  uniqueBuys5m: number;
  uniqueBuys1: number;
  uniqueBuys4: number;
  uniqueBuys12: number;
  uniqueBuys24: number;
  uniqueSells5m: number;
  uniqueSells1: number;
  uniqueSells4: number;
  uniqueSells12: number;
  uniqueSells24: number;
  buyVolume5m: number;
  buyVolume1: number;
  buyVolume4: number;
  buyVolume12: number;
  buyVolume24: number;
  sellVolume5m: number;
  sellVolume1: number;
  sellVolume4: number;
  sellVolume12: number;
  sellVolume24: number;
  volume5m: number;
  volume1: number;
  volume4: number;
  volume12: number;
  volume24: number;
  priceChange5m: number;
  priceChange1: number;
  priceChange4: number;
  priceChange12: number;
  priceChange24: number;
  liquidity: number;
  token: { address: string; symbol: string; name: string };
}

export interface ArenaTrade {
  user_address: string;
  token_eth: number;
  user_eth: number;
  user_usd: number;
  price_eth: number;
  price_after_eth: number;
  block_number: string;
  create_time: string;
  transaction_hash: string;
  token_contract_address: string;
  token_id: string;
  token_name: string;
  token_symbol: string;
  photo_url: string;
  user_handle: string;
  user_photo_url: string;
  username: string;
  user_twitter_followers: number;
  current_balance: number;
  avax_price: number;
}

export interface ArenaHolder {
  rank: string;
  user_address: string;
  token_name: string;
  token_symbol: string;
  current_balance: number;
  current_price_eth: number;
  unrealized_pnl_eth: number;
  unrealized_pnl_usd: number;
  realized_pnl_eth: number;
  realized_pnl_usd: number;
  buy_count: string;
  sell_count: string;
  user_handle: string;
  user_photo_url: string;
  username: string;
  twitter_followers: number;
}

// ─── API Methods ───

/** Get a single token by contract address (fastest exact lookup) */
export async function getTokenByAddress(tokenAddress: string): Promise<ArenaToken | null> {
  const results = await apiFetch<ArenaToken[]>(`/groups/plus/token/${tokenAddress.toLowerCase()}`);
  return results.length > 0 ? results[0] : null;
}

/** Get recent token launches (rich data, max 50) */
export async function getRecentTokens(limit = 10, offset = 0): Promise<ArenaToken[]> {
  return apiFetch(`/groups/plus?limit=${Math.min(limit, 50)}&offset=${offset}`);
}

/** Get tokens about to graduate (max 50) */
export async function getGraduatingTokens(limit = 10): Promise<ArenaToken[]> {
  return apiFetch(`/groups/graduating?limit=${Math.min(limit, 50)}`);
}

/** Get graduated tokens (on DEX, max 50) */
export async function getGraduatedTokens(limit = 10): Promise<ArenaToken[]> {
  return apiFetch(`/groups/graduated?limit=${Math.min(limit, 50)}`);
}

/** Get top volume tokens by timeframe (max 50) */
export async function getTopVolume(timeframe: "5m" | "1h" | "4h" | "24h" | "all_time" = "24h", limit = 10): Promise<ArenaToken[]> {
  return apiFetch(`/groups/top-volume/${timeframe}?limit=${Math.min(limit, 50)}`);
}

/** Get token stats (buy/sell counts, volume, price changes across timeframes) */
export async function getTokenStats(tokenAddress: string): Promise<ArenaTokenStats> {
  return apiFetch(`/groups/token-stats?tokenAddress=${tokenAddress.toLowerCase()}`);
}

/** Get recent trades for a token (max 50) */
export async function getTokenTrades(tokenAddress: string, limit = 20, offset = 0): Promise<{ results: ArenaTrade[] }> {
  return apiFetch(`/groups/trades-plus?token_contract_address=${tokenAddress.toLowerCase()}&limit=${Math.min(limit, 50)}&offset=${offset}`);
}

/** Get token holders with PnL (max 50) */
export async function getTokenHolders(tokenAddress: string, limit = 20): Promise<ArenaHolder[]> {
  return apiFetch(`/groups/group/${tokenAddress.toLowerCase()}/holders?limit=${Math.min(limit, 50)}`);
}

/** Get user PnL across tokens */
export async function getUserPnl(userAddress: string): Promise<any> {
  return apiFetch(`/groups/user/${userAddress.toLowerCase()}/pnl`);
}

/** Get user trade info */
export async function getUserTradeInfo(userAddress: string): Promise<any> {
  return apiFetch(`/user-trades/user/${userAddress.toLowerCase()}/info`);
}

/** Search tokens by name/symbol (max limit: 10) */
export async function searchTokens(query: string, limit = 10): Promise<ArenaToken[]> {
  return apiFetch(`/groups/search?search=${encodeURIComponent(query)}&limit=${Math.min(limit, 10)}`);
}

/** Get global trades feed (all tokens, max 50) */
export async function getGlobalTrades(limit = 50, offset = 0): Promise<{ results: ArenaTrade[] }> {
  return apiFetch(`/groups/trades-plus?limit=${Math.min(limit, 50)}&offset=${offset}`);
}
