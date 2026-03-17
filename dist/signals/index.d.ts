/**
 * SignalsModule — Intelligence layer for AI agent trading decisions.
 * Pulls market data, whale activity, funding rates, open interest,
 * and technical signals from Hyperliquid + public APIs.
 *
 * All data is free — no API keys needed.
 */
interface HlAssetCtx {
    coin: string;
    markPx: string;
    midPx: string;
    oraclePx: string;
    openInterest: string;
    funding: string;
    premium: string;
    dayNtlVlm: string;
    prevDayPx: string;
    impactPxs: string[];
}
interface HlMeta {
    name: string;
    szDecimals: number;
    maxLeverage: number;
}
interface FundingEntry {
    coin: string;
    fundingRate: string;
    premium: string;
    time: number;
}
interface MarketSignal {
    coin: string;
    price: number;
    oraclePrice: number;
    change24h: number;
    change24hPct: number;
    volume24h: number;
    openInterest: number;
    fundingRate: number;
    fundingAnnualized: number;
    fundingBias: "long-heavy" | "short-heavy" | "neutral";
    maxLeverage: number;
}
interface WhalePosition {
    address: string;
    coin: string;
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
    leverage: number;
    side: "long" | "short";
    positionValue: number;
}
interface TechnicalSignal {
    coin: string;
    price: number;
    sma20: number;
    sma50: number;
    rsi14: number;
    trend: "bullish" | "bearish" | "neutral";
    momentum: "strong" | "moderate" | "weak";
    priceVsSma20: number;
    priceVsSma50: number;
    volatility: number;
    support: number;
    resistance: number;
}
interface SignalSummary {
    coin: string;
    timestamp: string;
    market: MarketSignal;
    technical: TechnicalSignal;
    whaleActivity: {
        topLongs: WhalePosition[];
        topShorts: WhalePosition[];
        netBias: "long" | "short" | "neutral";
        largestPosition: WhalePosition | null;
    };
    verdict: {
        direction: "long" | "short" | "wait";
        confidence: "high" | "medium" | "low";
        reasons: string[];
    };
}
export declare class SignalsModule {
    private assetCache;
    private candleCache;
    /**
     * POST to Hyperliquid info endpoint.
     */
    private hlPost;
    /**
     * Get all asset contexts (prices, funding, OI, volume).
     * Cached for 10 seconds.
     */
    getAssetContexts(): Promise<{
        meta: HlMeta[];
        contexts: HlAssetCtx[];
    }>;
    /**
     * Get market signal for a specific asset.
     */
    getMarketSignal(coin: string): Promise<MarketSignal>;
    /**
     * Get top movers by 24h change.
     */
    getTopMovers(count?: number): Promise<{
        gainers: MarketSignal[];
        losers: MarketSignal[];
    }>;
    /**
     * Get assets with extreme funding rates (contrarian signal).
     */
    getFundingExtremes(count?: number): Promise<{
        mostPositive: MarketSignal[];
        mostNegative: MarketSignal[];
    }>;
    /**
     * Get historical funding rates for an asset.
     */
    getFundingHistory(coin: string, hours?: number): Promise<FundingEntry[]>;
    /**
     * Get predicted funding rates for all assets.
     */
    getPredictedFunding(): Promise<Array<{
        coin: string;
        predictedRate: number;
        nextFundingTime: number;
    }>>;
    /**
     * Get candle data for technical analysis.
     * Cached for 60 seconds.
     */
    getCandles(coin: string, interval?: string, count?: number): Promise<number[][]>;
    /**
     * Compute technical signals from candle data.
     */
    getTechnicalSignal(coin: string, interval?: string): Promise<TechnicalSignal>;
    /**
     * Get whale positions — largest positions on Hyperliquid for an asset.
     */
    getWhalePositions(coin: string, minPositionUsd?: number): Promise<WhalePosition[]>;
    /**
     * Get recent large trades (whale trades) for an asset.
     */
    getWhaleTrades(coin: string, minSizeUsd?: number, count?: number): Promise<any[]>;
    /**
     * Get assets at open interest cap (crowded trades).
     */
    getCrowdedTrades(): Promise<string[]>;
    /**
     * Full signal summary — everything an agent needs to make a decision.
     */
    getSignalSummary(coin: string): Promise<SignalSummary>;
    /**
     * Scan all assets for the best opportunities.
     */
    scanOpportunities(count?: number): Promise<SignalSummary[]>;
    private sma;
    private rsi;
    private intervalToMs;
}
export {};
//# sourceMappingURL=index.d.ts.map