import { ethers } from "ethers";
export declare function createProvider(rpcUrl?: string): ethers.JsonRpcProvider;
export declare function broadcast(provider: ethers.JsonRpcProvider, signedTx: string): Promise<string>;
//# sourceMappingURL=provider.d.ts.map