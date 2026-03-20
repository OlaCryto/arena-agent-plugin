import { ethers, type JsonRpcProvider } from "ethers";
import {
  ARENA_TOKEN, WAVAX, LB_ROUTER, LB_QUOTER,
  ERC20_ABI, LB_ROUTER_ABI, LB_QUOTER_ABI,
  DEFAULT_SLIPPAGE_BPS, CHAIN_ID,
} from "../constants.js";
import type { UnsignedTx } from "../types.js";

export class SwapModule {
  private arenaToken: ethers.Contract;
  private lbQuoter: ethers.Contract;

  constructor(private provider: JsonRpcProvider) {
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, provider);
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, provider);
  }

  /** Get AVAX and ARENA balances for a wallet */
  async getBalances(wallet: string): Promise<{ avax: string; arena: string; avaxFormatted: string; arenaFormatted: string }> {
    const [avax, arena] = await Promise.all([
      this.provider.getBalance(wallet),
      this.arenaToken.balanceOf(wallet),
    ]);
    const decimals = await this.arenaToken.decimals();
    return {
      avax: avax.toString(),
      arena: arena.toString(),
      avaxFormatted: ethers.formatEther(avax),
      arenaFormatted: ethers.formatUnits(arena, decimals),
    };
  }

  /** Quote how much ARENA for a given AVAX amount (includes 0.3% fee) */
  async quote(avaxAmount: string): Promise<{ arenaOut: string; fee: string; netAvax: string; rate: string }> {
    const amountIn = ethers.parseEther(avaxAmount);
    const fee = (amountIn * 30n) / 10000n;
    const netAmount = amountIn - fee;

    const route = [WAVAX, ARENA_TOKEN];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
    const arenaOut = quote.amounts[quote.amounts.length - 1];
    const decimals = await this.arenaToken.decimals();
    const arenaFormatted = ethers.formatUnits(arenaOut, decimals);

    return {
      arenaOut: arenaFormatted,
      fee: ethers.formatEther(fee),
      netAvax: ethers.formatEther(netAmount),
      rate: (parseFloat(arenaFormatted) / parseFloat(ethers.formatEther(netAmount))).toFixed(2),
    };
  }

  /** Quote how much AVAX for selling ARENA */
  async sellQuote(arenaAmount: string): Promise<{ avaxOut: string; arenaIn: string; rate: string }> {
    const decimals = await this.arenaToken.decimals();
    const amountIn = ethers.parseUnits(arenaAmount, decimals);

    const route = [ARENA_TOKEN, WAVAX];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const avaxOut = quote.amounts[quote.amounts.length - 1];
    const avaxFormatted = ethers.formatEther(avaxOut);

    return {
      avaxOut: avaxFormatted,
      arenaIn: arenaAmount,
      rate: (parseFloat(arenaAmount) / parseFloat(avaxFormatted)).toFixed(2),
    };
  }

  /** Build unsigned tx to buy ARENA with AVAX via LFJ DEX */
  async buildBuy(wallet: string, avaxAmount: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<{ transactions: UnsignedTx[]; summary: string }> {
    const amountIn = ethers.parseEther(avaxAmount);
    const route = [WAVAX, ARENA_TOKEN];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    if (expectedOut === 0n) throw new Error("Quote returned zero — pool may have no liquidity");

    const clampedSlippage = BigInt(Math.max(0, Math.min(10000, Number(slippageBps))));
    const amountOutMin = expectedOut - (expectedOut * clampedSlippage) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const path = {
      pairBinSteps: [...quote.binSteps].map((b: any) => b.toString()),
      versions: [...quote.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    const iface = new ethers.Interface(LB_ROUTER_ABI);
    const data = iface.encodeFunctionData("swapExactNATIVEForTokens", [amountOutMin, path, wallet, deadline]);
    const decimals = await this.arenaToken.decimals();

    return {
      transactions: [{
        to: ethers.getAddress(LB_ROUTER),
        data,
        value: ethers.toBeHex(amountIn, 32),
        chainId: CHAIN_ID,
        gasLimit: "500000",
        description: `Buy ARENA with ${avaxAmount} AVAX (~${ethers.formatUnits(expectedOut, decimals)} ARENA)`,
      }],
      summary: `Swap ${avaxAmount} AVAX → ~${ethers.formatUnits(expectedOut, decimals)} ARENA`,
    };
  }

  /** Build unsigned txs to sell ARENA for AVAX: [approve, swap] */
  async buildSell(wallet: string, arenaAmount: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<{ transactions: UnsignedTx[] }> {
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
    if (expectedOut === 0n) throw new Error("Quote returned zero — pool may have no liquidity");

    const clampedSlippage = BigInt(Math.max(0, Math.min(10000, Number(slippageBps))));
    const amountOutMin = expectedOut - (expectedOut * clampedSlippage) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const path = {
      pairBinSteps: [...quote.binSteps].map((b: any) => b.toString()),
      versions: [...quote.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    const approveIface = new ethers.Interface(ERC20_ABI);
    const approveData = approveIface.encodeFunctionData("approve", [ethers.getAddress(LB_ROUTER), sellAmount]);

    const swapIface = new ethers.Interface(LB_ROUTER_ABI);
    const swapData = swapIface.encodeFunctionData("swapExactTokensForNATIVE", [sellAmount, amountOutMin, path, wallet, deadline]);

    return {
      transactions: [
        {
          to: ethers.getAddress(ARENA_TOKEN),
          data: approveData,
          value: "0",
          chainId: CHAIN_ID,
          gasLimit: "60000",
          description: `Approve ${ethers.formatUnits(sellAmount, decimals)} ARENA for swap`,
        },
        {
          to: ethers.getAddress(LB_ROUTER),
          data: swapData,
          value: "0",
          chainId: CHAIN_ID,
          gasLimit: "500000",
          description: `Sell ${ethers.formatUnits(sellAmount, decimals)} ARENA for ~${ethers.formatEther(expectedOut)} AVAX`,
        },
      ],
    };
  }
}
