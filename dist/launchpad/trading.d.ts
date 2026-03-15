import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
/** Build unsigned tx to buy a launchpad token */
export declare function buildLaunchpadBuyTx(wallet: string, tokenId: string, avaxAmount: string, launchContract: ethers.Contract, tokenManager: ethers.Contract, slippageBps?: number): Promise<UnsignedTx>;
/** Build unsigned txs to sell a launchpad token: [approve, sell] */
export declare function buildLaunchpadSellTx(wallet: string, tokenId: string, amount: string, launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider, slippageBps?: number): Promise<UnsignedTx[]>;
//# sourceMappingURL=trading.d.ts.map