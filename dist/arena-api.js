"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenByAddress = getTokenByAddress;
exports.getRecentTokens = getRecentTokens;
exports.getGraduatingTokens = getGraduatingTokens;
exports.getGraduatedTokens = getGraduatedTokens;
exports.getTopVolume = getTopVolume;
exports.getTokenStats = getTokenStats;
exports.getTokenTrades = getTokenTrades;
exports.getTokenHolders = getTokenHolders;
exports.getUserPnl = getUserPnl;
exports.getUserTradeInfo = getUserTradeInfo;
exports.searchTokens = searchTokens;
exports.getGlobalTrades = getGlobalTrades;
const crypto_1 = __importDefault(require("crypto"));
const ARENA_DATA_API = "https://data.arenatrade.ai";
const BEARER_TOKEN = "6e692818204abf679b3e4422a1cc6aa94d44e924ecb71f4f284ed1a7e189d1e7";
const HMAC_SECRET = "e23eaa8d80d4061e6a899c5722db725b3c5836182254438cb6dde68f9a0da1b6";
function authHeaders() {
    const timestamp = Date.now().toString();
    const signature = crypto_1.default.createHmac("sha256", HMAC_SECRET).update(timestamp).digest("hex");
    return {
        "authorization": `Bearer ${BEARER_TOKEN}`,
        "x-timestamp": timestamp,
        "x-signature": signature,
        "origin": "https://arenatrade.ai",
        "referer": "https://arenatrade.ai/",
    };
}
async function apiFetch(path) {
    const url = `${ARENA_DATA_API}${path}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Arena API ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
}
// ─── API Methods ───
/** Get a single token by contract address (fastest exact lookup) */
async function getTokenByAddress(tokenAddress) {
    const results = await apiFetch(`/groups/plus/token/${tokenAddress.toLowerCase()}`);
    return results.length > 0 ? results[0] : null;
}
/** Get recent token launches (rich data, max 50) */
async function getRecentTokens(limit = 10, offset = 0) {
    return apiFetch(`/groups/plus?limit=${Math.min(limit, 50)}&offset=${offset}`);
}
/** Get tokens about to graduate (max 50) */
async function getGraduatingTokens(limit = 10) {
    return apiFetch(`/groups/graduating?limit=${Math.min(limit, 50)}`);
}
/** Get graduated tokens (on DEX, max 50) */
async function getGraduatedTokens(limit = 10) {
    return apiFetch(`/groups/graduated?limit=${Math.min(limit, 50)}`);
}
/** Get top volume tokens by timeframe (max 50) */
async function getTopVolume(timeframe = "24h", limit = 10) {
    return apiFetch(`/groups/top-volume/${timeframe}?limit=${Math.min(limit, 50)}`);
}
/** Get token stats (buy/sell counts, volume, price changes across timeframes) */
async function getTokenStats(tokenAddress) {
    return apiFetch(`/groups/token-stats?tokenAddress=${tokenAddress.toLowerCase()}`);
}
/** Get recent trades for a token (max 50) */
async function getTokenTrades(tokenAddress, limit = 20, offset = 0) {
    return apiFetch(`/groups/trades-plus?token_contract_address=${tokenAddress.toLowerCase()}&limit=${Math.min(limit, 50)}&offset=${offset}`);
}
/** Get token holders with PnL (max 50) */
async function getTokenHolders(tokenAddress, limit = 20) {
    return apiFetch(`/groups/group/${tokenAddress.toLowerCase()}/holders?limit=${Math.min(limit, 50)}`);
}
/** Get user PnL across tokens */
async function getUserPnl(userAddress) {
    return apiFetch(`/groups/user/${userAddress.toLowerCase()}/pnl`);
}
/** Get user trade info */
async function getUserTradeInfo(userAddress) {
    return apiFetch(`/user-trades/user/${userAddress.toLowerCase()}/info`);
}
/** Search tokens by name/symbol (max limit: 10) */
async function searchTokens(query, limit = 10) {
    return apiFetch(`/groups/search?search=${encodeURIComponent(query)}&limit=${Math.min(limit, 10)}`);
}
/** Get global trades feed (all tokens, max 50) */
async function getGlobalTrades(limit = 50, offset = 0) {
    return apiFetch(`/groups/trades-plus?limit=${Math.min(limit, 50)}&offset=${offset}`);
}
//# sourceMappingURL=arena-api.js.map