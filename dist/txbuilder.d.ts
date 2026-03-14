export interface UnsignedTx {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gas?: string;
    gasLimit?: string;
    description: string;
}
export declare class TxBuilder {
    private provider;
    private arenaToken;
    private lbQuoter;
    private routerContract;
    constructor(rpcUrl?: string);
    get routerAddress(): string;
    /** Get a quote: how much ARENA for a given AVAX amount */
    getQuote(avaxAmount: string): Promise<{
        arenaOut: string;
        fee: string;
        netAvax: string;
    }>;
    /** Get wallet balances */
    getBalances(wallet: string): Promise<{
        avax: string;
        arena: string;
    }>;
    /** Get staking info for a wallet */
    getStakeInfo(wallet: string): Promise<{
        stakedAmount: string;
        pendingRewards: string;
    }>;
    /**
     * Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee).
     */
    buildBuyTx(wallet: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx>;
    /**
     * Build unsigned tx to approve ARENA for staking.
     */
    buildApproveStakingTx(wallet: string, amount: string): Promise<UnsignedTx>;
    /**
     * Build unsigned tx to stake ARENA.
     */
    buildStakeTx(wallet: string, amount: string): Promise<UnsignedTx>;
    /**
     * Build unsigned tx to unstake ARENA.
     */
    buildUnstakeTx(wallet: string, amount: string): Promise<UnsignedTx>;
    /**
     * Build full buy-and-stake flow (3 transactions).
     */
    buildBuyAndStakeTxs(wallet: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx[]>;
    /** Broadcast a signed transaction */
    broadcast(signedTx: string): Promise<string>;
}
//# sourceMappingURL=txbuilder.d.ts.map