"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openapiSpec = void 0;
exports.openapiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Arena Agent Plugin",
        description: "Buy and stake ARENA tokens on Avalanche via LFJ DEX. Provides endpoints for AI agents to interact with The Arena SocialFi platform.",
        version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000" }],
    paths: {
        "/health": {
            get: {
                operationId: "healthCheck",
                summary: "Health check",
                description: "Returns server status and wallet address.",
                responses: {
                    "200": {
                        description: "OK",
                        content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, wallet: { type: "string" } } } } },
                    },
                },
            },
        },
        "/balances": {
            get: {
                operationId: "getBalances",
                summary: "Get wallet balances",
                description: "Returns the agent wallet's AVAX and ARENA token balances.",
                responses: {
                    "200": {
                        description: "Balances",
                        content: { "application/json": { schema: { type: "object", properties: { avax: { type: "string" }, arena: { type: "string" }, wallet: { type: "string" } } } } },
                    },
                },
            },
        },
        "/quote": {
            get: {
                operationId: "getQuote",
                summary: "Get ARENA buy quote",
                description: "Returns how much ARENA you would receive for a given amount of AVAX. Does not execute a trade.",
                parameters: [
                    { name: "avax", in: "query", required: true, schema: { type: "string" }, description: "Amount of AVAX to quote (e.g. '0.1')" },
                ],
                responses: {
                    "200": {
                        description: "Quote",
                        content: { "application/json": { schema: { type: "object", properties: { avaxIn: { type: "string" }, arenaOut: { type: "string" } } } } },
                    },
                },
            },
        },
        "/buy": {
            get: {
                operationId: "buyArena",
                summary: "Buy ARENA with AVAX",
                description: "Swaps AVAX for ARENA tokens via LFJ (Trader Joe) DEX on Avalanche.",
                parameters: [
                    { name: "avax", in: "query", required: true, schema: { type: "string" }, description: "Amount of AVAX to spend (e.g. '0.1')" },
                    { name: "slippage", in: "query", required: false, schema: { type: "string" }, description: "Slippage tolerance in basis points (default 100 = 1%)" },
                ],
                responses: {
                    "200": {
                        description: "Buy result",
                        content: { "application/json": { schema: { type: "object", properties: { txHash: { type: "string" }, amountIn: { type: "string" }, amountOut: { type: "string" } } } } },
                    },
                },
            },
        },
        "/stake": {
            get: {
                operationId: "stakeArena",
                summary: "Stake ARENA tokens",
                description: "Stakes ARENA tokens into the Arena staking contract. Handles approval automatically. Use amount='max' to stake entire balance.",
                parameters: [
                    { name: "amount", in: "query", required: true, schema: { type: "string" }, description: "Amount of ARENA to stake, or 'max' for entire balance" },
                ],
                responses: {
                    "200": {
                        description: "Stake result",
                        content: { "application/json": { schema: { type: "object", properties: { approveTxHash: { type: "string" }, stakeTxHash: { type: "string" }, amountStaked: { type: "string" } } } } },
                    },
                },
            },
        },
        "/stake/info": {
            get: {
                operationId: "getStakeInfo",
                summary: "Get staking position info",
                description: "Returns the amount of ARENA currently staked and any pending rewards.",
                responses: {
                    "200": {
                        description: "Stake info",
                        content: { "application/json": { schema: { type: "object", properties: { stakedAmount: { type: "string" }, pendingRewards: { type: "string" } } } } },
                    },
                },
            },
        },
        "/buy-and-stake": {
            get: {
                operationId: "buyAndStakeArena",
                summary: "Buy ARENA and stake in one call",
                description: "Buys ARENA with AVAX via LFJ DEX, then immediately stakes all purchased ARENA into the Arena staking contract.",
                parameters: [
                    { name: "avax", in: "query", required: true, schema: { type: "string" }, description: "Amount of AVAX to spend (e.g. '0.1')" },
                    { name: "slippage", in: "query", required: false, schema: { type: "string" }, description: "Slippage tolerance in basis points (default 100 = 1%)" },
                ],
                responses: {
                    "200": {
                        description: "Buy and stake result",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        buy: { type: "object", properties: { txHash: { type: "string" }, amountIn: { type: "string" }, amountOut: { type: "string" } } },
                                        stake: { type: "object", properties: { approveTxHash: { type: "string" }, stakeTxHash: { type: "string" }, amountStaked: { type: "string" } } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/unstake": {
            get: {
                operationId: "unstakeArena",
                summary: "Unstake ARENA tokens",
                description: "Withdraws staked ARENA from the staking contract. Also claims any pending rewards. Use amount='max' to withdraw all.",
                parameters: [
                    { name: "amount", in: "query", required: true, schema: { type: "string" }, description: "Amount of ARENA to unstake, or 'max' for all" },
                ],
                responses: {
                    "200": {
                        description: "Unstake result",
                        content: { "application/json": { schema: { type: "object", properties: { txHash: { type: "string" }, amountWithdrawn: { type: "string" } } } } },
                    },
                },
            },
        },
    },
};
//# sourceMappingURL=openapi.js.map