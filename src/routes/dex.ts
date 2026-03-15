import { Router } from "express";
import type { DexModule } from "../dex";
import { requireApiKey } from "./middleware";
import { logTrade } from "../data/tradelog";

export function dexRoutes(dex: DexModule): Router {
  const router = Router();

  /** List all known tokens with addresses and decimals */
  router.get("/dex/tokens", requireApiKey, (_req, res) => {
    try {
      const tokens = dex.getTokenList();
      res.json({ tokens, note: "You can also pass any contract address (0x...) directly — not limited to this list." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Get on-chain info for any token address */
  router.get("/dex/token-info", requireApiKey, async (req, res) => {
    try {
      const address = req.query.address as string;
      if (!address) return res.status(400).json({ error: "?address=0x... required" });
      const info = await dex.getTokenInfo(address);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Quote any token pair */
  router.get("/dex/quote", requireApiKey, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      const amount = req.query.amount as string;
      if (!from || !to || !amount) {
        return res.status(400).json({ error: "?from=<symbol|address>&to=<symbol|address>&amount=<number> required" });
      }
      const result = await dex.getQuote(from, to, amount);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Get balance of any token */
  router.get("/dex/balance", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const token = req.query.token as string;
      if (!wallet || !token) {
        return res.status(400).json({ error: "?wallet=<address>&token=<symbol|address> required" });
      }
      const result = await dex.getBalance(wallet, token);
      res.json({ wallet, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Build unsigned swap tx(s) for any pair */
  router.get("/dex/build/swap", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const from = req.query.from as string;
      const to = req.query.to as string;
      const amount = req.query.amount as string;
      const slippage = req.query.slippage as string;
      if (!wallet || !from || !to || !amount) {
        return res.status(400).json({
          error: "?wallet=<address>&from=<symbol|address>&to=<symbol|address>&amount=<number|max> required",
        });
      }
      const result = await dex.buildSwapTx(wallet, from, to, amount, slippage ? Number(slippage) : undefined);
      logTrade(req.get("X-API-Key") || "unknown", wallet, "dex-swap", `${amount} ${from} → ${to}`, "dex");
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
