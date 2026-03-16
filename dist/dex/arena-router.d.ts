import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
/** Build unsigned tx to buy a graduated token with AVAX */
export declare function buildArenaSwapBuyTx(provider: ethers.JsonRpcProvider, wallet: string, tokenAddress: string, avaxAmountWei: bigint, slippageBps?: number): Promise<{
    transactions: UnsignedTx[];
    summary: string;
    via: string;
}>;
/** Build unsigned tx(s) to sell a graduated token for AVAX */
export declare function buildArenaSwapSellTx(provider: ethers.JsonRpcProvider, wallet: string, tokenAddress: string, tokenAmountWei: bigint, slippageBps?: number): Promise<{
    transactions: UnsignedTx[];
    summary: string;
    via: string;
}>;
//# sourceMappingURL=arena-router.d.ts.map