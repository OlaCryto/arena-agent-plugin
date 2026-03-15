"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireApiKey = requireApiKey;
exports.requireAdmin = requireAdmin;
exports.parseSlippageBps = parseSlippageBps;
const apikeys_1 = require("../data/apikeys");
const ADMIN_SECRET = process.env.ADMIN_SECRET;
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"];
    if (!key || !(0, apikeys_1.validateApiKey)(key)) {
        res.status(401).json({ error: "Invalid or missing API key. Pass X-API-Key header." });
        return;
    }
    next();
}
function requireAdmin(req, res, next) {
    if (!ADMIN_SECRET) {
        res.status(503).json({ error: "Admin routes are disabled: ADMIN_SECRET is not configured." });
        return;
    }
    const secret = req.headers["x-admin-secret"];
    if (secret !== ADMIN_SECRET) {
        res.status(403).json({ error: "Invalid admin secret." });
        return;
    }
    next();
}
function parseSlippageBps(value) {
    if (value == null || value.trim() === "")
        return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed))
        return NaN;
    if (parsed < 1 || parsed > 5000)
        return NaN;
    return parsed;
}
//# sourceMappingURL=middleware.js.map