import { Router } from "express";
import type { StakingModule } from "../staking";
import type { SwapModule } from "../swap";
import { requireApiKey } from "./middleware";

export function stakingRoutes(staking: StakingModule, swap: SwapModule): Router {
  const router = Router();

  router.get("/stake/info", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      if (!wallet) return res.status(400).json({ error: "?wallet= required" });
      const result = await staking.getStakeInfo(wallet);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/build/stake", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const amount = req.query.amount as string;
      if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required" });
      const approveTx = await staking.buildApproveStakingTx(wallet, amount);
      const stakeTx = await staking.buildStakeTx(wallet, amount);
      res.json({ transactions: [approveTx, stakeTx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/build/buy-and-stake", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const avax = req.query.avax as string;
      const slippage = req.query.slippage as string;
      if (!wallet || !avax) return res.status(400).json({ error: "?wallet= and ?avax= required" });
      const txs = await staking.buildBuyAndStakeTxs(wallet, avax, slippage ? Number(slippage) : undefined);
      res.json({ transactions: txs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/build/unstake", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const amount = req.query.amount as string;
      if (!wallet || !amount) return res.status(400).json({ error: "?wallet= and ?amount= required" });
      const tx = await staking.buildUnstakeTx(wallet, amount);
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
