export declare const openapiSpec: {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
    };
    servers: {
        url: string;
    }[];
    paths: {
        "/health": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        status: {
                                            type: string;
                                        };
                                        wallet: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/balances": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        avax: {
                                            type: string;
                                        };
                                        arena: {
                                            type: string;
                                        };
                                        wallet: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/quote": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        avaxIn: {
                                            type: string;
                                        };
                                        arenaOut: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/buy": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        txHash: {
                                            type: string;
                                        };
                                        amountIn: {
                                            type: string;
                                        };
                                        amountOut: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/stake": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        approveTxHash: {
                                            type: string;
                                        };
                                        stakeTxHash: {
                                            type: string;
                                        };
                                        amountStaked: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/stake/info": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        stakedAmount: {
                                            type: string;
                                        };
                                        pendingRewards: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/buy-and-stake": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        buy: {
                                            type: string;
                                            properties: {
                                                txHash: {
                                                    type: string;
                                                };
                                                amountIn: {
                                                    type: string;
                                                };
                                                amountOut: {
                                                    type: string;
                                                };
                                            };
                                        };
                                        stake: {
                                            type: string;
                                            properties: {
                                                approveTxHash: {
                                                    type: string;
                                                };
                                                stakeTxHash: {
                                                    type: string;
                                                };
                                                amountStaked: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        "/unstake": {
            get: {
                operationId: string;
                summary: string;
                description: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                    description: string;
                }[];
                responses: {
                    "200": {
                        description: string;
                        content: {
                            "application/json": {
                                schema: {
                                    type: string;
                                    properties: {
                                        txHash: {
                                            type: string;
                                        };
                                        amountWithdrawn: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
};
//# sourceMappingURL=openapi.d.ts.map