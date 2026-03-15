import { ethers } from "ethers";
export declare function getRecentLaunches(launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider, count?: number, type?: "all" | "avax" | "arena"): Promise<any[]>;
export declare function searchToken(launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider, query: string, getTokenInfo: (tokenId: string) => Promise<any>): Promise<any>;
export declare function getGraduating(launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider, count?: number): Promise<any[]>;
export declare function getOverview(launchContract: ethers.Contract, tokenManager: ethers.Contract): Promise<{
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
//# sourceMappingURL=discovery.d.ts.map