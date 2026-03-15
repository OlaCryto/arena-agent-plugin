export interface TokenInfo {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
}
export declare const NATIVE_AVAX = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export declare const POPULAR_TOKENS: Record<string, TokenInfo>;
/** Resolve a symbol or address to token info */
export declare function resolveToken(input: string): TokenInfo | null;
//# sourceMappingURL=tokens.d.ts.map