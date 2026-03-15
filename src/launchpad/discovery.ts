import { ethers } from "ethers";
import {
  ERC20_ABI,
  LAUNCH_CONTRACT, TOKEN_MANAGER, AVAX_HELPER,
  ARENA_PAIRED_THRESHOLD,
} from "../core/constants";
import { isArenaPaired, getContract } from "./helpers";

export async function getRecentLaunches(
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  count = 10,
  type: "all" | "avax" | "arena" = "all",
) {
  const results: any[] = [];

  const fetchToken = async (id: bigint, contract: ethers.Contract, pairType: string) => {
    try {
      const params = await contract.getTokenParameters(id);
      if (params.tokenContractAddress === ethers.ZeroAddress) return null;
      const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, provider);
      let name = "Unknown", symbol = "UNKNOWN";
      try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}
      const supply: bigint = await contract.tokenSupply(id);
      const maxForSale: bigint = await contract.getMaxTokensForSale(id);
      const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
      const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
      const gradProgress = saleAlloc > 0n ? Number((sold * 10000n) / saleAlloc) / 100 : 0;
      return {
        tokenId: id.toString(),
        type: pairType,
        name, symbol,
        tokenAddress: params.tokenContractAddress,
        creator: params.creatorAddress,
        graduated: params.lpDeployed,
        graduationProgress: `${gradProgress.toFixed(2)}%`,
        amountSold: ethers.formatUnits(sold, 18),
      };
    } catch { return null; }
  };

  if (type === "all" || type === "avax") {
    const latestAvax: bigint = await launchContract.tokenIdentifier();
    const avaxCount = type === "all" ? Math.ceil(count / 2) : count;
    const avaxPromises = [];
    for (let i = 0; i < avaxCount && latestAvax - BigInt(i) > 0n; i++) {
      avaxPromises.push(fetchToken(latestAvax - BigInt(i) - 1n, launchContract, "AVAX-paired"));
    }
    results.push(...(await Promise.all(avaxPromises)).filter(Boolean));
  }

  if (type === "all" || type === "arena") {
    const latestArena: bigint = await tokenManager.tokenIdentifier();
    const arenaCount = type === "all" ? Math.ceil(count / 2) : count;
    const arenaPromises = [];
    for (let i = 0; i < arenaCount && latestArena - BigInt(i) >= ARENA_PAIRED_THRESHOLD; i++) {
      arenaPromises.push(fetchToken(latestArena - BigInt(i) - 1n, tokenManager, "ARENA-paired"));
    }
    results.push(...(await Promise.all(arenaPromises)).filter(Boolean));
  }

  return results.slice(0, count);
}

export async function searchToken(
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  query: string,
  getTokenInfo: (tokenId: string) => Promise<any>,
) {
  const searchContract = async (contract: ethers.Contract, label: string) => {
    const latest: bigint = await contract.tokenIdentifier();
    const start = label === "ARENA-paired" ? ARENA_PAIRED_THRESHOLD : 1n;
    for (let id = latest - 1n; id >= start && id >= latest - 200n; id--) {
      try {
        const params = await contract.getTokenParameters(id);
        if (params.tokenContractAddress.toLowerCase() === query.toLowerCase()) {
          return id.toString();
        }
      } catch { continue; }
    }
    return null;
  };

  const [avaxResult, arenaResult] = await Promise.all([
    searchContract(launchContract, "AVAX-paired"),
    searchContract(tokenManager, "ARENA-paired"),
  ]);

  const foundId = avaxResult || arenaResult;
  if (!foundId) throw new Error(`Token not found for address ${query} in recent launches`);
  return getTokenInfo(foundId);
}

export async function getGraduating(
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  count = 5,
) {
  const candidates: { tokenId: string; progress: number; info: any }[] = [];

  const checkBatch = async (contract: ethers.Contract, label: string) => {
    const latest: bigint = await contract.tokenIdentifier();
    const start = label === "ARENA-paired" ? ARENA_PAIRED_THRESHOLD : 1n;
    const promises = [];
    for (let i = 0; i < 100 && latest - BigInt(i) - 1n >= start; i++) {
      const id = latest - BigInt(i) - 1n;
      promises.push((async () => {
        try {
          const params = await contract.getTokenParameters(id);
          if (params.lpDeployed) return null;
          const supply: bigint = await contract.tokenSupply(id);
          const maxForSale: bigint = await contract.getMaxTokensForSale(id);
          const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
          if (saleAlloc === 0n) return null;
          const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
          const progress = Number((sold * 10000n) / saleAlloc) / 100;
          if (progress < 0.5) return null;
          const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, provider);
          let name = "Unknown", symbol = "UNKNOWN";
          try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}
          return { tokenId: id.toString(), progress, info: { name, symbol, type: label, tokenAddress: params.tokenContractAddress, graduationProgress: `${progress.toFixed(2)}%`, amountSold: ethers.formatUnits(sold, 18) } };
        } catch { return null; }
      })());
    }
    return (await Promise.all(promises)).filter(Boolean) as typeof candidates;
  };

  const [avax, arena] = await Promise.all([
    checkBatch(launchContract, "AVAX-paired"),
    checkBatch(tokenManager, "ARENA-paired"),
  ]);

  candidates.push(...avax, ...arena);
  candidates.sort((a, b) => b.progress - a.progress);
  return candidates.slice(0, count).map(c => ({ ...c.info, tokenId: c.tokenId }));
}

export async function getOverview(
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
) {
  const [avaxLatest, arenaLatest, protocolFeeAvax, protocolFeeArena] = await Promise.all([
    launchContract.tokenIdentifier(),
    tokenManager.tokenIdentifier(),
    launchContract.protocolFeeBasisPoint(),
    tokenManager.protocolFeeBasisPoint(),
  ]);

  return {
    totalAvaxPairedTokens: (avaxLatest - 1n).toString(),
    totalArenaPairedTokens: (arenaLatest - ARENA_PAIRED_THRESHOLD).toString(),
    totalTokens: ((avaxLatest - 1n) + (arenaLatest - ARENA_PAIRED_THRESHOLD)).toString(),
    protocolFeeBps: {
      avaxPaired: protocolFeeAvax.toString(),
      arenaPaired: protocolFeeArena.toString(),
    },
    contracts: {
      launchContract: LAUNCH_CONTRACT,
      tokenManager: TOKEN_MANAGER,
      avaxHelper: AVAX_HELPER,
    },
  };
}
