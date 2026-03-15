export interface TradeEntry {
    timestamp: string;
    agent: string;
    wallet: string;
    action: string;
    details: string;
    module: "swap" | "staking" | "launchpad" | "dex";
}
export declare function logTrade(agent: string, wallet: string, action: string, details: string, module: TradeEntry["module"]): void;
export declare function getRecentTrades(count?: number): TradeEntry[];
export declare function getTradeStats(): {
    total: number;
    last24h: number;
    byModule: Record<string, number>;
};
//# sourceMappingURL=tradelog.d.ts.map