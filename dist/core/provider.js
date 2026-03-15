"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
exports.broadcast = broadcast;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ethers_1 = require("ethers");
const constants_1 = require("./constants");
function createProvider(rpcUrl) {
    const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl || constants_1.RPC_URL, undefined, {
        staticNetwork: true,
        batchMaxCount: 1,
    });
    provider.pollingInterval = 60000;
    return provider;
}
async function broadcast(provider, signedTx) {
    const tx = await provider.broadcastTransaction(signedTx);
    return tx.hash;
}
//# sourceMappingURL=provider.js.map