import { ethers, type JsonRpcProvider } from "ethers";
import {
  LAUNCH_CONTRACT, TOKEN_MANAGER, AVAX_HELPER,
  LAUNCH_CONTRACT_ABI, TOKEN_MANAGER_ABI, AVAX_HELPER_ABI,
  ERC20_ABI, ARENA_PAIRED_THRESHOLD, GRANULARITY_SCALER,
  DEFAULT_SLIPPAGE_BPS, CHAIN_ID,
} from "../constants.js";
import type { UnsignedTx } from "../types.js";

export class LaunchpadModule {
  private launchContract: ethers.Contract;
  private tokenManager: ethers.Contract;
  private avaxHelper: ethers.Contract;

  constructor(private provider: JsonRpcProvider) {
    this.launchContract = new ethers.Contract(ethers.getAddress(LAUNCH_CONTRACT), LAUNCH_CONTRACT_ABI, provider);
    this.tokenManager = new ethers.Contract(ethers.getAddress(TOKEN_MANAGER), TOKEN_MANAGER_ABI, provider);
    this.avaxHelper = new ethers.Contract(ethers.getAddress(AVAX_HELPER), AVAX_HELPER_ABI, provider);
  }

  private isArenaPaired(tokenId: string): boolean { return BigInt(tokenId) >= ARENA_PAIRED_THRESHOLD; }
  private getContract(tokenId: string): ethers.Contract { return this.isArenaPaired(tokenId) ? this.tokenManager : this.launchContract; }

  /** Get platform overview — total tokens, fees, contract addresses */
  async getOverview() {
    const [avaxLatest, arenaLatest, protocolFeeAvax, protocolFeeArena] = await Promise.all([
      this.launchContract.tokenIdentifier(), this.tokenManager.tokenIdentifier(),
      this.launchContract.protocolFeeBasisPoint(), this.tokenManager.protocolFeeBasisPoint(),
    ]);
    return {
      totalAvaxPairedTokens: (avaxLatest - 1n).toString(),
      totalArenaPairedTokens: (arenaLatest - ARENA_PAIRED_THRESHOLD).toString(),
      totalTokens: ((avaxLatest - 1n) + (arenaLatest - ARENA_PAIRED_THRESHOLD)).toString(),
      protocolFeeBps: { avaxPaired: protocolFeeAvax.toString(), arenaPaired: protocolFeeArena.toString() },
      contracts: { launchContract: LAUNCH_CONTRACT, tokenManager: TOKEN_MANAGER, avaxHelper: AVAX_HELPER },
    };
  }

  /** Get full token info by ID */
  async getToken(tokenId: string) {
    const contract = this.getContract(tokenId);
    const id = BigInt(tokenId);
    const [params, supply, maxForSale] = await Promise.all([
      contract.getTokenParameters(id), contract.tokenSupply(id), contract.getMaxTokensForSale(id),
    ]);
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    let name = "Unknown", symbol = "UNKNOWN";
    try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}

    let priceAvax = "0";
    if (!params.lpDeployed) { try { const cost: bigint = await contract.calculateCostWithFees(1n, id); priceAvax = ethers.formatEther(cost); } catch {} }

    const salePerc = BigInt(params.salePercentage);
    const saleAllocation = (supply * salePerc) / 100n;
    const amountSold = saleAllocation > maxForSale ? saleAllocation - maxForSale : 0n;
    const graduationProgress = saleAllocation > 0n ? Number((amountSold * 10000n) / saleAllocation) / 100 : 0;

    return {
      tokenId, type: this.isArenaPaired(tokenId) ? "ARENA-paired" : "AVAX-paired",
      name, symbol, tokenAddress, creator: params.creatorAddress, priceAvax,
      graduationProgress: `${graduationProgress.toFixed(2)}%`, graduated: params.lpDeployed,
      amountSold: ethers.formatUnits(amountSold, 18), totalSupply: ethers.formatUnits(supply, 18),
      remainingForSale: ethers.formatUnits(maxForSale, 18),
    };
  }

  /** Get a buy or sell quote */
  async quote(tokenId: string, side: "buy" | "sell", amount: string) {
    const contract = this.getContract(tokenId);
    const id = BigInt(tokenId);
    if (side === "buy") {
      const avaxWei = ethers.parseEther(amount);
      if (!this.isArenaPaired(tokenId)) {
        const tokenAmountWei = await this.binarySearchTokenAmount(avaxWei, id);
        if (tokenAmountWei === 0n) return { tokenId, side, avaxIn: amount, tokensOut: "0", note: "Insufficient liquidity" };
        const exactCost: bigint = await this.launchContract.calculateCostWithFees(tokenAmountWei / GRANULARITY_SCALER, id);
        return { tokenId, side, avaxIn: ethers.formatEther(exactCost), tokensOut: ethers.formatUnits(tokenAmountWei, 18) };
      }
      return { tokenId, side, avaxIn: amount, tokensOut: "determined at execution (ARENA-paired)" };
    }
    const tokenAmountWei = ethers.parseUnits(amount, 18);
    const reward: bigint = await contract.calculateRewardWithFees(tokenAmountWei, id);
    return {
      tokenId, side, tokenAmount: amount,
      rewardAvax: this.isArenaPaired(tokenId) ? undefined : ethers.formatEther(reward),
      rewardArena: this.isArenaPaired(tokenId) ? ethers.formatUnits(reward, 18) : undefined,
    };
  }

  /** Get recent token launches */
  async getRecent(count = 10) {
    const results: any[] = [];
    const fetchToken = async (id: bigint, contract: ethers.Contract, pairType: string) => {
      try {
        const params = await contract.getTokenParameters(id);
        if (params.tokenContractAddress === ethers.ZeroAddress) return null;
        const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, this.provider);
        let name = "Unknown", symbol = "UNKNOWN";
        try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}
        return { tokenId: id.toString(), type: pairType, name, symbol, tokenAddress: params.tokenContractAddress, graduated: params.lpDeployed };
      } catch { return null; }
    };
    const latestAvax: bigint = await this.launchContract.tokenIdentifier();
    const avaxPromises = [];
    for (let i = 0; i < Math.ceil(count / 2) && latestAvax - BigInt(i) > 0n; i++) {
      avaxPromises.push(fetchToken(latestAvax - BigInt(i) - 1n, this.launchContract, "AVAX-paired"));
    }
    const latestArena: bigint = await this.tokenManager.tokenIdentifier();
    const arenaPromises = [];
    for (let i = 0; i < Math.ceil(count / 2) && latestArena - BigInt(i) >= ARENA_PAIRED_THRESHOLD; i++) {
      arenaPromises.push(fetchToken(latestArena - BigInt(i) - 1n, this.tokenManager, "ARENA-paired"));
    }
    results.push(...(await Promise.all([...avaxPromises, ...arenaPromises])).filter(Boolean));
    return { count: results.length, tokens: results.slice(0, count) };
  }

  /** Build unsigned tx to buy a launchpad token */
  async buildBuy(wallet: string, tokenId: string, avax: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<{ transactions: UnsignedTx[] }> {
    const id = BigInt(tokenId);
    const avaxWei = ethers.parseEther(avax);
    const contract = this.getContract(tokenId);
    const params = await contract.getTokenParameters(id);
    if (params.lpDeployed) throw new Error("Token graduated to DEX — use dex.buildSwap() instead");

    if (!this.isArenaPaired(tokenId)) {
      const tokenAmountWei = await this.binarySearchTokenAmount(avaxWei, id);
      if (tokenAmountWei === 0n) throw new Error("Cannot calculate buy amount — token may be sold out");
      const iface = new ethers.Interface(LAUNCH_CONTRACT_ABI);
      const data = iface.encodeFunctionData("buyAndCreateLpIfPossible", [tokenAmountWei, id]);
      return { transactions: [{ to: ethers.getAddress(LAUNCH_CONTRACT), data, value: ethers.toBeHex(avaxWei, 32), chainId: CHAIN_ID, gasLimit: "500000", description: `Buy ~${ethers.formatUnits(tokenAmountWei, 18)} tokens (ID ${tokenId})` }] };
    }
    const iface = new ethers.Interface(AVAX_HELPER_ABI);
    const data = iface.encodeFunctionData("buyAndCreateLpIfPossibleWithAvax", [id, 0n]);
    return { transactions: [{ to: ethers.getAddress(AVAX_HELPER), data, value: ethers.toBeHex(avaxWei, 32), chainId: CHAIN_ID, gasLimit: "500000", description: `Buy tokens (ID ${tokenId}) with ${avax} AVAX` }] };
  }

  /** Build unsigned txs to sell a launchpad token: [approve, sell] */
  async buildSell(wallet: string, tokenId: string, amount: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<{ transactions: UnsignedTx[] }> {
    const id = BigInt(tokenId);
    const contract = this.getContract(tokenId);
    const params = await contract.getTokenParameters(id);
    if (params.lpDeployed) throw new Error("Token graduated to DEX — use dex.buildSwap() instead");
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    let sellAmount: bigint;
    if (amount === "max") { sellAmount = await token.balanceOf(wallet); } else { sellAmount = ethers.parseUnits(amount, 18); }
    if (sellAmount === 0n) throw new Error("Zero balance");

    if (!this.isArenaPaired(tokenId)) {
      sellAmount = (sellAmount / GRANULARITY_SCALER) * GRANULARITY_SCALER;
      if (sellAmount === 0n) throw new Error("Balance too small");
    }

    const spender = this.isArenaPaired(tokenId) ? ethers.getAddress(AVAX_HELPER) : ethers.getAddress(LAUNCH_CONTRACT);
    const erc20Iface = new ethers.Interface(ERC20_ABI);
    const approveTx: UnsignedTx = { to: tokenAddress, data: erc20Iface.encodeFunctionData("approve", [spender, ethers.MaxUint256]), value: "0", chainId: CHAIN_ID, gasLimit: "60000", description: "Approve token for selling" };

    let sellData: string; let sellTo: string;
    if (!this.isArenaPaired(tokenId)) {
      sellData = new ethers.Interface(LAUNCH_CONTRACT_ABI).encodeFunctionData("sell", [sellAmount, id]);
      sellTo = ethers.getAddress(LAUNCH_CONTRACT);
    } else {
      let minOut = 0n;
      try { const reward: bigint = await contract.calculateRewardWithFees(sellAmount, id); minOut = reward - (reward * BigInt(slippageBps)) / 10000n; } catch {}
      sellData = new ethers.Interface(AVAX_HELPER_ABI).encodeFunctionData("sellToAvax", [id, sellAmount, minOut]);
      sellTo = ethers.getAddress(AVAX_HELPER);
    }

    return { transactions: [approveTx, { to: sellTo, data: sellData, value: "0", chainId: CHAIN_ID, gasLimit: "500000", description: `Sell ${ethers.formatUnits(sellAmount, 18)} tokens (ID ${tokenId})` }] };
  }

  /** Binary search for max tokens purchasable with given AVAX */
  private async binarySearchTokenAmount(avaxBudgetWei: bigint, tokenId: bigint): Promise<bigint> {
    let maxForSale: bigint;
    try { maxForSale = await this.launchContract.getMaxTokensForSale(tokenId); } catch { maxForSale = 100_000_000n * GRANULARITY_SCALER; }
    const maxWhole = maxForSale / GRANULARITY_SCALER;
    if (maxWhole <= 0n) return 0n;
    let lo = 1n; let hi = maxWhole; let best = 0n;
    for (let i = 0; i < 30 && lo <= hi; i++) {
      const mid = (lo + hi) / 2n;
      try {
        const cost: bigint = await this.launchContract.calculateCostWithFees(mid, tokenId);
        if (cost <= avaxBudgetWei) { best = mid; lo = mid + 1n; } else { hi = mid - 1n; }
      } catch { hi = mid - 1n; }
    }
    return best > 0n ? best * GRANULARITY_SCALER : 0n;
  }
}
