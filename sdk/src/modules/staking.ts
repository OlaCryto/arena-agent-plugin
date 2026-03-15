import type { HttpClient } from "../http.js";
import type { StakeInfoResponse, StakeBuildResponse, UnsignedTx } from "../types.js";

export class StakingModule {
  constructor(
    private http: HttpClient,
    private auth: () => Promise<void>,
  ) {}

  /**
   * Get staking info for a wallet — staked amount, pending rewards, APY.
   * @param wallet - Wallet address to check
   */
  async getInfo(wallet: string): Promise<StakeInfoResponse> {
    await this.auth();
    return this.http.get("/stake/info", { wallet });
  }

  /**
   * Build unsigned transactions to stake ARENA tokens.
   *
   * Returns 2 transactions — execute in order:
   * 1. Approve — allows the staking contract to spend your ARENA
   * 2. Stake — deposits ARENA into staking
   *
   * @param wallet - Your wallet address
   * @param amount - Amount of ARENA to stake
   */
  async buildStake(wallet: string, amount: string): Promise<StakeBuildResponse> {
    await this.auth();
    return this.http.get("/build/stake", { wallet, amount });
  }

  /**
   * Build unsigned transactions to buy ARENA with AVAX and stake in one flow.
   *
   * Combines swap + approve + stake. Returns multiple transactions — execute in order.
   *
   * @param wallet - Your wallet address
   * @param avax - Amount of AVAX to spend
   * @param slippage - Slippage tolerance in basis points (default: 500 = 5%)
   */
  async buildBuyAndStake(wallet: string, avax: string, slippage?: number): Promise<StakeBuildResponse> {
    await this.auth();
    return this.http.get("/build/buy-and-stake", { wallet, avax, slippage });
  }

  /**
   * Build unsigned transaction to unstake ARENA tokens and claim rewards.
   * @param wallet - Your wallet address
   * @param amount - Amount of ARENA to unstake
   */
  async buildUnstake(wallet: string, amount: string): Promise<UnsignedTx> {
    await this.auth();
    return this.http.get("/build/unstake", { wallet, amount });
  }
}
