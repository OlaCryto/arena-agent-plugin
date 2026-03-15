"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackPosition = trackPosition;
exports.removePosition = removePosition;
exports.getPositions = getPositions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const POSITIONS_FILE = fs_1.default.existsSync("/data")
    ? "/data/positions.json"
    : path_1.default.join(process.cwd(), "positions.json");
function load() {
    if (!fs_1.default.existsSync(POSITIONS_FILE))
        return {};
    return JSON.parse(fs_1.default.readFileSync(POSITIONS_FILE, "utf-8"));
}
function save(data) {
    fs_1.default.writeFileSync(POSITIONS_FILE, JSON.stringify(data, null, 2));
}
function trackPosition(wallet, tokenId) {
    const data = load();
    const key = wallet.toLowerCase();
    if (!data[key])
        data[key] = [];
    if (!data[key].includes(tokenId)) {
        data[key].push(tokenId);
        save(data);
    }
}
function removePosition(wallet, tokenId) {
    const data = load();
    const key = wallet.toLowerCase();
    if (!data[key])
        return;
    data[key] = data[key].filter((id) => id !== tokenId);
    if (data[key].length === 0)
        delete data[key];
    save(data);
}
function getPositions(wallet) {
    const data = load();
    return data[wallet.toLowerCase()] || [];
}
//# sourceMappingURL=positions.js.map