import { ethers } from "ethers";
import {
  LAUNCH_CONTRACT, TOKEN_MANAGER, AVAX_HELPER,
  LAUNCH_CONTRACT_ABI, TOKEN_MANAGER_ABI, AVAX_HELPER_ABI,
  ARENA_PAIRED_THRESHOLD, GRANULARITY_SCALER,
} from "../core/constants";

export function createLaunchpadContracts(provider: ethers.JsonRpcProvider) {
  return {
    launchContract: new ethers.Contract(ethers.getAddress(LAUNCH_CONTRACT), LAUNCH_CONTRACT_ABI, provider),
    tokenManager: new ethers.Contract(ethers.getAddress(TOKEN_MANAGER), TOKEN_MANAGER_ABI, provider),
    avaxHelper: new ethers.Contract(ethers.getAddress(AVAX_HELPER), AVAX_HELPER_ABI, provider),
  };
}

export function isArenaPaired(tokenId: string): boolean {
  return BigInt(tokenId) >= ARENA_PAIRED_THRESHOLD;
}

export function getContract(
  tokenId: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
): ethers.Contract {
  return isArenaPaired(tokenId) ? tokenManager : launchContract;
}

/** Binary search: find max tokens purchasable with given AVAX budget (AVAX-paired only) */
export async function binarySearchTokenAmount(
  launchContract: ethers.Contract,
  avaxBudgetWei: bigint,
  tokenId: bigint,
): Promise<bigint> {
  let maxForSale: bigint;
  try {
    maxForSale = await launchContract.getMaxTokensForSale(tokenId);
  } catch {
    maxForSale = 100_000_000n * GRANULARITY_SCALER;
  }
  const maxWhole = maxForSale / GRANULARITY_SCALER;
  if (maxWhole <= 0n) return 0n;

  let lo = 1n;
  let hi = maxWhole;
  let best = 0n;

  for (let i = 0; i < 30 && lo <= hi; i++) {
    const mid = (lo + hi) / 2n;
    try {
      const cost: bigint = await launchContract.calculateCostWithFees(mid, tokenId);
      if (cost <= avaxBudgetWei) {
        best = mid;
        lo = mid + 1n;
      } else {
        hi = mid - 1n;
      }
    } catch {
      hi = mid - 1n;
    }
  }

  return best > 0n ? best * GRANULARITY_SCALER : 0n;
}
