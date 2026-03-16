import { ethers } from "ethers";
import crypto from "crypto";
import type { UnsignedTx } from "../core/types";
import {
  LAUNCH_CONTRACT, TOKEN_MANAGER,
  LAUNCH_CONTRACT_ABI, TOKEN_MANAGER_ABI,
  ARENA_SOCIAL_API, ARENA_GCS_BUCKET, ARENA_STATIC_URL,
  ARENA_CURVE_A, ARENA_CURVE_B, ARENA_CURVE_SCALER,
  AVAX_CURVE_A, AVAX_CURVE_B, AVAX_CURVE_SCALER,
  DEFAULT_CREATOR_FEE_BP, DEFAULT_TOKEN_SPLIT,
} from "../core/constants";

// Arena JWT for authenticated endpoints (create-community, upload)
const ARENA_JWT = process.env.ARENA_JWT || "";

// ─── Arena Social API: Image Upload ───

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
export async function getUploadPolicy(fileType: string, fileName: string): Promise<UploadPolicy> {
  const url = `${ARENA_SOCIAL_API}/uploads/getUploadPolicy?fileType=${encodeURIComponent(fileType)}&fileName=${encodeURIComponent(fileName)}`;
  const headers: Record<string, string> = {
    "accept": "application/json",
    "origin": "https://arena.social",
    "referer": "https://arena.social/",
  };
  if (ARENA_JWT) headers["authorization"] = `Bearer ${ARENA_JWT}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Arena upload policy failed: ${res.status}`);
  const data = await res.json() as { uploadPolicy: UploadPolicy };
  return data.uploadPolicy;
}

/** Upload an image buffer to Arena's GCS bucket using a signed policy */
export async function uploadImageToGCS(imageBuffer: Buffer, fileType: string, policy: UploadPolicy): Promise<string> {
  const boundary = `----FormBoundary${crypto.randomBytes(8).toString("hex")}`;

  const fields: Record<string, string> = {
    key: policy.key,
    "x-goog-date": policy["x-goog-date"],
    "x-goog-credential": policy["x-goog-credential"],
    "x-goog-algorithm": policy["x-goog-algorithm"],
    policy: policy.policy,
    "x-goog-signature": policy["x-goog-signature"],
  };

  // Build multipart form data manually
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ));
  }

  // Add file field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image"\r\nContent-Type: ${fileType}\r\n\r\n`
  ));
  parts.push(imageBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await fetch(ARENA_GCS_BUCKET, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length.toString(),
      "Origin": "https://arena.social",
      "Referer": "https://arena.social/",
    },
    body,
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`GCS upload failed: ${res.status} ${text}`);
  }

  // Image URL: static.starsarena.com/<key>
  return `${ARENA_STATIC_URL}${policy.key}`;
}

/** Upload an image (from base64 or URL) and return the Arena-hosted image URL */
export async function uploadTokenImage(imageBase64: string, fileType = "image/jpeg"): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const ext = fileType === "image/png" ? "png" : "jpeg";
  const fileName = `${crypto.randomUUID()}.${ext}`;

  const policy = await getUploadPolicy(fileType, fileName);
  const imageUrl = await uploadImageToGCS(imageBuffer, fileType, policy);
  return imageUrl;
}

// ─── Arena Social API: Create Community ───

interface CreateCommunityParams {
  name: string;
  ticker: string;
  tokenName: string;
  photoURL: string;
  address: string; // creator wallet
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
export async function createArenaCommunity(params: CreateCommunityParams): Promise<ArenaCommunity> {
  const body = {
    name: params.name,
    photoURL: params.photoURL,
    ticker: params.ticker,
    tokenName: params.tokenName,
    whitelist: {
      includedCommunities: [],
      includesCSV: false,
      startDate: Math.floor(Date.now() / 1000) + 300, // 5 min from now
      duration: 1800,
      maxAllocation: 50000000,
      transactionLimitEnabled: false,
      walletCount: 0,
      addresses: "",
    },
    address: params.address,
    paymentToken: params.paymentToken,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "https://arena.social",
    "Referer": "https://arena.social/",
  };
  if (ARENA_JWT) headers["authorization"] = `Bearer ${ARENA_JWT}`;

  const res = await fetch(`${ARENA_SOCIAL_API}/communities/create-community`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Arena create-community failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { community: ArenaCommunity };
  return data.community;
}

// ─── Build createToken Transaction ───

export interface LaunchTokenParams {
  wallet: string;
  name: string;
  symbol: string;
  paymentToken: "avax" | "arena";
  initialBuyAmount?: string; // AVAX amount for initial buy (0 = none)
}

export interface LaunchResult {
  community: ArenaCommunity;
  imageUrl: string;
  transaction: UnsignedTx;
  nextTokenId: string;
}

/** Build the unsigned createToken transaction */
export function buildCreateTokenTx(
  wallet: string,
  name: string,
  symbol: string,
  paymentToken: "avax" | "arena",
  initialBuyAmount = "0",
): UnsignedTx {
  const isArena = paymentToken === "arena";
  const curveA = isArena ? ARENA_CURVE_A : AVAX_CURVE_A;
  const curveB = isArena ? ARENA_CURVE_B : AVAX_CURVE_B;
  const curveScaler = isArena ? ARENA_CURVE_SCALER : AVAX_CURVE_SCALER;
  const contractAddr = isArena ? TOKEN_MANAGER : LAUNCH_CONTRACT;
  const abi = isArena ? TOKEN_MANAGER_ABI : LAUNCH_CONTRACT_ABI;

  const iface = new ethers.Interface(abi);
  const initialBuy = initialBuyAmount !== "0" ? ethers.parseEther(initialBuyAmount) : 0n;

  const data = iface.encodeFunctionData("createToken", [
    curveA,
    curveB,
    curveScaler,
    DEFAULT_CREATOR_FEE_BP,
    wallet, // creator address
    DEFAULT_TOKEN_SPLIT,
    name,
    symbol,
    initialBuy,
  ]);

  // For AVAX-paired with initial buy, need to send AVAX value
  const value = !isArena && initialBuy > 0n ? ethers.toBeHex(initialBuy, 32) : "0x0";

  return {
    to: ethers.getAddress(contractAddr),
    data,
    value,
    chainId: 43114,
    gas: "600000",
    gasLimit: "600000",
    description: `Create token "${name}" ($${symbol}) on Arena [${paymentToken.toUpperCase()}-paired]`,
  };
}

/** Get the next token ID that will be assigned */
export async function getNextTokenId(
  provider: ethers.JsonRpcProvider,
  paymentToken: "avax" | "arena",
): Promise<string> {
  const isArena = paymentToken === "arena";
  const contractAddr = isArena ? TOKEN_MANAGER : LAUNCH_CONTRACT;
  const abi = isArena ? TOKEN_MANAGER_ABI : LAUNCH_CONTRACT_ABI;
  const contract = new ethers.Contract(ethers.getAddress(contractAddr), abi, provider);
  const id = await contract.tokenIdentifier();
  return id.toString();
}
