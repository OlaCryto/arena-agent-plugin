import { HttpClient } from "./http.js";
import { SwapModule } from "./modules/swap.js";
import { StakingModule } from "./modules/staking.js";
import { LaunchpadModule } from "./modules/launchpad.js";
import { DexModule } from "./modules/dex.js";
import type { RegisterResponse, BroadcastResponse, HealthResponse } from "./types.js";

const DEFAULT_BASE_URL = "https://brave-alignment-production-1706.up.railway.app";

export interface LogiqicalConfig {
  /** Your wallet address — used for auto-registration */
  wallet: string;
  /** Existing API key (skips auto-registration if provided) */
  apiKey?: string;
  /** Custom base URL (defaults to Logiqical production API) */
  baseUrl?: string;
  /** Agent display name for registration */
  name?: string;
}

/**
 * Logiqical SDK client — the complete toolkit for AI agents trading on Avalanche.
 *
 * ```ts
 * import { LogiqicalClient } from "logiqical";
 *
 * const client = new LogiqicalClient({ wallet: "0xYourWallet" });
 *
 * // Auto-registers on first call — no setup needed
 * const balances = await client.swap.getBalances("0xYourWallet");
 * const tokens = await client.launchpad.getRecent(10);
 * const tx = await client.dex.buildSwap("0xWallet", "AVAX", "USDC", "1.0");
 * ```
 */
export class LogiqicalClient {
  /** Buy/sell ARENA tokens via LFJ DEX */
  readonly swap: SwapModule;
  /** Stake ARENA tokens for rewards */
  readonly staking: StakingModule;
  /** Discover, research, and trade launchpad tokens on bonding curves */
  readonly launchpad: LaunchpadModule;
  /** Swap any Avalanche token via LFJ + Pharaoh DEX */
  readonly dex: DexModule;

  private http: HttpClient;
  private wallet: string;
  private agentName: string;
  private registrationPromise: Promise<void> | null = null;

  constructor(config: LogiqicalConfig) {
    this.wallet = config.wallet;
    this.agentName = config.name ?? "agent";
    this.http = new HttpClient(config.baseUrl ?? DEFAULT_BASE_URL, config.apiKey);

    const auth = () => this.ensureRegistered();
    this.swap = new SwapModule(this.http, auth);
    this.staking = new StakingModule(this.http, auth);
    this.launchpad = new LaunchpadModule(this.http, auth);
    this.dex = new DexModule(this.http, auth);
  }

  /** The API key (available after first call or if provided in config) */
  get apiKey(): string | null {
    return this.http.getApiKey();
  }

  /**
   * Broadcast a signed transaction to the Avalanche network.
   * @param signedTx - Signed transaction hex string
   * @returns Transaction hash
   */
  async broadcast(signedTx: string): Promise<BroadcastResponse> {
    await this.ensureRegistered();
    return this.http.post("/broadcast", { signedTx });
  }

  /**
   * Get the full agent instructions document — describes all available capabilities.
   */
  async getInstructions(): Promise<string> {
    await this.ensureRegistered();
    return this.http.get("/agent-instructions");
  }

  /**
   * Check if the API is healthy and responsive.
   */
  async health(): Promise<HealthResponse> {
    return this.http.get("/health", undefined, true);
  }

  /**
   * Manually register and get an API key.
   * Usually not needed — the client auto-registers on first call.
   */
  async register(): Promise<RegisterResponse> {
    const data = await this.http.get<any>("/register", {
      wallet: this.wallet,
      name: this.agentName,
    }, true);
    const apiKey = data.apiKey || data.key;
    this.http.setApiKey(apiKey);
    return { apiKey, wallet: data.wallet, name: data.name };
  }

  private async ensureRegistered(): Promise<void> {
    if (this.http.getApiKey()) return;
    if (!this.registrationPromise) {
      this.registrationPromise = this.register().then(() => {}).catch(e => {
        this.registrationPromise = null;
        throw e;
      });
    }
    return this.registrationPromise;
  }
}
