import {
  Wallet,
  JsonRpcProvider,
  type TransactionRequest,
  type TransactionResponse,
} from "ethers";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── Chain Registry ──

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorer?: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  avalanche: {
    chainId: 43114,
    name: "Avalanche C-Chain",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    blockExplorer: "https://snowtrace.io",
  },
  fuji: {
    chainId: 43113,
    name: "Avalanche Fuji Testnet",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    blockExplorer: "https://testnet.snowtrace.io",
  },
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://eth.llamarpc.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://etherscan.io",
  },
  base: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://basescan.org",
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://arbiscan.io",
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://optimistic.etherscan.io",
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorer: "https://polygonscan.com",
  },
  bsc: {
    chainId: 56,
    name: "BNB Smart Chain",
    rpcUrl: "https://bsc-dataseed.binance.org",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorer: "https://bscscan.com",
  },
  fantom: {
    chainId: 250,
    name: "Fantom Opera",
    rpcUrl: "https://rpc.ftm.tools",
    nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
    blockExplorer: "https://ftmscan.com",
  },
  gnosis: {
    chainId: 100,
    name: "Gnosis Chain",
    rpcUrl: "https://rpc.gnosischain.com",
    nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
    blockExplorer: "https://gnosisscan.io",
  },
  zksync: {
    chainId: 324,
    name: "zkSync Era",
    rpcUrl: "https://mainnet.era.zksync.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://explorer.zksync.io",
  },
  linea: {
    chainId: 59144,
    name: "Linea",
    rpcUrl: "https://rpc.linea.build",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://lineascan.build",
  },
  scroll: {
    chainId: 534352,
    name: "Scroll",
    rpcUrl: "https://rpc.scroll.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://scrollscan.com",
  },
  blast: {
    chainId: 81457,
    name: "Blast",
    rpcUrl: "https://rpc.blast.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://blastscan.io",
  },
  mantle: {
    chainId: 5000,
    name: "Mantle",
    rpcUrl: "https://rpc.mantle.xyz",
    nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
    blockExplorer: "https://mantlescan.xyz",
  },
  celo: {
    chainId: 42220,
    name: "Celo",
    rpcUrl: "https://forno.celo.org",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    blockExplorer: "https://celoscan.io",
  },
  moonbeam: {
    chainId: 1284,
    name: "Moonbeam",
    rpcUrl: "https://rpc.api.moonbeam.network",
    nativeCurrency: { name: "GLMR", symbol: "GLMR", decimals: 18 },
    blockExplorer: "https://moonscan.io",
  },
  sei: {
    chainId: 1329,
    name: "Sei",
    rpcUrl: "https://evm-rpc.sei-apis.com",
    nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
    blockExplorer: "https://seitrace.com",
  },
  mode: {
    chainId: 34443,
    name: "Mode",
    rpcUrl: "https://mainnet.mode.network",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://explorer.mode.network",
  },
  aurora: {
    chainId: 1313161554,
    name: "Aurora",
    rpcUrl: "https://mainnet.aurora.dev",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://explorer.aurora.dev",
  },
};

// ── Keystore ──

const KEYSTORE_DIR = join(homedir(), ".logiqical", "keys");

export interface KeystoreData {
  address: string;
  encryptedJson: string;
  network: string;
  createdAt: string;
}

function ensureKeystoreDir(): void {
  if (!existsSync(KEYSTORE_DIR)) {
    mkdirSync(KEYSTORE_DIR, { recursive: true });
  }
}

// ── Agent Wallet ──

export interface AgentWalletConfig {
  /** Network name from CHAINS registry, or a custom RPC URL */
  network?: string;
  /** Custom RPC URL (overrides network preset) */
  rpcUrl?: string;
  /** Private key to import (0x-prefixed hex) */
  privateKey?: string;
  /** Password for keystore encryption/decryption */
  password?: string;
  /** Keystore file name (default: "agent") */
  keystoreName?: string;
}

export class AgentWallet {
  readonly wallet: Wallet;
  readonly provider: JsonRpcProvider;
  readonly chain: ChainConfig;
  readonly address: string;

  private constructor(wallet: Wallet, provider: JsonRpcProvider, chain: ChainConfig) {
    this.wallet = wallet;
    this.provider = provider;
    this.chain = chain;
    this.address = wallet.address;
  }

  /** The private key (use carefully) */
  get privateKey(): string {
    return this.wallet.privateKey;
  }

  // ── Factory Methods ──

  /** Generate a brand new wallet with a random private key */
  static generate(config: AgentWalletConfig = {}): AgentWallet {
    const { provider, chain } = AgentWallet.resolveProvider(config);
    const hdWallet = Wallet.createRandom();
    const wallet = new Wallet(hdWallet.privateKey, provider);
    return new AgentWallet(wallet, provider, chain);
  }

  /** Import an existing wallet from a private key */
  static fromPrivateKey(privateKey: string, config: AgentWalletConfig = {}): AgentWallet {
    const { provider, chain } = AgentWallet.resolveProvider(config);
    const wallet = new Wallet(privateKey, provider);
    return new AgentWallet(wallet, provider, chain);
  }

  /** Boot from encrypted keystore, or generate + save if none exists */
  static async boot(config: AgentWalletConfig = {}): Promise<AgentWallet> {
    const password = config.password ?? "logiqical-agent";
    const name = config.keystoreName ?? "agent";
    const keystorePath = join(KEYSTORE_DIR, `${name}.json`);

    const { provider, chain } = AgentWallet.resolveProvider(config);

    if (existsSync(keystorePath)) {
      const data: KeystoreData = JSON.parse(readFileSync(keystorePath, "utf-8"));
      const decrypted = await Wallet.fromEncryptedJson(data.encryptedJson, password);
      const connected = new Wallet(decrypted.privateKey, provider);
      return new AgentWallet(connected, provider, chain);
    }

    // Generate new wallet and save to keystore
    const hdWallet = Wallet.createRandom();
    const wallet = new Wallet(hdWallet.privateKey, provider);
    const agentWallet = new AgentWallet(wallet, provider, chain);
    await agentWallet.saveKeystore(password, name);
    return agentWallet;
  }

  // ── Keystore Operations ──

  /** Encrypt and save the wallet to the keystore directory */
  async saveKeystore(password?: string, name?: string): Promise<string> {
    const pw = password ?? "logiqical-agent";
    const n = name ?? "agent";
    ensureKeystoreDir();
    const encryptedJson = await this.wallet.encrypt(pw);
    const data: KeystoreData = {
      address: this.address,
      encryptedJson,
      network: this.chain.name,
      createdAt: new Date().toISOString(),
    };
    const keystorePath = join(KEYSTORE_DIR, `${n}.json`);
    writeFileSync(keystorePath, JSON.stringify(data, null, 2));
    return keystorePath;
  }

  // ── Core Operations ──

  /** Get native token balance (formatted) */
  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.address);
    const { formatEther } = await import("ethers");
    return formatEther(balance);
  }

  /** Get balance of any address */
  async getBalanceOf(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    const { formatEther } = await import("ethers");
    return formatEther(balance);
  }

  /** Sign a message */
  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }

  /** Sign typed data (EIP-712) */
  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    return this.wallet.signTypedData(domain, types, value);
  }

  /** Sign a transaction without broadcasting */
  async signTransaction(tx: TransactionRequest): Promise<string> {
    return this.wallet.signTransaction(tx);
  }

  /** Sign and broadcast a transaction */
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    return this.wallet.sendTransaction(tx);
  }

  /** Send native token to an address */
  async send(to: string, amount: string): Promise<TransactionResponse> {
    const { parseEther } = await import("ethers");
    return this.wallet.sendTransaction({
      to,
      value: parseEther(amount),
    });
  }

  /**
   * Sign and broadcast an unsigned tx object returned by the Logiqical API.
   * Handles the { to, data, value, chainId, gas/gasLimit } format.
   */
  async signAndBroadcast(unsignedTx: {
    to: string;
    data: string;
    value: string;
    chainId?: number;
    gas?: string;
    gasLimit?: string;
  }): Promise<TransactionResponse> {
    const tx: TransactionRequest = {
      to: unsignedTx.to,
      data: unsignedTx.data,
      value: unsignedTx.value,
    };
    if (unsignedTx.gasLimit || unsignedTx.gas) {
      tx.gasLimit = unsignedTx.gasLimit || unsignedTx.gas;
    }
    return this.wallet.sendTransaction(tx);
  }

  /**
   * Sign and broadcast multiple unsigned txs in sequence.
   * Waits for each to confirm before sending the next.
   */
  async signAndBroadcastAll(
    unsignedTxs: Array<{ to: string; data: string; value: string; chainId?: number; gas?: string; gasLimit?: string }>,
    confirmations = 1,
  ): Promise<TransactionResponse[]> {
    const results: TransactionResponse[] = [];
    for (const utx of unsignedTxs) {
      const txResponse = await this.signAndBroadcast(utx);
      await txResponse.wait(confirmations);
      results.push(txResponse);
    }
    return results;
  }

  /** Call a read-only contract method (no gas, no signing) */
  async call(tx: TransactionRequest): Promise<string> {
    return this.provider.call(tx);
  }

  /** Switch to a different network (returns new AgentWallet instance) */
  switchNetwork(network: string): AgentWallet {
    const { provider, chain } = AgentWallet.resolveProvider({ network });
    const wallet = new Wallet(this.privateKey, provider);
    return new AgentWallet(wallet, provider, chain);
  }

  // ── Internal ──

  private static resolveProvider(config: AgentWalletConfig): { provider: JsonRpcProvider; chain: ChainConfig } {
    const networkKey = config.network ?? "avalanche";
    const chain = CHAINS[networkKey];

    if (!chain && !config.rpcUrl) {
      throw new Error(`Unknown network "${networkKey}". Use a known chain (${Object.keys(CHAINS).join(", ")}) or provide rpcUrl.`);
    }

    const rpcUrl = config.rpcUrl ?? chain.rpcUrl;
    const resolvedChain = chain ?? {
      chainId: 0,
      name: networkKey,
      rpcUrl,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    };

    const provider = new JsonRpcProvider(rpcUrl, resolvedChain.chainId || undefined);
    return { provider, chain: resolvedChain };
  }
}
