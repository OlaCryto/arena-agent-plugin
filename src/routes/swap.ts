import { Router } from "express";
import type { SwapModule } from "../swap";
import { broadcast } from "../core/provider";
import type { ethers } from "ethers";
import { parseSlippageBps, requireApiKey } from "./middleware";

export function swapRoutes(swap: SwapModule, provider: ethers.JsonRpcProvider): Router {
  const router = Router();

  router.get("/balances", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      if (!wallet) return res.status(400).json({ error: "?wallet= required" });
      const result = await swap.getBalances(wallet);
      res.json({ ...result, wallet });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/quote", requireApiKey, async (req, res) => {
    try {
      const avax = req.query.avax as string;
      if (!avax) return res.status(400).json({ error: "?avax= required" });
      const result = await swap.getQuote(avax);
      res.json({ avaxIn: avax, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/quote/sell", requireApiKey, async (req, res) => {
    try {
      const arena = req.query.arena as string;
      if (!arena) return res.status(400).json({ error: "?arena=<amount> required" });
      const result = await swap.getSellQuote(arena);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/build/buy", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const avax = req.query.avax as string;
      const slippage = req.query.slippage as string;
      if (!wallet || !avax) return res.status(400).json({ error: "?wallet= and ?avax= required" });
      const slippageBps = parseSlippageBps(slippage);
      if (Number.isNaN(slippageBps)) return res.status(400).json({ error: "?slippage= must be an integer between 1 and 5000 (bps)" });
      const tx = await swap.buildBuyTx(wallet, avax, slippageBps);
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/build/sell-arena", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const amount = req.query.amount as string;
      const slippage = req.query.slippage as string;
      if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required (use 'max' to sell all)" });
      const slippageBps = parseSlippageBps(slippage);
      if (Number.isNaN(slippageBps)) return res.status(400).json({ error: "?slippage= must be an integer between 1 and 5000 (bps)" });
      const txs = await swap.buildSellArenaTx(wallet, amount, slippageBps);
      res.json({ transactions: txs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/broadcast", requireApiKey, async (req, res) => {
    try {
      const { signedTx } = req.body;
      if (!signedTx) return res.status(400).json({ error: "signedTx is required in body" });
      const txHash = await broadcast(provider, signedTx);
      res.json({ txHash });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
