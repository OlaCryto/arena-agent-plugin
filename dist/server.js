"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const provider_1 = require("./core/provider");
const swap_1 = require("./swap");
const staking_1 = require("./staking");
const launchpad_1 = require("./launchpad");
const dex_1 = require("./dex");
const apikeys_1 = require("./data/apikeys");
const admin_1 = require("./routes/admin");
const swap_2 = require("./routes/swap");
const staking_2 = require("./routes/staking");
const launchpad_2 = require("./routes/launchpad");
const dex_2 = require("./routes/dex");
const instructions_1 = require("./routes/instructions");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = parseInt(process.env.PORT || "3000");
// Create shared provider and modules
const provider = (0, provider_1.createProvider)();
const swap = new swap_1.SwapModule(provider);
const staking = new staking_1.StakingModule(provider, swap);
const launchpad = new launchpad_1.LaunchpadModule(provider);
const dex = new dex_1.DexModule(provider);
// Public endpoints
app.get("/register", (req, res) => {
    const wallet = req.query.wallet;
    const name = req.query.name || wallet;
    if (!wallet)
        return res.status(400).json({ error: "?wallet=<your-wallet-address> required" });
    const key = (0, apikeys_1.generateApiKey)(name, wallet);
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
app.use((0, instructions_1.instructionRoutes)());
app.use((0, admin_1.adminRoutes)());
app.use((0, swap_2.swapRoutes)(swap, provider));
app.use((0, staking_2.stakingRoutes)(staking, swap));
app.use((0, launchpad_2.launchpadRoutes)(launchpad));
app.use((0, dex_2.dexRoutes)(dex));
app.listen(PORT, () => {
    console.log(`Arena Agent Plugin running on port ${PORT}`);
    console.log(`Fee: 0.3% on buys via ArenaRouter`);
    console.log(`Router: ${swap.routerAddress || "NOT SET — deploy contract and set ARENA_ROUTER env var"}`);
});
//# sourceMappingURL=server.js.map