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
export declare class ArenaPlugin {
    private provider;
    private wallet;
    private arenaToken;
    private staking;
    private lbRouter;
    private lbQuoter;
    constructor(privateKey: string, rpcUrl?: string);
    get address(): string;
    /** Get AVAX balance of the agent wallet */
    getAvaxBalance(): Promise<string>;
    /** Get ARENA token balance of the agent wallet */
    getArenaBalance(): Promise<string>;
    /** Get a quote: how much ARENA for a given amount of AVAX */
    getQuote(avaxAmount: string): Promise<string>;
    /**
     * Buy ARENA tokens with AVAX via LFJ Router V2.2.
     * @param avaxAmount Amount of AVAX to spend (e.g. "1.5")
     * @param slippageBps Slippage tolerance in basis points (default 100 = 1%)
     */
    buyArena(avaxAmount: string, slippageBps?: number): Promise<BuyResult>;
    /**
     * Stake ARENA tokens into the Arena staking contract.
     * Approves + deposits in one flow.
     * @param amount Amount of ARENA to stake (e.g. "1000"). Use "max" to stake entire balance.
     */
    stakeArena(amount: string): Promise<StakeResult>;
    /**
     * Buy ARENA with AVAX and immediately stake it.
     * @param avaxAmount Amount of AVAX to spend
     * @param slippageBps Slippage tolerance in basis points
     */
    buyAndStake(avaxAmount: string, slippageBps?: number): Promise<{
        buy: BuyResult;
        stake: StakeResult;
    }>;
    /** Get staking info for the agent wallet */
    getStakeInfo(): Promise<StakeInfo>;
    /** Withdraw staked ARENA (also claims pending rewards) */
    unstake(amount: string): Promise<{
        txHash: string;
        amountWithdrawn: string;
    }>;
}
//# sourceMappingURL=arena.d.ts.map