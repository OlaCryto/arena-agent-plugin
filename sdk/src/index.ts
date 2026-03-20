// Main client
export { Logiqical, LogiqicalClient } from "./client.js";
export type { LogiqicalConfig } from "./client.js";

// Wallet
export { AgentWallet, CHAINS } from "./wallet.js";
export type { AgentWalletConfig, ChainConfig } from "./wallet.js";

// Modules
export { SwapModule } from "./modules/swap.js";
export { StakingModule } from "./modules/staking.js";
export { LaunchpadModule } from "./modules/launchpad.js";
export { DexModule } from "./modules/dex.js";
export { PerpsModule } from "./modules/perps.js";
export { BridgeModule } from "./modules/bridge.js";
export { TicketsModule } from "./modules/tickets.js";
export type { TicketPriceResponse, TicketBalanceResponse, TicketSupplyResponse, TicketFeesResponse } from "./modules/tickets.js";
export { SocialModule } from "./modules/social.js";
export { SignalsModule } from "./modules/signals.js";
export type { MarketSignal, TechnicalSignal, SignalSummary } from "./modules/signals.js";
export { MarketModule } from "./modules/market.js";
export { DefiModule } from "./modules/defi.js";

// Errors
export { LogiqicalError } from "./errors.js";
export type { LogiqicalErrorCode } from "./errors.js";

// Policy
export { PolicyEngine, PolicyError } from "./policy.js";
export type { SpendingPolicy, PolicyErrorCode } from "./policy.js";

// Types
export type { UnsignedTx, CallIntent, TransactionResult } from "./types.js";
