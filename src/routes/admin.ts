import { Router } from "express";
import { generateApiKey, listApiKeys, revokeApiKey } from "../data/apikeys";
import { requireAdmin } from "./middleware";

export function adminRoutes(): Router {
  const router = Router();

  router.all("/admin/keys/create", requireAdmin, (req, res) => {
    const name = req.body?.name || req.query.name as string;
    if (!name) return res.status(400).json({ error: "name is required (?name=)" });
    const key = generateApiKey(name);
    res.json({ key, name, message: "Store this key — it won't be shown again." });
  });

  router.get("/admin/keys", requireAdmin, (_req, res) => {
    res.json(listApiKeys());
  });

  router.all("/admin/keys/revoke", requireAdmin, (req, res) => {
    const name = req.body?.name || req.query.name as string;
    if (!name) return res.status(400).json({ error: "name is required (?name=)" });
    const revoked = revokeApiKey(name);
    res.json({ revoked, name });
  });

  return router;
}
