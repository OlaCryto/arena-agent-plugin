"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = adminRoutes;
const express_1 = require("express");
const apikeys_1 = require("../data/apikeys");
const middleware_1 = require("./middleware");
function adminRoutes() {
    const router = (0, express_1.Router)();
    router.all("/admin/keys/create", middleware_1.requireAdmin, (req, res) => {
        const name = req.body?.name || req.query.name;
        if (!name)
            return res.status(400).json({ error: "name is required (?name=)" });
        const key = (0, apikeys_1.generateApiKey)(name);
        res.json({ key, name, message: "Store this key — it won't be shown again." });
    });
    router.get("/admin/keys", middleware_1.requireAdmin, (_req, res) => {
        res.json((0, apikeys_1.listApiKeys)());
    });
    router.all("/admin/keys/revoke", middleware_1.requireAdmin, (req, res) => {
        const name = req.body?.name || req.query.name;
        if (!name)
            return res.status(400).json({ error: "name is required (?name=)" });
        const revoked = (0, apikeys_1.revokeApiKey)(name);
        res.json({ revoked, name });
    });
    return router;
}
//# sourceMappingURL=admin.js.map