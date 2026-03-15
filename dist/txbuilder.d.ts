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
    private launchContract;
    private tokenManager;
    private avaxHelper;
    constructor(rpcUrl?: string);
    get routerAddress(): string;
    /** Get a quote: how much ARENA for a given AVAX amount (buy) */
    getQuote(avaxAmount: string): Promise<{
        arenaOut: string;
        fee: string;
        netAvax: string;
    }>;
    /** Get a sell quote: how much AVAX for a given ARENA amount */
    getSellQuote(arenaAmount: string): Promise<{
        avaxOut: string;
        arenaIn: string;
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
     * Build unsigned txs to sell ARENA for AVAX via LFJ DEX: [approve, swap]
     */
    buildSellArenaTx(wallet: string, arenaAmount: string, slippageBps?: number): Promise<UnsignedTx[]>;
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
    private isArenaPaired;
    private getContract;
    /** Binary search: find max tokens purchasable with given AVAX budget (AVAX-paired only) */
    private binarySearchTokenAmount;
    /** Get comprehensive token info by ID */
    getTokenInfo(tokenId: string): Promise<{
        tokenId: string;
        type: string;
        name: string;
        symbol: string;
        tokenAddress: any;
        creator: any;
        priceAvax: string;
        marketCapAvax: string;
        graduationProgress: string;
        graduated: any;
        amountSold: string;
        totalSupply: string;
        saleAllocation: string;
        remainingForSale: string;
        curveParams: {
            a: any;
            b: any;
            curveScaler: any;
        };
        creatorFeeBps: any;
        lpPercentage: any;
        salePercentage: any;
    }>;
    /** Get smart quote for buying or selling a launchpad token */
    getTokenQuote(tokenId: string, amount: string, side: "buy" | "sell"): Promise<{
        tokenId: string;
        side: "buy";
        avaxIn: string;
        tokensOut: string;
        note: string;
        tokenAmount?: undefined;
        rewardAvax?: undefined;
        rewardArena?: undefined;
    } | {
        tokenId: string;
        side: "buy";
        avaxIn: string;
        tokensOut: string;
        note?: undefined;
        tokenAmount?: undefined;
        rewardAvax?: undefined;
        rewardArena?: undefined;
    } | {
        tokenId: string;
        side: "sell";
        tokenAmount: string;
        rewardAvax: string | undefined;
        rewardArena: string | undefined;
        note: string | undefined;
        avaxIn?: undefined;
        tokensOut?: undefined;
    }>;
    /** Get launchpad token balance for a wallet */
    getTokenBalance(wallet: string, tokenId: string): Promise<{
        wallet: string;
        tokenId: string;
        tokenAddress: any;
        balance: string;
    }>;
    /** Get recent token launches */
    getRecentLaunches(count?: number, type?: "all" | "avax" | "arena"): Promise<any[]>;
    /** Search for a token by contract address */
    searchToken(query: string): Promise<{
        tokenId: string;
        type: string;
        name: string;
        symbol: string;
        tokenAddress: any;
        creator: any;
        priceAvax: string;
        marketCapAvax: string;
        graduationProgress: string;
        graduated: any;
        amountSold: string;
        totalSupply: string;
        saleAllocation: string;
        remainingForSale: string;
        curveParams: {
            a: any;
            b: any;
            curveScaler: any;
        };
        creatorFeeBps: any;
        lpPercentage: any;
        salePercentage: any;
    }>;
    /** Get tokens closest to graduating (deploying LP) */
    getGraduating(count?: number): Promise<any[]>;
    /** Get agent's portfolio (tracked positions) */
    getPortfolio(wallet: string, tokenIds: number[]): Promise<{
        wallet: string;
        positions: any[];
        totalValueAvax: string;
    }>;
    /** Get recent Buy/Sell activity for a token */
    getActivity(tokenId: string, count?: number): Promise<{
        tokenId: string;
        events: ({
            type: string;
            user: any;
            tokenAmount: string;
            cost: string;
            block: any;
        } | {
            type: string;
            user: any;
            tokenAmount: string;
            reward: string;
            block: any;
        })[];
    }>;
    /** Get platform overview */
    getOverview(): Promise<{
        totalAvaxPairedTokens: string;
        totalArenaPairedTokens: string;
        totalTokens: string;
        protocolFeeBps: {
            avaxPaired: any;
            arenaPaired: any;
        };
        contracts: {
            launchContract: string;
            tokenManager: string;
            avaxHelper: string;
        };
    }>;
    /** Get market cap for a token */
    getMarketCap(tokenId: string): Promise<{
        tokenId: string;
        name: string;
        symbol: string;
        priceAvax: string;
        marketCapAvax: string;
        amountSold: string;
        graduated: any;
        graduationProgress: string;
    }>;
    /** Build unsigned tx to buy a launchpad token */
    buildLaunchpadBuyTx(wallet: string, tokenId: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx>;
    /** Build unsigned txs to sell a launchpad token: [approve, sell] */
    buildLaunchpadSellTx(wallet: string, tokenId: string, amount: string, slippageBps?: number): Promise<UnsignedTx[]>;
}
//# sourceMappingURL=txbuilder.d.ts.map