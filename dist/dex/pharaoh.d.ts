import type { UnsignedTx } from "../core/types";
export interface PharaohQuote {
    liquidityAvailable: boolean;
    buyAmount: string;
    sellAmount: string;
    buyToken: string;
    sellToken: string;
    allowanceTarget?: string;
    issues?: {
        allowance?: any;
        balance?: any;
    };
    transaction: {
        to: string;
        data: string;
        value: string;
        gas: string;
        gasPrice: string;
    };
}
/** Get a quote from Pharaoh DEX aggregator */
export declare function getPharaohQuote(sellToken: string, buyToken: string, sellAmountWei: string, taker: string, slippageBps?: number): Promise<PharaohQuote | null>;
/** Build unsigned swap tx(s) via Pharaoh */
export declare function buildPharaohSwapTx(wallet: string, fromAddress: string, toAddress: string, amountWei: bigint, fromSymbol: string, toSymbol: string, fromDecimals: number, toDecimals: number, slippageBps?: number): Promise<{
    transactions: UnsignedTx[];
    summary: string;
    via: string;
} | null>;
//# sourceMappingURL=pharaoh.d.ts.map