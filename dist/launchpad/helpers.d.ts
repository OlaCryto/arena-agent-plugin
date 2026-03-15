import { ethers } from "ethers";
export declare function createLaunchpadContracts(provider: ethers.JsonRpcProvider): {
    launchContract: ethers.Contract;
    tokenManager: ethers.Contract;
    avaxHelper: ethers.Contract;
};
export declare function isArenaPaired(tokenId: string): boolean;
export declare function getContract(tokenId: string, launchContract: ethers.Contract, tokenManager: ethers.Contract): ethers.Contract;
/** Binary search: find max tokens purchasable with given AVAX budget (AVAX-paired only) */
export declare function binarySearchTokenAmount(launchContract: ethers.Contract, avaxBudgetWei: bigint, tokenId: bigint): Promise<bigint>;
//# sourceMappingURL=helpers.d.ts.map