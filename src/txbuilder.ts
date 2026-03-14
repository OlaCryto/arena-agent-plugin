import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import {
  ARENA_TOKEN,
  WAVAX,
  ARENA_STAKING,
  LB_QUOTER,
  ERC20_ABI,
  LB_QUOTER_ABI,
  ARENA_STAKING_ABI,
  DEFAULT_SLIPPAGE_BPS,
  RPC_URL,
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
  description: string;
}

export class TxBuilder {
  private provider: ethers.JsonRpcProvider;
  private arenaToken: ethers.Contract;
  private lbQuoter: ethers.Contract;
  private routerContract: ethers.Contract;

  constructor(rpcUrl?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl || RPC_URL);
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, this.provider);
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, this.provider);

    if (ARENA_ROUTER) {
      this.routerContract = new ethers.Contract(ethers.getAddress(ARENA_ROUTER), ARENA_ROUTER_ABI, this.provider);
    } else {
      this.routerContract = null as any;
    }
  }

  get routerAddress(): string {
    return ARENA_ROUTER;
  }

  /** Get a quote: how much ARENA for a given AVAX amount */
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

    const deadline = Math.floor(Date.now() / 1000) + 1200;

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
      value: amountIn.toString(),
      chainId: 43114,
      description: `Buy ARENA with ${avaxAmount} AVAX (0.3% fee: ${ethers.formatEther(fee)} AVAX)`,
    };
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

    // For approve + stake, we estimate the ARENA output
    const amountIn = ethers.parseEther(avaxAmount);
    const fee = (amountIn * 30n) / 10000n;
    const netAmount = amountIn - fee;
    const route = [WAVAX, ARENA_TOKEN];
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    const decimals = await this.arenaToken.decimals();
    const expectedArena = ethers.formatUnits(expectedOut, decimals);

    const approveTx = await this.buildApproveStakingTx(wallet, expectedArena);
    const stakeTx = await this.buildStakeTx(wallet, expectedArena);

    return [
      { ...buyTx, description: `Step 1/3: ${buyTx.description}` },
      { ...approveTx, description: `Step 2/3: ${approveTx.description}` },
      { ...stakeTx, description: `Step 3/3: ${stakeTx.description}` },
    ];
  }

  /** Broadcast a signed transaction */
  async broadcast(signedTx: string): Promise<string> {
    const txResponse = await this.provider.broadcastTransaction(signedTx);
    await txResponse.wait();
    return txResponse.hash;
  }
}
