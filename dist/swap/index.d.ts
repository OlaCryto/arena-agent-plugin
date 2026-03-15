import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
export declare class SwapModule {
    private provider;
    private arenaToken;
    private lbQuoter;
    private routerContract;
    constructor(provider: ethers.JsonRpcProvider);
    get routerAddress(): string;
    /** Get a buy quote: how much ARENA for a given AVAX amount */
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
    /** Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee) */
    buildBuyTx(wallet: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx>;
    /** Build unsigned txs to sell ARENA for AVAX via LFJ DEX: [approve, swap] */
    buildSellArenaTx(wallet: string, arenaAmount: string, slippageBps?: number): Promise<UnsignedTx[]>;
}
//# sourceMappingURL=index.d.ts.map