import dotenv from "dotenv";
dotenv.config();

import express from "express";
import compression from "compression";
import { createProvider } from "./core/provider";
import { SwapModule } from "./swap";
import { StakingModule } from "./staking";
import { LaunchpadModule } from "./launchpad";
import { DexModule } from "./dex";
import { PerpsModule } from "./perps";
import { generateApiKey } from "./data/apikeys";

import { adminRoutes } from "./routes/admin";
import { swapRoutes } from "./routes/swap";
import { stakingRoutes } from "./routes/staking";
import { launchpadRoutes } from "./routes/launchpad";
import { dexRoutes } from "./routes/dex";
import { dashboardRoutes } from "./routes/dashboard";
import { perpsRoutes } from "./routes/perps";
import { BridgeModule } from "./bridge";
import { bridgeRoutes } from "./routes/bridge";
import { TicketsModule } from "./tickets";
import { ticketRoutes } from "./routes/tickets";
import { SocialModule } from "./social";
import { socialRoutes } from "./routes/social";
import { SignalsModule } from "./signals";
import { signalRoutes } from "./routes/signals";
import { instructionRoutes } from "./routes/instructions";

const app = express();
app.use(compression());
app.use(express.json({ limit: "5mb" }));

const PORT = parseInt(process.env.PORT || "3000");

// Create shared provider and modules
const provider = createProvider();
const swap = new SwapModule(provider);
const staking = new StakingModule(provider, swap);
const launchpad = new LaunchpadModule(provider);
const dex = new DexModule(provider);
const perps = new PerpsModule();
const bridgeModule = new BridgeModule();
const ticketsModule = new TicketsModule(provider);
const socialModule = new SocialModule();
const signalsModule = new SignalsModule();

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
app.use(launchpadRoutes(launchpad, provider));
app.use(dexRoutes(dex));
app.use(perpsRoutes(perps));
app.use(bridgeRoutes(bridgeModule));
app.use(ticketRoutes(ticketsModule));
app.use(socialRoutes(socialModule));
app.use(signalRoutes(signalsModule));
app.use(dashboardRoutes());

app.listen(PORT, () => {
  console.log(`Arena Agent Plugin running on port ${PORT}`);
  console.log(`Fee: 0.3% on buys via ArenaRouter`);
  console.log(`Router: ${swap.routerAddress || "NOT SET — deploy contract and set ARENA_ROUTER env var"}`);
});
