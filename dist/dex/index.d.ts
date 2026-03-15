import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
import { type TokenInfo } from "./tokens";
export declare class DexModule {
    private provider;
    private lbQuoter;
    constructor(provider: ethers.JsonRpcProvider);
    /** List all known tokens */
    getTokenList(): TokenInfo[];
    /** Fetch on-chain token info for any address */
    getTokenInfo(address: string): Promise<TokenInfo>;
    /** Normalize any address to proper EIP-55 checksum */
    private checksumAddr;
    /** Resolve a symbol or address to full token info, fetching on-chain if needed */
    resolveTokenFull(input: string): Promise<TokenInfo>;
    /** Get a quote for any token pair */
    getQuote(fromInput: string, toInput: string, amount: string): Promise<{
        fromToken: TokenInfo;
        toToken: TokenInfo;
        amountIn: string;
        amountOut: string;
        route: string[];
        priceImpact: string;
    }>;
    /** Get balance of any token for a wallet */
    getBalance(wallet: string, tokenInput: string): Promise<{
        token: TokenInfo;
        balance: string;
    }>;
    /** Build unsigned swap transaction(s) for any pair */
    buildSwapTx(wallet: string, fromInput: string, toInput: string, amount: string, slippageBps?: number): Promise<{
        transactions: UnsignedTx[];
        summary: string;
    }>;
}
export { POPULAR_TOKENS, resolveToken } from "./tokens";
export type { TokenInfo } from "./tokens";
//# sourceMappingURL=index.d.ts.map