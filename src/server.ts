import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createProvider } from "./core/provider";
import { SwapModule } from "./swap";
import { StakingModule } from "./staking";
import { LaunchpadModule } from "./launchpad";
import { DexModule } from "./dex";
import { generateApiKey } from "./data/apikeys";

import { adminRoutes } from "./routes/admin";
import { swapRoutes } from "./routes/swap";
import { stakingRoutes } from "./routes/staking";
import { launchpadRoutes } from "./routes/launchpad";
import { dexRoutes } from "./routes/dex";
import { dashboardRoutes } from "./routes/dashboard";
import { instructionRoutes } from "./routes/instructions";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000");

// Create shared provider and modules
const provider = createProvider();
const swap = new SwapModule(provider);
const staking = new StakingModule(provider, swap);
const launchpad = new LaunchpadModule(provider);
const dex = new DexModule(provider);

// Public endpoints
app.get("/register", (req, res) => {
  const wallet = req.query.wallet as string;
  const name = req.query.name as string || wallet;
  if (!wallet) return res.status(400).json({ error: "?wallet=<your-wallet-address> required" });
  const key = generateApiKey(name, wallet);
  res.json({ key, name, wallet, message: "Save this API key. It works for ALL Arena endpoints — staking, launchpad trading, everything. Include it as X-API-Key header in all requests." });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    router: swap.routerAddress || "not deployed yet",
    fee: "0.3%",
  });
});

// Mount routes
app.use(instructionRoutes());
app.use(adminRoutes());
app.use(swapRoutes(swap, provider));
app.use(stakingRoutes(staking, swap));
app.use(launchpadRoutes(launchpad));
app.use(dexRoutes(dex));
app.use(dashboardRoutes());

// Serve frontend
app.use(express.static("frontend"));

app.listen(PORT, () => {
  console.log(`Arena Agent Plugin running on port ${PORT}`);
  console.log(`Fee: 0.3% on buys via ArenaRouter`);
  console.log(`Router: ${swap.routerAddress || "NOT SET — deploy contract and set ARENA_ROUTER env var"}`);
});
