import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { RPC_URL } from "./constants";

export function createProvider(rpcUrl?: string): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(rpcUrl || RPC_URL, undefined, {
    staticNetwork: true,
    batchMaxCount: 1,
  });
  provider.pollingInterval = 60_000;
  return provider;
}

export async function broadcast(provider: ethers.JsonRpcProvider, signedTx: string): Promise<string> {
  const tx = await provider.broadcastTransaction(signedTx);
  return tx.hash;
}
