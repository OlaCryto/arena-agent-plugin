import { ethers } from "ethers";
import {
  ARENA_TOKEN,
  WAVAX,
  ARENA_STAKING,
  LB_ROUTER,
  LB_QUOTER,
  ERC20_ABI,
  ARENA_STAKING_ABI,
  LB_ROUTER_ABI,
  LB_QUOTER_ABI,
  DEFAULT_SLIPPAGE_BPS,
  RPC_URL,
} from "./constants";

export interface BuyResult {
  txHash: string;
  amountIn: string;
  amountOut: string;
}

export interface StakeResult {
  approveTxHash: string;
  stakeTxHash: string;
  amountStaked: string;
}

export interface StakeInfo {
  stakedAmount: string;
  pendingRewards: string;
}

export class ArenaPlugin {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private arenaToken: ethers.Contract;
  private staking: ethers.Contract;
  private lbRouter: ethers.Contract;
  private lbQuoter: ethers.Contract;

  constructor(privateKey: string, rpcUrl?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl || RPC_URL);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, this.wallet);
    this.staking = new ethers.Contract(ethers.getAddress(ARENA_STAKING), ARENA_STAKING_ABI, this.wallet);
    this.lbRouter = new ethers.Contract(ethers.getAddress(LB_ROUTER), LB_ROUTER_ABI, this.wallet);
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, this.provider);
  }

  get address(): string {
    return this.wallet.address;
  }

  /** Get AVAX balance of the agent wallet */
  async getAvaxBalance(): Promise<string> {
    const bal = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(bal);
  }

  /** Get ARENA token balance of the agent wallet */
  async getArenaBalance(): Promise<string> {
    const bal = await this.arenaToken.balanceOf(this.wallet.address);
    const decimals = await this.arenaToken.decimals();
    return ethers.formatUnits(bal, decimals);
  }

  /** Get a quote: how much ARENA for a given amount of AVAX */
  async getQuote(avaxAmount: string): Promise<string> {
    const amountIn = ethers.parseEther(avaxAmount);
    const route = [WAVAX, ARENA_TOKEN];

    try {
      const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
      const amountsOut = quote.amounts;
      const arenaOut = amountsOut[amountsOut.length - 1];
      const decimals = await this.arenaToken.decimals();
      return ethers.formatUnits(arenaOut, decimals);
    } catch {
      throw new Error("Failed to get quote — no liquidity path found for AVAX→ARENA");
    }
  }

  /**
   * Buy ARENA tokens with AVAX via LFJ Router V2.2.
   * @param avaxAmount Amount of AVAX to spend (e.g. "1.5")
   * @param slippageBps Slippage tolerance in basis points (default 100 = 1%)
   */
  async buyArena(avaxAmount: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<BuyResult> {
    const amountIn = ethers.parseEther(avaxAmount);
    const route = [WAVAX, ARENA_TOKEN];

    // Get quote for minimum output
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;

    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

    // Copy arrays — ethers v6 returns frozen/read-only Result objects
    const path = {
      pairBinSteps: [...quote.binSteps],
      versions: [...quote.versions],
      tokenPath: [...route],
    };

    const tx = await this.lbRouter.swapExactNATIVEForTokens(
      amountOutMin,
      path,
      this.wallet.address,
      deadline,
      { value: amountIn }
    );

    const receipt = await tx.wait();
    const decimals = await this.arenaToken.decimals();

    return {
      txHash: receipt.hash,
      amountIn: avaxAmount,
      amountOut: ethers.formatUnits(expectedOut, decimals),
    };
  }

  /**
   * Stake ARENA tokens into the Arena staking contract.
   * Approves + deposits in one flow.
   * @param amount Amount of ARENA to stake (e.g. "1000"). Use "max" to stake entire balance.
   */
  async stakeArena(amount: string): Promise<StakeResult> {
    const decimals = await this.arenaToken.decimals();
    let stakeAmount: bigint;

    if (amount === "max") {
      stakeAmount = await this.arenaToken.balanceOf(this.wallet.address);
      if (stakeAmount === 0n) throw new Error("No ARENA tokens to stake");
    } else {
      stakeAmount = ethers.parseUnits(amount, decimals);
    }

    // Check current allowance
    const currentAllowance: bigint = await this.arenaToken.allowance(
      this.wallet.address,
      ARENA_STAKING
    );

    let approveTxHash = "already-approved";

    if (currentAllowance < stakeAmount) {
      const approveTx = await this.arenaToken.approve(ARENA_STAKING, stakeAmount);
      const approveReceipt = await approveTx.wait();
      approveTxHash = approveReceipt.hash;
    }

    // Deposit into staking contract
    const stakeTx = await this.staking.deposit(stakeAmount);
    const stakeReceipt = await stakeTx.wait();

    return {
      approveTxHash,
      stakeTxHash: stakeReceipt.hash,
      amountStaked: ethers.formatUnits(stakeAmount, decimals),
    };
  }

  /**
   * Buy ARENA with AVAX and immediately stake it.
   * @param avaxAmount Amount of AVAX to spend
   * @param slippageBps Slippage tolerance in basis points
   */
  async buyAndStake(
    avaxAmount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<{ buy: BuyResult; stake: StakeResult }> {
    const buy = await this.buyArena(avaxAmount, slippageBps);
    const stake = await this.stakeArena("max");
    return { buy, stake };
  }

  /** Get staking info for the agent wallet */
  async getStakeInfo(): Promise<StakeInfo> {
    const decimals = await this.arenaToken.decimals();
    const [stakedRaw] = await this.staking.getUserInfo(this.wallet.address, ethers.getAddress(ARENA_TOKEN));
    const pendingRaw = await this.staking.pendingReward(this.wallet.address, ethers.getAddress(ARENA_TOKEN));

    return {
      stakedAmount: ethers.formatUnits(stakedRaw, decimals),
      pendingRewards: ethers.formatUnits(pendingRaw, decimals),
    };
  }

  /** Withdraw staked ARENA (also claims pending rewards) */
  async unstake(amount: string): Promise<{ txHash: string; amountWithdrawn: string }> {
    const decimals = await this.arenaToken.decimals();
    let withdrawAmount: bigint;

    if (amount === "max") {
      const [stakedRaw] = await this.staking.getUserInfo(this.wallet.address, ethers.getAddress(ARENA_TOKEN));
      withdrawAmount = stakedRaw;
      if (withdrawAmount === 0n) throw new Error("Nothing staked to withdraw");
    } else {
      withdrawAmount = ethers.parseUnits(amount, decimals);
    }

    const tx = await this.staking.withdraw(withdrawAmount);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      amountWithdrawn: ethers.formatUnits(withdrawAmount, decimals),
    };
  }
}
