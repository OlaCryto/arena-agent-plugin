import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import {
  ARENA_TOKEN,
  WAVAX,
  ARENA_STAKING,
  LB_QUOTER,
  LB_ROUTER,
  ERC20_ABI,
  LB_QUOTER_ABI,
  LB_ROUTER_ABI,
  ARENA_STAKING_ABI,
  DEFAULT_SLIPPAGE_BPS,
  RPC_URL,
  LAUNCH_CONTRACT,
  TOKEN_MANAGER,
  AVAX_HELPER,
  LAUNCH_CONTRACT_ABI,
  TOKEN_MANAGER_ABI,
  AVAX_HELPER_ABI,
  ARENA_PAIRED_THRESHOLD,
  GRANULARITY_SCALER,
} from "./constants";

// ArenaRouter wrapper contract (deployed by you, collects 0.3% fee)
const ARENA_ROUTER = process.env.ARENA_ROUTER || "";

// Minimal ABI for the ArenaRouter wrapper contract
const ARENA_ROUTER_ABI = [
  "function buyArena(tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, uint256 amountOutMin, uint256 deadline) payable returns (uint256 arenaOut)",
  "function feeBps() view returns (uint256)",
];

export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gas?: string;
  gasLimit?: string;
  description: string;
}

export class TxBuilder {
  private provider: ethers.JsonRpcProvider;
  private arenaToken: ethers.Contract;
  private lbQuoter: ethers.Contract;
  private routerContract: ethers.Contract;
  private launchContract: ethers.Contract;
  private tokenManager: ethers.Contract;
  private avaxHelper: ethers.Contract;

  constructor(rpcUrl?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl || RPC_URL, undefined, { staticNetwork: true, batchMaxCount: 1 });
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, this.provider);
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, this.provider);
    this.launchContract = new ethers.Contract(ethers.getAddress(LAUNCH_CONTRACT), LAUNCH_CONTRACT_ABI, this.provider);
    this.tokenManager = new ethers.Contract(ethers.getAddress(TOKEN_MANAGER), TOKEN_MANAGER_ABI, this.provider);
    this.avaxHelper = new ethers.Contract(ethers.getAddress(AVAX_HELPER), AVAX_HELPER_ABI, this.provider);

    if (ARENA_ROUTER) {
      this.routerContract = new ethers.Contract(ethers.getAddress(ARENA_ROUTER), ARENA_ROUTER_ABI, this.provider);
    } else {
      this.routerContract = null as any;
    }
  }

  get routerAddress(): string {
    return ARENA_ROUTER;
  }

  /** Get a quote: how much ARENA for a given AVAX amount (buy) */
  async getQuote(avaxAmount: string): Promise<{ arenaOut: string; fee: string; netAvax: string }> {
    const amountIn = ethers.parseEther(avaxAmount);
    const fee = (amountIn * 30n) / 10000n; // 0.3%
    const netAmount = amountIn - fee;

    const route = [WAVAX, ARENA_TOKEN];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
    const arenaOut = quote.amounts[quote.amounts.length - 1];
    const decimals = await this.arenaToken.decimals();

    return {
      arenaOut: ethers.formatUnits(arenaOut, decimals),
      fee: ethers.formatEther(fee),
      netAvax: ethers.formatEther(netAmount),
    };
  }

  /** Get a sell quote: how much AVAX for a given ARENA amount */
  async getSellQuote(arenaAmount: string): Promise<{ avaxOut: string; arenaIn: string }> {
    const decimals = await this.arenaToken.decimals();
    const amountIn = ethers.parseUnits(arenaAmount, decimals);

    const route = [ARENA_TOKEN, WAVAX];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const avaxOut = quote.amounts[quote.amounts.length - 1];

    return {
      avaxOut: ethers.formatEther(avaxOut),
      arenaIn: arenaAmount,
    };
  }

  /** Get wallet balances */
  async getBalances(wallet: string): Promise<{ avax: string; arena: string }> {
    const [avax, arena] = await Promise.all([
      this.provider.getBalance(wallet),
      this.arenaToken.balanceOf(wallet),
    ]);
    const decimals = await this.arenaToken.decimals();
    return {
      avax: ethers.formatEther(avax),
      arena: ethers.formatUnits(arena, decimals),
    };
  }

  /** Get staking info for a wallet */
  async getStakeInfo(wallet: string): Promise<{ stakedAmount: string; pendingRewards: string }> {
    const staking = new ethers.Contract(ethers.getAddress(ARENA_STAKING), ARENA_STAKING_ABI, this.provider);
    const decimals = await this.arenaToken.decimals();
    const [stakedRaw] = await staking.getUserInfo(wallet, ethers.getAddress(ARENA_TOKEN));
    const pendingRaw = await staking.pendingReward(wallet, ethers.getAddress(ARENA_TOKEN));
    return {
      stakedAmount: ethers.formatUnits(stakedRaw, decimals),
      pendingRewards: ethers.formatUnits(pendingRaw, decimals),
    };
  }

  /**
   * Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee).
   */
  async buildBuyTx(
    wallet: string,
    avaxAmount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<UnsignedTx> {
    if (!ARENA_ROUTER) throw new Error("ARENA_ROUTER contract not configured");

    const amountIn = ethers.parseEther(avaxAmount);
    const fee = (amountIn * 30n) / 10000n;
    const netAmount = amountIn - fee;

    const route = [WAVAX, ARENA_TOKEN];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour for agents

    const path = {
      pairBinSteps: [...quote.binSteps].map((b: any) => b.toString()),
      versions: [...quote.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    const iface = new ethers.Interface(ARENA_ROUTER_ABI);
    const data = iface.encodeFunctionData("buyArena", [path, amountOutMin, deadline]);

    return {
      to: ethers.getAddress(ARENA_ROUTER),
      data,
      value: ethers.toBeHex(amountIn, 32),
      chainId: 43114,
      gas: "500000",
      gasLimit: "500000",
      description: `Buy ARENA with ${avaxAmount} AVAX (0.3% fee: ${ethers.formatEther(fee)} AVAX). IMPORTANT: Use gasLimit 500000 — default gas estimates are too low for DEX swaps.`,
    };
  }

  /**
   * Build unsigned txs to sell ARENA for AVAX via LFJ DEX: [approve, swap]
   */
  async buildSellArenaTx(
    wallet: string,
    arenaAmount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<UnsignedTx[]> {
    const decimals = await this.arenaToken.decimals();
    let sellAmount: bigint;

    if (arenaAmount === "max") {
      sellAmount = await this.arenaToken.balanceOf(wallet);
      if (sellAmount === 0n) throw new Error("No ARENA balance to sell");
    } else {
      sellAmount = ethers.parseUnits(arenaAmount, decimals);
    }

    // Get quote for ARENA → AVAX
    const route = [ARENA_TOKEN, WAVAX];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, sellAmount);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const path = {
      pairBinSteps: [...quote.binSteps].map((b: any) => b.toString()),
      versions: [...quote.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    // Tx 1: Approve ARENA to LB Router
    const approveIface = new ethers.Interface(ERC20_ABI);
    const approveData = approveIface.encodeFunctionData("approve", [
      ethers.getAddress(LB_ROUTER), sellAmount,
    ]);
    const approveTx: UnsignedTx = {
      to: ethers.getAddress(ARENA_TOKEN),
      data: approveData,
      value: "0",
      chainId: 43114,
      gas: "60000",
      gasLimit: "60000",
      description: `Approve ${ethers.formatUnits(sellAmount, decimals)} ARENA for swap`,
    };

    // Tx 2: Swap ARENA → AVAX via LFJ
    const swapIface = new ethers.Interface(LB_ROUTER_ABI);
    const swapData = swapIface.encodeFunctionData("swapExactTokensForNATIVE", [
      sellAmount, amountOutMin, path, wallet, deadline,
    ]);
    const swapTx: UnsignedTx = {
      to: ethers.getAddress(LB_ROUTER),
      data: swapData,
      value: "0",
      chainId: 43114,
      gas: "500000",
      gasLimit: "500000",
      description: `Sell ${ethers.formatUnits(sellAmount, decimals)} ARENA for ~${ethers.formatEther(expectedOut)} AVAX`,
    };

    return [approveTx, swapTx];
  }

  /**
   * Build unsigned tx to approve ARENA for staking.
   */
  async buildApproveStakingTx(wallet: string, amount: string): Promise<UnsignedTx> {
    const decimals = await this.arenaToken.decimals();
    let approveAmount: bigint;

    if (amount === "max") {
      approveAmount = await this.arenaToken.balanceOf(wallet);
    } else {
      approveAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData("approve", [ethers.getAddress(ARENA_STAKING), approveAmount]);

    return {
      to: ethers.getAddress(ARENA_TOKEN),
      data,
      value: "0",
      chainId: 43114,
      gas: "60000",
      gasLimit: "60000",
      description: `Approve ${ethers.formatUnits(approveAmount, decimals)} ARENA for staking`,
    };
  }

  /**
   * Build unsigned tx to stake ARENA.
   */
  async buildStakeTx(wallet: string, amount: string): Promise<UnsignedTx> {
    const decimals = await this.arenaToken.decimals();
    let stakeAmount: bigint;

    if (amount === "max") {
      stakeAmount = await this.arenaToken.balanceOf(wallet);
    } else {
      stakeAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ARENA_STAKING_ABI);
    const data = iface.encodeFunctionData("deposit", [stakeAmount]);

    return {
      to: ethers.getAddress(ARENA_STAKING),
      data,
      value: "0",
      chainId: 43114,
      gas: "300000",
      gasLimit: "300000",
      description: `Stake ${ethers.formatUnits(stakeAmount, decimals)} ARENA`,
    };
  }

  /**
   * Build unsigned tx to unstake ARENA.
   */
  async buildUnstakeTx(wallet: string, amount: string): Promise<UnsignedTx> {
    const decimals = await this.arenaToken.decimals();
    const staking = new ethers.Contract(ethers.getAddress(ARENA_STAKING), ARENA_STAKING_ABI, this.provider);
    let withdrawAmount: bigint;

    if (amount === "max") {
      const [stakedRaw] = await staking.getUserInfo(wallet, ethers.getAddress(ARENA_TOKEN));
      withdrawAmount = stakedRaw;
    } else {
      withdrawAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ARENA_STAKING_ABI);
    const data = iface.encodeFunctionData("withdraw", [withdrawAmount]);

    return {
      to: ethers.getAddress(ARENA_STAKING),
      data,
      value: "0",
      chainId: 43114,
      gas: "300000",
      gasLimit: "300000",
      description: `Unstake ${ethers.formatUnits(withdrawAmount, decimals)} ARENA`,
    };
  }

  /**
   * Build full buy-and-stake flow (3 transactions).
   */
  async buildBuyAndStakeTxs(
    wallet: string,
    avaxAmount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<UnsignedTx[]> {
    const buyTx = await this.buildBuyTx(wallet, avaxAmount, slippageBps);

    // Approve max uint256 so any amount received from buy can be staked
    const iface = new ethers.Interface(ERC20_ABI);
    const approveData = iface.encodeFunctionData("approve", [
      ethers.getAddress(ARENA_STAKING),
      ethers.MaxUint256,
    ]);
    const approveTx: UnsignedTx = {
      to: ethers.getAddress(ARENA_TOKEN),
      data: approveData,
      value: "0",
      chainId: 43114,
      description: "Approve ARENA for staking (unlimited)",
    };

    // Estimate ARENA output for the stake tx description
    const amountIn = ethers.parseEther(avaxAmount);
    const fee = (amountIn * 30n) / 10000n;
    const netAmount = amountIn - fee;
    const route = [WAVAX, ARENA_TOKEN];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    const decimals = await this.arenaToken.decimals();

    // Stake tx: use "max" to stake entire ARENA balance (agent must execute AFTER buy confirms)
    const stakingIface = new ethers.Interface(ARENA_STAKING_ABI);
    // We can't use "max" at build time since the buy hasn't happened yet,
    // so we use the estimated amount from the quote
    const stakeData = stakingIface.encodeFunctionData("deposit", [expectedOut]);
    const stakeTx: UnsignedTx = {
      to: ethers.getAddress(ARENA_STAKING),
      data: stakeData,
      value: "0",
      chainId: 43114,
      description: `Stake ~${ethers.formatUnits(expectedOut, decimals)} ARENA`,
    };

    return [
      { ...buyTx, description: `Step 1/3: ${buyTx.description}` },
      { ...approveTx, description: `Step 2/3: ${approveTx.description}` },
      { ...stakeTx, description: `Step 3/3: ${stakeTx.description}` },
    ];
  }

  /** Broadcast a signed transaction */
  async broadcast(signedTx: string): Promise<string> {
    const txResponse = await this.provider.broadcastTransaction(signedTx);
    const receipt = await txResponse.wait();
    if (receipt && receipt.status === 0) {
      throw new Error(`Transaction reverted on-chain: ${txResponse.hash}`);
    }
    return txResponse.hash;
  }

  // ─── Launchpad Helpers ───

  private isArenaPaired(tokenId: string): boolean {
    return BigInt(tokenId) >= ARENA_PAIRED_THRESHOLD;
  }

  private getContract(tokenId: string): ethers.Contract {
    return this.isArenaPaired(tokenId) ? this.tokenManager : this.launchContract;
  }

  /** Binary search: find max tokens purchasable with given AVAX budget (AVAX-paired only) */
  private async binarySearchTokenAmount(avaxBudgetWei: bigint, tokenId: bigint): Promise<bigint> {
    let maxForSale: bigint;
    try {
      maxForSale = await this.launchContract.getMaxTokensForSale(tokenId);
    } catch {
      maxForSale = 100_000_000n * GRANULARITY_SCALER;
    }
    const maxWhole = maxForSale / GRANULARITY_SCALER;
    if (maxWhole <= 0n) return 0n;

    let lo = 1n;
    let hi = maxWhole;
    let best = 0n;

    for (let i = 0; i < 30 && lo <= hi; i++) {
      const mid = (lo + hi) / 2n;
      try {
        const cost: bigint = await this.launchContract.calculateCostWithFees(mid, tokenId);
        if (cost <= avaxBudgetWei) {
          best = mid;
          lo = mid + 1n;
        } else {
          hi = mid - 1n;
        }
      } catch {
        hi = mid - 1n;
      }
    }

    return best > 0n ? best * GRANULARITY_SCALER : 0n;
  }

  // ─── Launchpad Read-Only Methods ───

  /** Get comprehensive token info by ID */
  async getTokenInfo(tokenId: string) {
    const contract = this.getContract(tokenId);
    const id = BigInt(tokenId);
    const arenaPaired = this.isArenaPaired(tokenId);

    const [params, supply, maxForSale] = await Promise.all([
      contract.getTokenParameters(id),
      contract.tokenSupply(id),
      contract.getMaxTokensForSale(id),
    ]);

    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    let name = "Unknown", symbol = "UNKNOWN";
    try {
      [name, symbol] = await Promise.all([token.name(), token.symbol()]);
    } catch {}

    // Price per token: calculateCostWithFees takes amount in WHOLE tokens (not wei)
    let priceAvax = "0";
    const graduated = params.lpDeployed;
    if (!graduated) {
      try {
        const costOf1: bigint = await contract.calculateCostWithFees(1n, id);
        priceAvax = ethers.formatEther(costOf1);
      } catch {}
    }

    // Amount sold on bonding curve:
    // tokenSupply = total minted (always 10B), NOT amount sold
    // saleAllocation = totalSupply * salePercentage / 100 (tokens available for curve sale)
    // amountSold = saleAllocation - maxForSale (remaining)
    const salePerc = BigInt(params.salePercentage);
    const saleAllocation = (supply * salePerc) / 100n;
    const amountSold = saleAllocation > maxForSale ? saleAllocation - maxForSale : 0n;

    // Market cap = amountSold * pricePerToken
    const soldWhole = Number(amountSold / GRANULARITY_SCALER);
    const priceNum = parseFloat(priceAvax);
    const marketCap = soldWhole * priceNum;

    // Graduation progress = amountSold / saleAllocation * 100
    const graduationProgress = saleAllocation > 0n
      ? Number((amountSold * 10000n) / saleAllocation) / 100
      : 0;

    return {
      tokenId,
      type: arenaPaired ? "ARENA-paired" : "AVAX-paired",
      name,
      symbol,
      tokenAddress,
      creator: params.creatorAddress,
      priceAvax,
      marketCapAvax: marketCap.toFixed(4),
      graduationProgress: `${graduationProgress.toFixed(2)}%`,
      graduated,
      amountSold: ethers.formatUnits(amountSold, 18),
      totalSupply: ethers.formatUnits(supply, 18),
      saleAllocation: ethers.formatUnits(saleAllocation, 18),
      remainingForSale: ethers.formatUnits(maxForSale, 18),
      curveParams: {
        a: params.a.toString(),
        b: params.b.toString(),
        curveScaler: params.curveScaler.toString(),
      },
      creatorFeeBps: params.creatorFeeBasisPoints.toString(),
      lpPercentage: params.lpPercentage.toString(),
      salePercentage: params.salePercentage.toString(),
    };
  }

  /** Get smart quote for buying or selling a launchpad token */
  async getTokenQuote(tokenId: string, amount: string, side: "buy" | "sell") {
    const contract = this.getContract(tokenId);
    const id = BigInt(tokenId);
    const arenaPaired = this.isArenaPaired(tokenId);

    if (side === "buy") {
      const avaxWei = ethers.parseEther(amount);
      if (!arenaPaired) {
        // AVAX-paired: binary search for exact token amount
        const tokenAmountWei = await this.binarySearchTokenAmount(avaxWei, id);
        if (tokenAmountWei === 0n) return { tokenId, side, avaxIn: amount, tokensOut: "0", note: "Insufficient liquidity or token sold out" };
        const exactCost: bigint = await this.launchContract.calculateCostWithFees(tokenAmountWei / GRANULARITY_SCALER, id);
        return {
          tokenId, side,
          avaxIn: ethers.formatEther(exactCost),
          tokensOut: ethers.formatUnits(tokenAmountWei, 18),
        };
      } else {
        // ARENA-paired: helper auto-converts AVAX→ARENA→tokens, exact output at execution
        return {
          tokenId, side,
          avaxIn: amount,
          tokensOut: "determined at execution (ARENA-paired, helper converts automatically)",
        };
      }
    } else {
      // Sell: calculate AVAX/ARENA reward
      const tokenAmountWei = ethers.parseUnits(amount, 18);
      const reward: bigint = await contract.calculateRewardWithFees(tokenAmountWei, id);
      return {
        tokenId, side,
        tokenAmount: amount,
        rewardAvax: arenaPaired ? undefined : ethers.formatEther(reward),
        rewardArena: arenaPaired ? ethers.formatUnits(reward, 18) : undefined,
        note: arenaPaired ? "Reward is in ARENA. Use AVAX Helper to convert to AVAX." : undefined,
      };
    }
  }

  /** Get launchpad token balance for a wallet */
  async getTokenBalance(wallet: string, tokenId: string) {
    const contract = this.getContract(tokenId);
    const params = await contract.getTokenParameters(BigInt(tokenId));
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance: bigint = await token.balanceOf(wallet);
    return {
      wallet,
      tokenId,
      tokenAddress,
      balance: ethers.formatUnits(balance, 18),
    };
  }

  /** Get recent token launches */
  async getRecentLaunches(count = 10, type: "all" | "avax" | "arena" = "all") {
    const results: any[] = [];
    const fetchToken = async (id: bigint, contract: ethers.Contract, pairType: string) => {
      try {
        const params = await contract.getTokenParameters(id);
        if (params.tokenContractAddress === ethers.ZeroAddress) return null;
        const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, this.provider);
        let name = "Unknown", symbol = "UNKNOWN";
        try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}
        const supply: bigint = await contract.tokenSupply(id);
        const maxForSale: bigint = await contract.getMaxTokensForSale(id);
        const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
        const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
        const gradProgress = saleAlloc > 0n ? Number((sold * 10000n) / saleAlloc) / 100 : 0;
        return {
          tokenId: id.toString(),
          type: pairType,
          name, symbol,
          tokenAddress: params.tokenContractAddress,
          creator: params.creatorAddress,
          graduated: params.lpDeployed,
          graduationProgress: `${gradProgress.toFixed(2)}%`,
          amountSold: ethers.formatUnits(sold, 18),
        };
      } catch { return null; }
    };

    if (type === "all" || type === "avax") {
      const latestAvax: bigint = await this.launchContract.tokenIdentifier();
      const avaxCount = type === "all" ? Math.ceil(count / 2) : count;
      const avaxPromises = [];
      for (let i = 0; i < avaxCount && latestAvax - BigInt(i) > 0n; i++) {
        avaxPromises.push(fetchToken(latestAvax - BigInt(i) - 1n, this.launchContract, "AVAX-paired"));
      }
      results.push(...(await Promise.all(avaxPromises)).filter(Boolean));
    }

    if (type === "all" || type === "arena") {
      const latestArena: bigint = await this.tokenManager.tokenIdentifier();
      const arenaCount = type === "all" ? Math.ceil(count / 2) : count;
      const arenaPromises = [];
      for (let i = 0; i < arenaCount && latestArena - BigInt(i) >= ARENA_PAIRED_THRESHOLD; i++) {
        arenaPromises.push(fetchToken(latestArena - BigInt(i) - 1n, this.tokenManager, "ARENA-paired"));
      }
      results.push(...(await Promise.all(arenaPromises)).filter(Boolean));
    }

    return results.slice(0, count);
  }

  /** Search for a token by contract address */
  async searchToken(query: string) {
    // Search by contract address across both contracts
    const searchContract = async (contract: ethers.Contract, label: string) => {
      const latest: bigint = await contract.tokenIdentifier();
      const start = label === "ARENA-paired" ? ARENA_PAIRED_THRESHOLD : 1n;
      // Search last 200 tokens
      for (let id = latest - 1n; id >= start && id >= latest - 200n; id--) {
        try {
          const params = await contract.getTokenParameters(id);
          if (params.tokenContractAddress.toLowerCase() === query.toLowerCase()) {
            return id.toString();
          }
        } catch { continue; }
      }
      return null;
    };

    const [avaxResult, arenaResult] = await Promise.all([
      searchContract(this.launchContract, "AVAX-paired"),
      searchContract(this.tokenManager, "ARENA-paired"),
    ]);

    const foundId = avaxResult || arenaResult;
    if (!foundId) throw new Error(`Token not found for address ${query} in recent launches`);
    return this.getTokenInfo(foundId);
  }

  /** Get tokens closest to graduating (deploying LP) */
  async getGraduating(count = 5) {
    const candidates: { tokenId: string; progress: number; info: any }[] = [];

    const checkBatch = async (contract: ethers.Contract, label: string) => {
      const latest: bigint = await contract.tokenIdentifier();
      const start = label === "ARENA-paired" ? ARENA_PAIRED_THRESHOLD : 1n;
      const promises = [];
      for (let i = 0; i < 100 && latest - BigInt(i) - 1n >= start; i++) {
        const id = latest - BigInt(i) - 1n;
        promises.push((async () => {
          try {
            const params = await contract.getTokenParameters(id);
            if (params.lpDeployed) return null;
            const supply: bigint = await contract.tokenSupply(id);
            const maxForSale: bigint = await contract.getMaxTokensForSale(id);
            const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
            if (saleAlloc === 0n) return null;
            const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
            const progress = Number((sold * 10000n) / saleAlloc) / 100;
            if (progress < 0.5) return null; // skip near-empty tokens
            const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, this.provider);
            let name = "Unknown", symbol = "UNKNOWN";
            try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}
            return { tokenId: id.toString(), progress, info: { name, symbol, type: label, tokenAddress: params.tokenContractAddress, graduationProgress: `${progress.toFixed(2)}%`, amountSold: ethers.formatUnits(sold, 18) } };
          } catch { return null; }
        })());
      }
      return (await Promise.all(promises)).filter(Boolean) as typeof candidates;
    };

    const [avax, arena] = await Promise.all([
      checkBatch(this.launchContract, "AVAX-paired"),
      checkBatch(this.tokenManager, "ARENA-paired"),
    ]);

    candidates.push(...avax, ...arena);
    candidates.sort((a, b) => b.progress - a.progress);
    return candidates.slice(0, count).map(c => ({ ...c.info, tokenId: c.tokenId }));
  }

  /** Get agent's portfolio (tracked positions) */
  async getPortfolio(wallet: string, tokenIds: number[]) {
    if (tokenIds.length === 0) return { wallet, positions: [], totalValueAvax: "0" };

    const positions: any[] = [];
    let totalValue = 0;

    const checks = tokenIds.map(async (tid) => {
      try {
        const tokenId = tid.toString();
        const contract = this.getContract(tokenId);
        const params = await contract.getTokenParameters(BigInt(tokenId));
        if (params.tokenContractAddress === ethers.ZeroAddress) return null;

        const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, this.provider);
        const balance: bigint = await token.balanceOf(wallet);
        if (balance === 0n) return null;

        let name = "Unknown", symbol = "UNKNOWN";
        try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}

        let valueAvax = "0";
        if (!params.lpDeployed) {
          try {
            const reward: bigint = await contract.calculateRewardWithFees(balance, BigInt(tokenId));
            valueAvax = ethers.formatEther(reward);
          } catch {}
        }

        return {
          tokenId, name, symbol,
          tokenAddress: params.tokenContractAddress,
          balance: ethers.formatUnits(balance, 18),
          valueAvax,
          graduated: params.lpDeployed,
        };
      } catch { return null; }
    });

    const results = (await Promise.all(checks)).filter(Boolean);
    for (const pos of results) {
      positions.push(pos);
      totalValue += parseFloat(pos!.valueAvax);
    }

    return { wallet, positions, totalValueAvax: totalValue.toFixed(6) };
  }

  /** Get recent Buy/Sell activity for a token */
  async getActivity(tokenId: string, count = 20) {
    const contract = this.getContract(tokenId);
    const id = BigInt(tokenId);
    const currentBlock = await this.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);

    const [buyEvents, sellEvents] = await Promise.all([
      contract.queryFilter(contract.filters.Buy(null, id), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.Sell(null, id), fromBlock, currentBlock),
    ]);

    const arenaPaired = this.isArenaPaired(tokenId);
    const formatAmount = (v: bigint) => arenaPaired ? ethers.formatUnits(v, 18) : ethers.formatEther(v);

    const events = [
      ...buyEvents.map((e: any) => ({
        type: "buy",
        user: e.args.user,
        tokenAmount: ethers.formatUnits(e.args.tokenAmount, 18),
        cost: formatAmount(e.args.cost),
        block: e.blockNumber,
      })),
      ...sellEvents.map((e: any) => ({
        type: "sell",
        user: e.args.user,
        tokenAmount: ethers.formatUnits(e.args.tokenAmount, 18),
        reward: formatAmount(e.args.reward),
        block: e.blockNumber,
      })),
    ];

    events.sort((a, b) => b.block - a.block);
    return { tokenId, events: events.slice(0, count) };
  }

  /** Get platform overview */
  async getOverview() {
    const [avaxLatest, arenaLatest, protocolFeeAvax, protocolFeeArena] = await Promise.all([
      this.launchContract.tokenIdentifier(),
      this.tokenManager.tokenIdentifier(),
      this.launchContract.protocolFeeBasisPoint(),
      this.tokenManager.protocolFeeBasisPoint(),
    ]);

    return {
      totalAvaxPairedTokens: (avaxLatest - 1n).toString(),
      totalArenaPairedTokens: (arenaLatest - ARENA_PAIRED_THRESHOLD).toString(),
      totalTokens: ((avaxLatest - 1n) + (arenaLatest - ARENA_PAIRED_THRESHOLD)).toString(),
      protocolFeeBps: {
        avaxPaired: protocolFeeAvax.toString(),
        arenaPaired: protocolFeeArena.toString(),
      },
      contracts: {
        launchContract: LAUNCH_CONTRACT,
        tokenManager: TOKEN_MANAGER,
        avaxHelper: AVAX_HELPER,
      },
    };
  }

  /** Get market cap for a token */
  async getMarketCap(tokenId: string) {
    const info = await this.getTokenInfo(tokenId);
    return {
      tokenId,
      name: info.name,
      symbol: info.symbol,
      priceAvax: info.priceAvax,
      marketCapAvax: info.marketCapAvax,
      amountSold: info.amountSold,
      graduated: info.graduated,
      graduationProgress: info.graduationProgress,
    };
  }

  // ─── Launchpad Transaction Builders ───

  /** Build unsigned tx to buy a launchpad token */
  async buildLaunchpadBuyTx(
    wallet: string,
    tokenId: string,
    avaxAmount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<UnsignedTx> {
    const id = BigInt(tokenId);
    const avaxWei = ethers.parseEther(avaxAmount);
    const arenaPaired = this.isArenaPaired(tokenId);
    const contract = this.getContract(tokenId);

    // Guard: check if graduated
    const params = await contract.getTokenParameters(id);
    if (params.lpDeployed) throw new Error("Token has graduated to DEX — trade on a DEX instead");

    if (!arenaPaired) {
      // AVAX-paired: binary search for token amount, then buyAndCreateLpIfPossible
      const tokenAmountWei = await this.binarySearchTokenAmount(avaxWei, id);
      if (tokenAmountWei === 0n) throw new Error("Cannot calculate buy amount — token may be sold out");

      const iface = new ethers.Interface(LAUNCH_CONTRACT_ABI);
      const data = iface.encodeFunctionData("buyAndCreateLpIfPossible", [tokenAmountWei, id]);

      return {
        to: ethers.getAddress(LAUNCH_CONTRACT),
        data,
        value: ethers.toBeHex(avaxWei, 32),
        chainId: 43114,
        gas: "500000",
        gasLimit: "500000",
        description: `Buy ~${ethers.formatUnits(tokenAmountWei, 18)} tokens (ID ${tokenId}) with ${avaxAmount} AVAX`,
      };
    } else {
      // ARENA-paired: use AVAX Helper (auto-converts AVAX→ARENA→tokens)
      const iface = new ethers.Interface(AVAX_HELPER_ABI);
      const data = iface.encodeFunctionData("buyAndCreateLpIfPossibleWithAvax", [id, 0n]);

      return {
        to: ethers.getAddress(AVAX_HELPER),
        data,
        value: ethers.toBeHex(avaxWei, 32),
        chainId: 43114,
        gas: "500000",
        gasLimit: "500000",
        description: `Buy tokens (ID ${tokenId}) with ${avaxAmount} AVAX via ARENA Helper`,
      };
    }
  }

  /** Build unsigned txs to sell a launchpad token: [approve, sell] */
  async buildLaunchpadSellTx(
    wallet: string,
    tokenId: string,
    amount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<UnsignedTx[]> {
    const id = BigInt(tokenId);
    const arenaPaired = this.isArenaPaired(tokenId);
    const contract = this.getContract(tokenId);

    const params = await contract.getTokenParameters(id);
    if (params.lpDeployed) throw new Error("Token has graduated to DEX — trade on a DEX instead");
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

    // Determine sell amount
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    let sellAmount: bigint;
    if (amount === "max") {
      sellAmount = await token.balanceOf(wallet);
    } else {
      sellAmount = ethers.parseUnits(amount, 18);
    }
    if (sellAmount === 0n) throw new Error("Zero balance — nothing to sell");

    // Align to granularity for AVAX-paired
    if (!arenaPaired) {
      sellAmount = (sellAmount / GRANULARITY_SCALER) * GRANULARITY_SCALER;
      if (sellAmount === 0n) throw new Error("Balance too small to sell (must be at least 1 whole token unit)");
    }

    // Determine spender
    const spender = arenaPaired ? ethers.getAddress(AVAX_HELPER) : ethers.getAddress(LAUNCH_CONTRACT);

    // Approve tx
    const erc20Iface = new ethers.Interface(ERC20_ABI);
    const approveData = erc20Iface.encodeFunctionData("approve", [spender, ethers.MaxUint256]);
    const approveTx: UnsignedTx = {
      to: tokenAddress,
      data: approveData,
      value: "0",
      chainId: 43114,
      gas: "60000",
      gasLimit: "60000",
      description: `Step 1/2: Approve token for selling`,
    };

    // Sell tx
    let sellData: string;
    let sellTo: string;
    if (!arenaPaired) {
      const iface = new ethers.Interface(LAUNCH_CONTRACT_ABI);
      sellData = iface.encodeFunctionData("sell", [sellAmount, id]);
      sellTo = ethers.getAddress(LAUNCH_CONTRACT);
    } else {
      // Calculate minAvaxOut with slippage
      let minOut = 0n;
      try {
        const reward: bigint = await contract.calculateRewardWithFees(sellAmount, id);
        minOut = reward - (reward * BigInt(slippageBps)) / 10000n;
      } catch {}
      const iface = new ethers.Interface(AVAX_HELPER_ABI);
      sellData = iface.encodeFunctionData("sellToAvax", [id, sellAmount, minOut]);
      sellTo = ethers.getAddress(AVAX_HELPER);
    }

    const sellTx: UnsignedTx = {
      to: sellTo,
      data: sellData,
      value: "0",
      chainId: 43114,
      gas: "500000",
      gasLimit: "500000",
      description: `Step 2/2: Sell ${ethers.formatUnits(sellAmount, 18)} tokens (ID ${tokenId})`,
    };

    return [approveTx, sellTx];
  }
}
