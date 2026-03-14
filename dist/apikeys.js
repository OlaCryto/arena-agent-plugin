"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKey = generateApiKey;
exports.validateApiKey = validateApiKey;
exports.listApiKeys = listApiKeys;
exports.revokeApiKey = revokeApiKey;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Use Railway persistent volume if available, otherwise fall back to local file
const KEYS_FILE = fs_1.default.existsSync("/data") ? "/data/api-keys.json" : path_1.default.join(process.cwd(), "api-keys.json");
function loadKeys() {
    if (!fs_1.default.existsSync(KEYS_FILE))
        return [];
    return JSON.parse(fs_1.default.readFileSync(KEYS_FILE, "utf-8"));
}
function saveKeys(keys) {
    fs_1.default.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}
function generateApiKey(name) {
    const key = "arena_" + (0, crypto_1.randomBytes)(24).toString("hex");
    const keys = loadKeys();
    keys.push({ key, name, createdAt: new Date().toISOString() });
    saveKeys(keys);
    return key;
}
function validateApiKey(key) {
    const keys = loadKeys();
    return keys.some((k) => k.key === key);
}
function listApiKeys() {
    return loadKeys().map(({ name, createdAt }) => ({ name, createdAt }));
}
function revokeApiKey(name) {
    const keys = loadKeys();
    const filtered = keys.filter((k) => k.name !== name);
    if (filtered.length === keys.length)
        return false;
    saveKeys(filtered);
    return true;
}
//# sourceMappingURL=apikeys.js.map