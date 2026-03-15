"use strict";
// Popular Avalanche C-Chain tokens — agents can use symbols instead of addresses
// This is a convenience registry; agents can also pass raw addresses for any token
Object.defineProperty(exports, "__esModule", { value: true });
exports.POPULAR_TOKENS = exports.NATIVE_AVAX = void 0;
exports.resolveToken = resolveToken;
exports.NATIVE_AVAX = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
exports.POPULAR_TOKENS = {
    AVAX: {
        address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX for routing
        decimals: 18,
        symbol: "AVAX",
        name: "Avalanche",
    },
    WAVAX: {
        address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        decimals: 18,
        symbol: "WAVAX",
        name: "Wrapped AVAX",
    },
    USDC: {
        address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
    },
    "USDC.e": {
        address: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664",
        decimals: 6,
        symbol: "USDC.e",
        name: "USD Coin (Bridged)",
    },
    USDT: {
        address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
        decimals: 6,
        symbol: "USDT",
        name: "Tether USD",
    },
    "USDT.e": {
        address: "0xc7198437980c041c805A1EDcbA50c1Ce5db95118",
        decimals: 6,
        symbol: "USDT.e",
        name: "Tether USD (Bridged)",
    },
    "BTC.b": {
        address: "0x152b9D0FDc40c096DE20232dB4820C92ee4c8123",
        decimals: 8,
        symbol: "BTC.b",
        name: "Bitcoin (Bridged)",
    },
    "WETH.e": {
        address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
        decimals: 18,
        symbol: "WETH.e",
        name: "Wrapped Ether (Bridged)",
    },
    sAVAX: {
        address: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE",
        decimals: 18,
        symbol: "sAVAX",
        name: "Staked AVAX (Benqi)",
    },
    JOE: {
        address: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
        decimals: 18,
        symbol: "JOE",
        name: "Trader Joe",
    },
    ARENA: {
        address: "0xB8d7710f7d8349A506b75dD184F05777c82dAd0C",
        decimals: 18,
        symbol: "ARENA",
        name: "Arena",
    },
    GMX: {
        address: "0x62edc0692BD897D2295872a9FFCac5425011c661",
        decimals: 18,
        symbol: "GMX",
        name: "GMX",
    },
    COQ: {
        address: "0x420fcA0121DC28039145e2B5f02790601f29c25e",
        decimals: 18,
        symbol: "COQ",
        name: "Coq Inu",
    },
    PHAR: {
        address: "0x13A466998Ce03Db73aBc2d4DF3bBD845Ed1f28E7",
        decimals: 18,
        symbol: "PHAR",
        name: "Pharaoh",
    },
};
/** Resolve a symbol or address to token info */
function resolveToken(input) {
    // Check by symbol first (case-insensitive)
    const upper = input.toUpperCase();
    if (exports.POPULAR_TOKENS[upper])
        return exports.POPULAR_TOKENS[upper];
    // Check case-sensitive keys (for USDC.e, BTC.b, etc.)
    for (const [key, info] of Object.entries(exports.POPULAR_TOKENS)) {
        if (key.toLowerCase() === input.toLowerCase())
            return info;
    }
    // Check by address
    for (const info of Object.values(exports.POPULAR_TOKENS)) {
        if (info.address.toLowerCase() === input.toLowerCase())
            return info;
    }
    // If it looks like an address, return it as unknown (decimals fetched on-chain)
    if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
        return null; // Caller should fetch on-chain
    }
    return null;
}
//# sourceMappingURL=tokens.js.map