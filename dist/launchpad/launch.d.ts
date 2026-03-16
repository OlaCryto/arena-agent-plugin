import { ethers } from "ethers";
import type { UnsignedTx } from "../core/types";
interface UploadPolicy {
    url: string;
    enctype: string;
    key: string;
    "x-goog-date": string;
    "x-goog-credential": string;
    "x-goog-algorithm": string;
    policy: string;
    "x-goog-signature": string;
}
/** Get a signed upload policy from Arena's backend */
export declare function getUploadPolicy(fileType: string, fileName: string): Promise<UploadPolicy>;
/** Upload an image buffer to Arena's GCS bucket using a signed policy */
export declare function uploadImageToGCS(imageBuffer: Buffer, fileType: string, policy: UploadPolicy): Promise<string>;
/** Upload an image (from base64 or URL) and return the Arena-hosted image URL */
export declare function uploadTokenImage(imageBase64: string, fileType?: string): Promise<string>;
interface CreateCommunityParams {
    name: string;
    ticker: string;
    tokenName: string;
    photoURL: string;
    address: string;
    paymentToken: "avax" | "arena";
}
interface ArenaCommunity {
    id: string;
    signer: string;
    isTemporary: boolean;
    name: string;
    tokenName: string;
    ticker: string;
    photoURL: string;
    paymentToken: string;
    contractAddress: string | null;
    createdOn: string;
}
/** Create a temporary community on Arena's backend (pre on-chain creation) */
export declare function createArenaCommunity(params: CreateCommunityParams): Promise<ArenaCommunity>;
export interface LaunchTokenParams {
    wallet: string;
    name: string;
    symbol: string;
    paymentToken: "avax" | "arena";
    initialBuyAmount?: string;
}
export interface LaunchResult {
    community: ArenaCommunity;
    imageUrl: string;
    transaction: UnsignedTx;
    nextTokenId: string;
}
/** Build the unsigned createToken transaction */
export declare function buildCreateTokenTx(wallet: string, name: string, symbol: string, paymentToken: "avax" | "arena", initialBuyAmount?: string): UnsignedTx;
/** Get the next token ID that will be assigned */
export declare function getNextTokenId(provider: ethers.JsonRpcProvider, paymentToken: "avax" | "arena"): Promise<string>;
export {};
//# sourceMappingURL=launch.d.ts.map