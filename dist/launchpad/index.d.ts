import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
export declare class LaunchpadModule {
    private provider;
    private launchContract;
    private tokenManager;
    private avaxHelper;
    constructor(provider: ethers.JsonRpcProvider);
    getRecentLaunches(count?: number, type?: "all" | "avax" | "arena"): Promise<any[]>;
    searchToken(query: string): Promise<any>;
    getGraduating(count?: number): Promise<any[]>;
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
    getTokenBalance(wallet: string, tokenId: string): Promise<{
        wallet: string;
        tokenId: string;
        tokenAddress: any;
        balance: string;
    }>;
    getPortfolio(wallet: string, tokenIds: number[]): Promise<{
        wallet: string;
        positions: any[];
        totalValueAvax: string;
    }>;
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
    buildLaunchpadBuyTx(wallet: string, tokenId: string, avaxAmount: string, slippageBps?: number): Promise<UnsignedTx | {
        transactions: UnsignedTx[];
        summary: string;
        via: string;
        graduated: true;
    }>;
    buildLaunchpadSellTx(wallet: string, tokenId: string, amount: string, slippageBps?: number): Promise<UnsignedTx[] | {
        transactions: UnsignedTx[];
        summary: string;
        via: string;
        graduated: true;
    }>;
}
//# sourceMappingURL=index.d.ts.map