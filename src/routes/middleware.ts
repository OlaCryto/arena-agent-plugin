import { Request, Response, NextFunction } from "express";
import { validateApiKey } from "../data/apikeys";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string;
  if (!key || !validateApiKey(key)) {
    res.status(401).json({ error: "Invalid or missing API key. Pass X-API-Key header." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_SECRET) {
    res.status(503).json({ error: "Admin routes are disabled: ADMIN_SECRET is not configured." });
    return;
  }

  const secret = req.headers["x-admin-secret"] as string;
  if (secret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Invalid admin secret." });
    return;
  }
  next();
}

export function parseSlippageBps(value?: string): number | undefined {
  if (value == null || value.trim() === "") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return NaN;
  if (parsed < 1 || parsed > 5_000) return NaN;
  return parsed;
}
