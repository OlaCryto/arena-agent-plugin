import { ethers, JsonRpcProvider, Contract } from "ethers";
import { AgentWallet, CHAINS } from "./wallet.js";
import { PolicyEngine, PolicyError, type SpendingPolicy } from "./policy.js";
import { SwapModule } from "./modules/swap.js";
import { StakingModule } from "./modules/staking.js";
import { LaunchpadModule } from "./modules/launchpad.js";
import { DexModule } from "./modules/dex.js";
import { PerpsModule } from "./modules/perps.js";
import { BridgeModule } from "./modules/bridge.js";
import { TicketsModule } from "./modules/tickets.js";
import { SocialModule } from "./modules/social.js";
import { SignalsModule } from "./modules/signals.js";
import { MarketModule } from "./modules/market.js";
import { DefiModule } from "./modules/defi.js";
import type { UnsignedTx, CallIntent, TransactionResult } from "./types.js";
import type { TransactionResponse } from "ethers";

export interface LogiqicalConfig {
  /** Private key — creates a local wallet for signing (0x-prefixed hex) */
  privateKey?: string;
  /** Mnemonic phrase — derives wallet from HD path */
  mnemonic?: string;
  /** Wallet address (required if no privateKey/mnemonic) */
  wallet?: string;
  /** Arena API key for social, perps, tickets endpoints */
  arenaApiKey?: string;
  /** Network name from chain registry (default: "avalanche") */
  network?: string;
  /** Custom RPC URL (overrides network) */
  rpcUrl?: string;
  /** Agent display name */
  name?: string;
  /** Password for keystore encryption (default: "logiqical-agent") */
  password?: string;
  /** Spending policy — per-tx limits, budgets, allowlists, simulation */
  policy?: SpendingPolicy;
}

/**
 * Logiqical — standalone agent wallet SDK for Avalanche + Arena.
 *
 * ```ts
 * import { Logiqical } from "logiqical";
 *
 * const agent = await Logiqical.boot({
 *   policy: { maxPerTx: "1.0", maxPerDay: "10.0", simulateBeforeSend: true },
 * });
 *
 * // One-liner: policy check + simulate + sign + broadcast
 * await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));
 * ```
 */
export class Logiqical {
  /** Buy/sell ARENA tokens via LFJ DEX */
  readonly swap: SwapModule;
  /** Stake ARENA tokens for rewards */
  readonly staking: StakingModule;
  /** Discover, research, and trade launchpad tokens on bonding curves */
  readonly launchpad: LaunchpadModule;
  /** Swap any Avalanche token via LFJ DEX */
  readonly dex: DexModule;
  /** Trade perpetual futures on Hyperliquid via Arena */
  readonly perps: PerpsModule;
  /** Cross-chain token bridging via Li.Fi */
  readonly bridge: BridgeModule;
  /** Buy/sell Arena tickets */
  readonly tickets: TicketsModule;
  /** Arena social: chat, DMs, posts, follow, user discovery */
  readonly social: SocialModule;
  /** Market signals intelligence — scan, funding rates, whale tracking */
  readonly signals: SignalsModule;
  /** Market data — prices, trending, top coins via CoinGecko */
  readonly market: MarketModule;
  /** DeFi — sAVAX liquid staking + ERC-4626 vaults */
  readonly defi: DefiModule;

  /** The agent's wallet address */
  readonly address: string;
  /** The local wallet (null if read-only mode) */
  readonly agentWallet: AgentWallet | null;
  /** The JSON-RPC provider for direct chain reads */
  readonly provider: JsonRpcProvider;
  /** The spending policy engine */
  readonly policyEngine: PolicyEngine;

  private config: LogiqicalConfig;

  constructor(config: LogiqicalConfig) {
    this.config = config;
    this.policyEngine = new PolicyEngine(config.policy);

    if (config.privateKey) {
      this.agentWallet = AgentWallet.fromPrivateKey(config.privateKey, {
        network: config.network,
        rpcUrl: config.rpcUrl,
      });
      this.provider = this.agentWallet.provider;
      this.address = this.agentWallet.address;
    } else if (config.mnemonic) {
      const hdWallet = ethers.HDNodeWallet.fromPhrase(config.mnemonic);
      this.agentWallet = AgentWallet.fromPrivateKey(hdWallet.privateKey, {
        network: config.network,
        rpcUrl: config.rpcUrl,
      });
      this.provider = this.agentWallet.provider;
      this.address = this.agentWallet.address;
    } else if (config.wallet) {
      this.agentWallet = null;
      const { provider } = Logiqical.resolveProvider(config);
      this.provider = provider;
      this.address = config.wallet;
    } else {
      throw new Error("Provide privateKey, mnemonic, or wallet (read-only).");
    }

    // On-chain modules (direct contract calls via provider)
    this.swap = new SwapModule(this.provider);
    this.staking = new StakingModule(this.provider);
    this.launchpad = new LaunchpadModule(this.provider);
    this.dex = new DexModule(this.provider);
    this.tickets = new TicketsModule(this.provider);

    // API modules (direct external API calls)
    this.perps = new PerpsModule(config.arenaApiKey);
    this.social = new SocialModule(config.arenaApiKey);
    this.bridge = new BridgeModule();
    this.signals = new SignalsModule();
    this.market = new MarketModule();
    this.defi = new DefiModule(this.provider);
  }

  // ── Factory Methods ──

  /** Generate a brand new agent wallet */
  static generate(config: Omit<LogiqicalConfig, "privateKey" | "mnemonic" | "wallet"> = {}): Logiqical {
    const wallet = AgentWallet.generate({ network: config.network, rpcUrl: config.rpcUrl });
    return new Logiqical({ ...config, privateKey: wallet.privateKey });
  }

  /** Boot from encrypted keystore — creates wallet on first run, loads on subsequent runs */
  static async boot(config: Omit<LogiqicalConfig, "privateKey" | "mnemonic" | "wallet"> & { keystoreName?: string } = {}): Promise<Logiqical> {
    const wallet = await AgentWallet.boot({
      network: config.network,
      rpcUrl: config.rpcUrl,
      password: config.password,
      keystoreName: config.keystoreName,
    });
    return new Logiqical({ ...config, privateKey: wallet.privateKey });
  }

  // ── Core Agent Operations ──

  /**
   * Execute any module result — policy check + simulate + sign + broadcast.
   *
   * ```ts
   * await agent.execute(agent.dex.buildSwap(agent.address, "AVAX", "USDC", "1.0"));
   * await agent.execute(agent.launchpad.buildBuy(agent.address, "42", "0.5"));
   * ```
   */
  async execute(
    resultOrPromise: Promise<{ transactions?: UnsignedTx[]; transaction?: UnsignedTx; [key: string]: any }> | { transactions?: UnsignedTx[]; transaction?: UnsignedTx; [key: string]: any },
    confirmations = 1,
  ): Promise<TransactionResult[]> {
    this.requireWallet("execute");
    const result = await resultOrPromise;

    const txs: UnsignedTx[] = result.transactions
      ?? (result.transaction ? [result.transaction] : []);

    if (txs.length === 0) throw new Error("No transactions to execute.");

    const results: TransactionResult[] = [];
    for (const utx of txs) {
      // Policy check
      this.policyEngine.check(utx);

      // Simulation
      if (this.policyEngine.shouldSimulate) {
        await this.simulate(utx);
      }

      // Dry run — don't broadcast
      if (this.policyEngine.isDryRun) {
        results.push({
          hash: "0x_dry_run",
          receipt: { status: 1, blockNumber: 0, gasUsed: "0", transactionHash: "0x_dry_run" },
        });
        continue;
      }

      // Sign + broadcast
      const txResponse = await this.agentWallet!.signAndBroadcast(utx);
      const receipt = await txResponse.wait(confirmations);
      if (!receipt) throw new Error(`Transaction ${txResponse.hash} failed — no receipt.`);

      // Record spend for budget tracking
      const value = utx.value ? BigInt(utx.value) : 0n;
      if (value > 0n) this.policyEngine.recordSpend(value);

      results.push({
        hash: txResponse.hash,
        receipt: {
          status: receipt.status ?? 0,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          transactionHash: receipt.hash,
        },
      });
    }
    return results;
  }

  /**
   * Call any smart contract method — policy check + simulate + sign + broadcast.
   *
   * ```ts
   * await agent.call({
   *   contract: "0x...",
   *   abi: ["function transfer(address,uint256) returns (bool)"],
   *   method: "transfer",
   *   args: ["0xRecipient", ethers.parseUnits("100", 18)],
   * });
   * ```
   */
  async call(intent: CallIntent): Promise<TransactionResult> {
    this.requireWallet("call");

    // Build an UnsignedTx equivalent for policy check
    const iface = new ethers.Interface(intent.abi);
    const data = iface.encodeFunctionData(intent.method, intent.args ?? []);
    const valueWei = intent.value ? ethers.parseEther(intent.value).toString() : "0";
    const policyTx: UnsignedTx = { to: intent.contract, data, value: valueWei, chainId: 43114 };
    this.policyEngine.check(policyTx);

    if (this.policyEngine.shouldSimulate) {
      await this.simulate(policyTx);
    }

    if (this.policyEngine.isDryRun) {
      return { hash: "0x_dry_run", receipt: { status: 1, blockNumber: 0, gasUsed: "0", transactionHash: "0x_dry_run" } };
    }

    const contract = new Contract(
      ethers.getAddress(intent.contract),
      intent.abi,
      this.agentWallet!.wallet,
    );
    const tx: TransactionResponse = await contract[intent.method](
      ...(intent.args ?? []),
      {
        value: intent.value ? ethers.parseEther(intent.value) : undefined,
        gasLimit: intent.gasLimit ?? undefined,
      },
    );
    const receipt = await tx.wait(1);
    if (!receipt) throw new Error(`Transaction ${tx.hash} failed — no receipt.`);

    if (intent.value) {
      this.policyEngine.recordSpend(ethers.parseEther(intent.value));
    }

    return {
      hash: tx.hash,
      receipt: {
        status: receipt.status ?? 0,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        transactionHash: receipt.hash,
      },
    };
  }

  /** Send native token (AVAX) — policy check + simulate + sign + broadcast */
  async send(to: string, amount: string): Promise<TransactionResult> {
    this.requireWallet("send");
    const valueWei = ethers.parseEther(amount);
    const policyTx: UnsignedTx = { to, data: "0x", value: valueWei.toString(), chainId: 43114 };
    this.policyEngine.check(policyTx);

    if (this.policyEngine.isDryRun) {
      return { hash: "0x_dry_run", receipt: { status: 1, blockNumber: 0, gasUsed: "0", transactionHash: "0x_dry_run" } };
    }

    const tx = await this.agentWallet!.send(to, amount);
    const receipt = await tx.wait(1);
    if (!receipt) throw new Error(`Transaction ${tx.hash} failed — no receipt.`);

    this.policyEngine.recordSpend(valueWei);

    return {
      hash: tx.hash,
      receipt: {
        status: receipt.status ?? 0,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        transactionHash: receipt.hash,
      },
    };
  }

  /** Simulate a transaction via eth_call — throws PolicyError if it would revert */
  async simulate(tx: UnsignedTx): Promise<void> {
    try {
      await this.provider.call({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : undefined,
        from: this.address,
      });
    } catch (e: any) {
      throw new PolicyError(
        `Simulation failed: ${e.reason || e.message || "transaction would revert"}`,
        "SIMULATION_FAILED",
      );
    }
  }

  // ── Policy ──

  /** Get the current spending policy */
  getPolicy(): SpendingPolicy { return this.policyEngine.getPolicy(); }

  /** Replace the entire spending policy */
  setPolicy(policy: SpendingPolicy): void { this.policyEngine.setPolicy(policy); }

  /** Update specific policy fields */
  updatePolicy(updates: Partial<SpendingPolicy>): void { this.policyEngine.updatePolicy(updates); }

  /** Get budget status: spent this hour, today, remaining */
  getBudgetStatus() { return this.policyEngine.getBudgetStatus(); }

  // ── Read Operations (no signing needed) ──

  /** Check if this client has a local wallet for signing */
  get canSign(): boolean { return this.agentWallet !== null; }

  /** The private key (only available in wallet mode) */
  get privateKey(): string {
    this.requireWallet("privateKey");
    return this.agentWallet!.privateKey;
  }

  /** Get native token balance (formatted) */
  async getBalance(): Promise<string> {
    if (this.agentWallet) return this.agentWallet.getBalance();
    const balance = await this.provider.getBalance(this.address);
    return ethers.formatEther(balance);
  }

  /** Sign a message */
  async signMessage(message: string): Promise<string> {
    this.requireWallet("signMessage");
    return this.agentWallet!.signMessage(message);
  }

  /** Sign EIP-712 typed data */
  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    this.requireWallet("signTypedData");
    return this.agentWallet!.signTypedData(domain, types, value);
  }

  /** Switch to a different network (returns new Logiqical instance with same keys) */
  switchNetwork(network: string): Logiqical {
    this.requireWallet("switchNetwork");
    return new Logiqical({
      ...this.config,
      privateKey: this.agentWallet!.privateKey,
      mnemonic: undefined,
      wallet: undefined,
      network,
    });
  }

  /** Save the wallet to an encrypted keystore file */
  async saveKeystore(password?: string, name?: string): Promise<string> {
    this.requireWallet("saveKeystore");
    return this.agentWallet!.saveKeystore(password, name);
  }

  // ── Low-level (advanced — bypasses policy) ──

  /** Sign and broadcast a single unsigned tx — bypasses policy engine */
  async signAndBroadcast(unsignedTx: UnsignedTx): Promise<TransactionResponse> {
    this.requireWallet("signAndBroadcast");
    return this.agentWallet!.signAndBroadcast(unsignedTx);
  }

  /** Sign and broadcast multiple unsigned txs — bypasses policy engine */
  async signAndBroadcastAll(unsignedTxs: UnsignedTx[], confirmations = 1): Promise<TransactionResponse[]> {
    this.requireWallet("signAndBroadcastAll");
    return this.agentWallet!.signAndBroadcastAll(unsignedTxs, confirmations);
  }

  // ── Internal ──

  private requireWallet(method: string): void {
    if (!this.agentWallet) throw new Error(`No local wallet — cannot ${method}(). Provide privateKey or use Logiqical.boot().`);
  }

  private static resolveProvider(config: { network?: string; rpcUrl?: string }): { provider: JsonRpcProvider } {
    const networkKey = config.network ?? "avalanche";
    const chain = CHAINS[networkKey];
    if (!chain && !config.rpcUrl) {
      throw new Error(`Unknown network "${networkKey}". Use: ${Object.keys(CHAINS).join(", ")} — or provide rpcUrl.`);
    }
    const rpcUrl = config.rpcUrl ?? chain.rpcUrl;
    const chainId = chain?.chainId ?? undefined;
    return { provider: new JsonRpcProvider(rpcUrl, chainId) };
  }
}

/** @deprecated Use `Logiqical` instead */
export const LogiqicalClient = Logiqical;
