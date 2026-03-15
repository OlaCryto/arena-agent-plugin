export interface ArenaToken {
    row_id: number;
    chain_id: number;
    group_id: string;
    token_name: string;
    token_symbol: string;
    token_contract_address: string;
    contract_address: string;
    creator_address: string;
    creator_user_handle: string;
    creator_photo_url: string;
    creator_twitter_followers: number | null;
    photo_url: string;
    description: string;
    total_supply_eth: number;
    a: number;
    b: number;
    curve_scaler: number;
    lp_deployed: boolean;
    lp_percentage: number;
    sale_percentage: number;
    group_fee: number;
    pair_address: string;
    create_time: string;
    transaction_hash: string;
    migration_time: string | null;
    is_official: boolean;
    lp_paired_with: string;
    latest_price_eth: number;
    latest_price_usd: number;
    latest_total_volume_eth: number;
    latest_total_volume_usd: number;
    latest_transaction_count: number;
    latest_holder_count: number;
    latest_supply_eth: number;
    latest_avax_price: number;
    latest_arena_price: number;
    latest_native_token_price: number;
    graduation_percentage?: number;
    whitelist_info: any;
    creator_total_tokens?: number;
    v4_pool_id: string | null;
}
export interface ArenaTokenStats {
    buyCount5m: number;
    buyCount1: number;
    buyCount4: number;
    buyCount12: number;
    buyCount24: number;
    sellCount5m: number;
    sellCount1: number;
    sellCount4: number;
    sellCount12: number;
    sellCount24: number;
    uniqueBuys5m: number;
    uniqueBuys1: number;
    uniqueBuys4: number;
    uniqueBuys12: number;
    uniqueBuys24: number;
    uniqueSells5m: number;
    uniqueSells1: number;
    uniqueSells4: number;
    uniqueSells12: number;
    uniqueSells24: number;
    buyVolume5m: number;
    buyVolume1: number;
    buyVolume4: number;
    buyVolume12: number;
    buyVolume24: number;
    sellVolume5m: number;
    sellVolume1: number;
    sellVolume4: number;
    sellVolume12: number;
    sellVolume24: number;
    volume5m: number;
    volume1: number;
    volume4: number;
    volume12: number;
    volume24: number;
    priceChange5m: number;
    priceChange1: number;
    priceChange4: number;
    priceChange12: number;
    priceChange24: number;
    liquidity: number;
    token: {
        address: string;
        symbol: string;
        name: string;
    };
}
export interface ArenaTrade {
    user_address: string;
    token_eth: number;
    user_eth: number;
    user_usd: number;
    price_eth: number;
    price_after_eth: number;
    block_number: string;
    create_time: string;
    transaction_hash: string;
    token_contract_address: string;
    token_id: string;
    token_name: string;
    token_symbol: string;
    photo_url: string;
    user_handle: string;
    user_photo_url: string;
    username: string;
    user_twitter_followers: number;
    current_balance: number;
    avax_price: number;
}
export interface ArenaHolder {
    rank: string;
    user_address: string;
    token_name: string;
    token_symbol: string;
    current_balance: number;
    current_price_eth: number;
    unrealized_pnl_eth: number;
    unrealized_pnl_usd: number;
    realized_pnl_eth: number;
    realized_pnl_usd: number;
    buy_count: string;
    sell_count: string;
    user_handle: string;
    user_photo_url: string;
    username: string;
    twitter_followers: number;
}
/** Get a single token by contract address (fastest exact lookup) */
export declare function getTokenByAddress(tokenAddress: string): Promise<ArenaToken | null>;
/** Get recent token launches (rich data, max 50) */
export declare function getRecentTokens(limit?: number, offset?: number): Promise<ArenaToken[]>;
/** Get tokens about to graduate (max 50) */
export declare function getGraduatingTokens(limit?: number): Promise<ArenaToken[]>;
/** Get graduated tokens (on DEX, max 50) */
export declare function getGraduatedTokens(limit?: number): Promise<ArenaToken[]>;
/** Get top volume tokens by timeframe (max 50) */
export declare function getTopVolume(timeframe?: "5m" | "1h" | "4h" | "24h" | "all_time", limit?: number): Promise<ArenaToken[]>;
/** Get token stats (buy/sell counts, volume, price changes across timeframes) */
export declare function getTokenStats(tokenAddress: string): Promise<ArenaTokenStats>;
/** Get recent trades for a token (max 50) */
export declare function getTokenTrades(tokenAddress: string, limit?: number, offset?: number): Promise<{
    results: ArenaTrade[];
}>;
/** Get token holders with PnL (max 50) */
export declare function getTokenHolders(tokenAddress: string, limit?: number): Promise<ArenaHolder[]>;
/** Get user PnL across tokens */
export declare function getUserPnl(userAddress: string): Promise<any>;
/** Get user trade info */
export declare function getUserTradeInfo(userAddress: string): Promise<any>;
/** Search tokens by name/symbol (max limit: 10) */
export declare function searchTokens(query: string, limit?: number): Promise<ArenaToken[]>;
/** Get global trades feed (all tokens, max 50) */
export declare function getGlobalTrades(limit?: number, offset?: number): Promise<{
    results: ArenaTrade[];
}>;
//# sourceMappingURL=arena-api.d.ts.map