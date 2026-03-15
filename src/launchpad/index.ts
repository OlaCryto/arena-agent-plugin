import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
import { ERC20_ABI } from "../core/constants";
import { createLaunchpadContracts, getContract } from "./helpers";
import { buildPharaohSwapTx } from "../dex/pharaoh";
import * as discovery from "./discovery";
import * as intelligence from "./intelligence";
import * as trading from "./trading";

export class LaunchpadModule {
  private launchContract: ethers.Contract;
  private tokenManager: ethers.Contract;
  private avaxHelper: ethers.Contract;

  constructor(private provider: ethers.JsonRpcProvider) {
    const contracts = createLaunchpadContracts(provider);
    this.launchContract = contracts.launchContract;
    this.tokenManager = contracts.tokenManager;
    this.avaxHelper = contracts.avaxHelper;
  }

  // ─── Discovery ───

  async getRecentLaunches(count = 10, type: "all" | "avax" | "arena" = "all") {
    return discovery.getRecentLaunches(this.launchContract, this.tokenManager, this.provider, count, type);
  }

  async searchToken(query: string) {
    return discovery.searchToken(
      this.launchContract, this.tokenManager, this.provider, query,
      (tokenId) => this.getTokenInfo(tokenId),
    );
  }

  async getGraduating(count = 5) {
    return discovery.getGraduating(this.launchContract, this.tokenManager, this.provider, count);
  }

  async getOverview() {
    return discovery.getOverview(this.launchContract, this.tokenManager);
  }

  // ─── Intelligence ───

  async getTokenInfo(tokenId: string) {
    return intelligence.getTokenInfo(tokenId, this.launchContract, this.tokenManager, this.provider);
  }

  async getTokenQuote(tokenId: string, amount: string, side: "buy" | "sell") {
    return intelligence.getTokenQuote(tokenId, amount, side, this.launchContract, this.tokenManager);
  }

  async getTokenBalance(wallet: string, tokenId: string) {
    return intelligence.getTokenBalance(wallet, tokenId, this.launchContract, this.tokenManager, this.provider);
  }

  async getPortfolio(wallet: string, tokenIds: number[]) {
    return intelligence.getPortfolio(wallet, tokenIds, this.launchContract, this.tokenManager, this.provider);
  }

  async getActivity(tokenId: string, count = 20) {
    return intelligence.getActivity(tokenId, this.launchContract, this.tokenManager, this.provider, count);
  }

  async getMarketCap(tokenId: string) {
    return intelligence.getMarketCap(tokenId, this.launchContract, this.tokenManager, this.provider);
  }

  // ─── Trading ───

  async buildLaunchpadBuyTx(wallet: string, tokenId: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx | { transactions: UnsignedTx[]; summary: string; via: string; graduated: true }> {
    const contract = getContract(tokenId, this.launchContract, this.tokenManager);
    const params = await contract.getTokenParameters(BigInt(tokenId));

    if (params.lpDeployed) {
      const tokenAddress = params.tokenContractAddress;
      if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

      // Get token info for display
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);

      const amountWei = ethers.parseEther(avaxAmount);
      const result = await buildPharaohSwapTx(wallet, tokenAddress, tokenAddress, amountWei, "AVAX", symbol, 18, Number(decimals), slippageBps || 100);
      if (!result) throw new Error(`No liquidity found on Pharaoh DEX for this graduated token`);
      return { ...result, graduated: true };
    }

    return trading.buildLaunchpadBuyTx(wallet, tokenId, avaxAmount, this.launchContract, this.tokenManager, slippageBps);
  }

  async buildLaunchpadSellTx(wallet: string, tokenId: string, amount: string, slippageBps?: number): Promise<UnsignedTx[] | { transactions: UnsignedTx[]; summary: string; via: string; graduated: true }> {
    const contract = getContract(tokenId, this.launchContract, this.tokenManager);
    const params = await contract.getTokenParameters(BigInt(tokenId));

    if (params.lpDeployed) {
      const tokenAddress = params.tokenContractAddress;
      if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);

      let amountWei: bigint;
      if (amount === "max") {
        amountWei = await token.balanceOf(wallet);
        if (amountWei === 0n) throw new Error("Zero balance — nothing to sell");
      } else {
        amountWei = ethers.parseUnits(amount, Number(decimals));
      }

      const result = await buildPharaohSwapTx(wallet, tokenAddress, tokenAddress, amountWei, symbol, "AVAX", Number(decimals), 18, slippageBps || 100);
      if (!result) throw new Error(`No liquidity found on Pharaoh DEX for this graduated token`);
      return { ...result, graduated: true };
    }

    return trading.buildLaunchpadSellTx(wallet, tokenId, amount, this.launchContract, this.tokenManager, this.provider, slippageBps);
  }
}
