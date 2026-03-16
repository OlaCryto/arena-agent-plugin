import { ethers } from "ethers";
import {
  ARENA_TOKEN, WAVAX, LB_ROUTER, LB_QUOTER,
  ERC20_ABI, LB_ROUTER_ABI, LB_QUOTER_ABI,
  DEFAULT_SLIPPAGE_BPS,
} from "../core/constants";
import type { UnsignedTx } from "../core/types";

const ARENA_ROUTER = process.env.ARENA_ROUTER || "";
const ARENA_ROUTER_ABI = [
  "function buyArena(tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, uint256 amountOutMin, uint256 deadline) payable returns (uint256 arenaOut)",
  "function feeBps() view returns (uint256)",
];

export class SwapModule {
  private arenaToken: ethers.Contract;
  private lbQuoter: ethers.Contract;
  private routerContract: ethers.Contract | null;

  constructor(private provider: ethers.JsonRpcProvider) {
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, provider);
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, provider);
    this.routerContract = ARENA_ROUTER
      ? new ethers.Contract(ethers.getAddress(ARENA_ROUTER), ARENA_ROUTER_ABI, provider)
      : null;
  }

  get routerAddress(): string {
    return ARENA_ROUTER;
  }

  /** Get a buy quote: how much ARENA for a given AVAX amount */
  async getQuote(avaxAmount: string): Promise<{ arenaOut: string; fee: string; netAvax: string }> {
    const amountIn = ethers.parseEther(avaxAmount);
    const fee = (amountIn * 30n) / 10000n;
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

  /** Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee) */
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

    const deadline = Math.floor(Date.now() / 1000) + 3600;

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

  /** Build unsigned txs to sell ARENA for AVAX via LFJ DEX: [approve, swap] */
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
}
