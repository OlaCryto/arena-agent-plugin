"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadPolicy = getUploadPolicy;
exports.uploadImageToGCS = uploadImageToGCS;
exports.uploadTokenImage = uploadTokenImage;
exports.createArenaCommunity = createArenaCommunity;
exports.buildCreateTokenTx = buildCreateTokenTx;
exports.getNextTokenId = getNextTokenId;
const ethers_1 = require("ethers");
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("../core/constants");
// Arena JWT for authenticated endpoints (create-community, upload)
const ARENA_JWT = process.env.ARENA_JWT || "";
/** Get a signed upload policy from Arena's backend */
async function getUploadPolicy(fileType, fileName) {
    const url = `${constants_1.ARENA_SOCIAL_API}/uploads/getUploadPolicy?fileType=${encodeURIComponent(fileType)}&fileName=${encodeURIComponent(fileName)}`;
    const headers = {
        "accept": "application/json",
        "origin": "https://arena.social",
        "referer": "https://arena.social/",
    };
    if (ARENA_JWT)
        headers["authorization"] = `Bearer ${ARENA_JWT}`;
    const res = await fetch(url, { headers });
    if (!res.ok)
        throw new Error(`Arena upload policy failed: ${res.status}`);
    const data = await res.json();
    return data.uploadPolicy;
}
/** Upload an image buffer to Arena's GCS bucket using a signed policy */
async function uploadImageToGCS(imageBuffer, fileType, policy) {
    const boundary = `----FormBoundary${crypto_1.default.randomBytes(8).toString("hex")}`;
    const fields = {
        key: policy.key,
        "x-goog-date": policy["x-goog-date"],
        "x-goog-credential": policy["x-goog-credential"],
        "x-goog-algorithm": policy["x-goog-algorithm"],
        policy: policy.policy,
        "x-goog-signature": policy["x-goog-signature"],
    };
    // Build multipart form data manually
    const parts = [];
    for (const [name, value] of Object.entries(fields)) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    // Add file field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image"\r\nContent-Type: ${fileType}\r\n\r\n`));
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);
    const res = await fetch(constants_1.ARENA_GCS_BUCKET, {
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
    return `${constants_1.ARENA_STATIC_URL}${policy.key}`;
}
/** Upload an image (from base64 or URL) and return the Arena-hosted image URL */
async function uploadTokenImage(imageBase64, fileType = "image/jpeg") {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = fileType === "image/png" ? "png" : "jpeg";
    const fileName = `${crypto_1.default.randomUUID()}.${ext}`;
    const policy = await getUploadPolicy(fileType, fileName);
    const imageUrl = await uploadImageToGCS(imageBuffer, fileType, policy);
    return imageUrl;
}
/** Create a temporary community on Arena's backend (pre on-chain creation) */
async function createArenaCommunity(params) {
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
    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://arena.social",
        "Referer": "https://arena.social/",
    };
    if (ARENA_JWT)
        headers["authorization"] = `Bearer ${ARENA_JWT}`;
    const res = await fetch(`${constants_1.ARENA_SOCIAL_API}/communities/create-community`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Arena create-community failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data.community;
}
/** Build the unsigned createToken transaction */
function buildCreateTokenTx(wallet, name, symbol, paymentToken, initialBuyAmount = "0") {
    const isArena = paymentToken === "arena";
    const curveA = isArena ? constants_1.ARENA_CURVE_A : constants_1.AVAX_CURVE_A;
    const curveB = isArena ? constants_1.ARENA_CURVE_B : constants_1.AVAX_CURVE_B;
    const curveScaler = isArena ? constants_1.ARENA_CURVE_SCALER : constants_1.AVAX_CURVE_SCALER;
    const contractAddr = isArena ? constants_1.TOKEN_MANAGER : constants_1.LAUNCH_CONTRACT;
    const abi = isArena ? constants_1.TOKEN_MANAGER_ABI : constants_1.LAUNCH_CONTRACT_ABI;
    const iface = new ethers_1.ethers.Interface(abi);
    const initialBuy = initialBuyAmount !== "0" ? ethers_1.ethers.parseEther(initialBuyAmount) : 0n;
    const data = iface.encodeFunctionData("createToken", [
        curveA,
        curveB,
        curveScaler,
        constants_1.DEFAULT_CREATOR_FEE_BP,
        wallet, // creator address
        constants_1.DEFAULT_TOKEN_SPLIT,
        name,
        symbol,
        initialBuy,
    ]);
    // For AVAX-paired with initial buy, need to send AVAX value
    const value = !isArena && initialBuy > 0n ? ethers_1.ethers.toBeHex(initialBuy, 32) : "0x0";
    return {
        to: ethers_1.ethers.getAddress(contractAddr),
        data,
        value,
        chainId: 43114,
        gas: "600000",
        gasLimit: "600000",
        description: `Create token "${name}" ($${symbol}) on Arena [${paymentToken.toUpperCase()}-paired]`,
    };
}
/** Get the next token ID that will be assigned */
async function getNextTokenId(provider, paymentToken) {
    const isArena = paymentToken === "arena";
    const contractAddr = isArena ? constants_1.TOKEN_MANAGER : constants_1.LAUNCH_CONTRACT;
    const abi = isArena ? constants_1.TOKEN_MANAGER_ABI : constants_1.LAUNCH_CONTRACT_ABI;
    const contract = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(contractAddr), abi, provider);
    const id = await contract.tokenIdentifier();
    return id.toString();
}
//# sourceMappingURL=launch.js.map