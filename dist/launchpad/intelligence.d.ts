import { ethers } from "ethers";
export declare function getTokenInfo(tokenId: string, launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<{
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
export declare function getTokenQuote(tokenId: string, amount: string, side: "buy" | "sell", launchContract: ethers.Contract, tokenManager: ethers.Contract): Promise<{
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
export declare function getTokenBalance(wallet: string, tokenId: string, launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<{
    wallet: string;
    tokenId: string;
    tokenAddress: any;
    balance: string;
}>;
export declare function getPortfolio(wallet: string, tokenIds: number[], launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<{
    wallet: string;
    positions: any[];
    totalValueAvax: string;
}>;
export declare function getActivity(tokenId: string, launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider, count?: number): Promise<{
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
export declare function getMarketCap(tokenId: string, launchContract: ethers.Contract, tokenManager: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<{
    tokenId: string;
    name: string;
    symbol: string;
    priceAvax: string;
    marketCapAvax: string;
    amountSold: string;
    graduated: any;
    graduationProgress: string;
}>;
//# sourceMappingURL=intelligence.d.ts.map