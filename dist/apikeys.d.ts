interface ApiKeyEntry {
    key: string;
    name: string;
    wallet?: string;
    createdAt: string;
}
export declare function generateApiKey(name: string, wallet?: string): string;
export declare function validateApiKey(key: string): boolean;
export declare function listApiKeys(): Omit<ApiKeyEntry, "key">[];
export declare function revokeApiKey(name: string): boolean;
export {};
//# sourceMappingURL=apikeys.d.ts.map