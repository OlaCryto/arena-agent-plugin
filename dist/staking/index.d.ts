import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
import type { SwapModule } from "../swap";
export declare class StakingModule {
    private provider;
    private swap;
    private arenaToken;
    constructor(provider: ethers.JsonRpcProvider, swap: SwapModule);
    /** Get staking info for a wallet */
    getStakeInfo(wallet: string): Promise<{
        stakedAmount: string;
        pendingRewards: string;
    }>;
    /** Build unsigned tx to approve ARENA for staking */
    buildApproveStakingTx(wallet: string, amount: string): Promise<UnsignedTx>;
    /** Build unsigned tx to stake ARENA */
    buildStakeTx(wallet: string, amount: string): Promise<UnsignedTx>;
    /** Build unsigned tx to unstake ARENA */
    buildUnstakeTx(wallet: string, amount: string): Promise<UnsignedTx>;
    /** Build full buy-and-stake flow (3 transactions) */
    buildBuyAndStakeTxs(wallet: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx[]>;
}
//# sourceMappingURL=index.d.ts.map