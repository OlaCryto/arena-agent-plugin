"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireApiKey = requireApiKey;
exports.requireAdmin = requireAdmin;
const apikeys_1 = require("../data/apikeys");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-me";
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"];
    if (!key || !(0, apikeys_1.validateApiKey)(key)) {
        res.status(401).json({ error: "Invalid or missing API key. Pass X-API-Key header." });
        return;
    }
    next();
}
function requireAdmin(req, res, next) {
    const secret = req.headers["x-admin-secret"];
    if (secret !== ADMIN_SECRET) {
        res.status(403).json({ error: "Invalid admin secret." });
        return;
    }
    next();
}
//# sourceMappingURL=middleware.js.map