"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logTrade = logTrade;
exports.getRecentTrades = getRecentTrades;
exports.getTradeStats = getTradeStats;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_FILE = fs_1.default.existsSync("/data") ? "/data/trade-log.json" : path_1.default.join(process.cwd(), "trade-log.json");
function loadLog() {
    if (!fs_1.default.existsSync(LOG_FILE))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(LOG_FILE, "utf-8"));
    }
    catch {
        return [];
    }
}
function saveLog(entries) {
    // Keep last 500 entries
    const trimmed = entries.slice(-500);
    fs_1.default.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2));
}
function logTrade(agent, wallet, action, details, module) {
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
function getRecentTrades(count = 50) {
    const entries = loadLog();
    return entries.slice(-count).reverse();
}
function getTradeStats() {
    const entries = loadLog();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = entries.filter(e => new Date(e.timestamp).getTime() > cutoff).length;
    const byModule = {};
    for (const e of entries) {
        byModule[e.module] = (byModule[e.module] || 0) + 1;
    }
    return { total: entries.length, last24h, byModule };
}
//# sourceMappingURL=tradelog.js.map