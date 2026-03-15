import { ethers } from "ethers";
import { ERC20_ABI, GRANULARITY_SCALER } from "../core/constants";
import { isArenaPaired, getContract, binarySearchTokenAmount } from "./helpers";

export async function getTokenInfo(
  tokenId: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
) {
  const contract = getContract(tokenId, launchContract, tokenManager);
  const id = BigInt(tokenId);
  const arenaPaired = isArenaPaired(tokenId);

  const [params, supply, maxForSale] = await Promise.all([
    contract.getTokenParameters(id),
    contract.tokenSupply(id),
    contract.getMaxTokensForSale(id),
  ]);

  const tokenAddress = params.tokenContractAddress;
  if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  let name = "Unknown", symbol = "UNKNOWN";
  try {
    [name, symbol] = await Promise.all([token.name(), token.symbol()]);
  } catch {}

  let priceAvax = "0";
  const graduated = params.lpDeployed;
  if (!graduated) {
    try {
      const costOf1: bigint = await contract.calculateCostWithFees(1n, id);
      priceAvax = ethers.formatEther(costOf1);
    } catch {}
  }

  const salePerc = BigInt(params.salePercentage);
  const saleAllocation = (supply * salePerc) / 100n;
  const amountSold = saleAllocation > maxForSale ? saleAllocation - maxForSale : 0n;

  const soldWhole = Number(amountSold / GRANULARITY_SCALER);
  const priceNum = parseFloat(priceAvax);
  const marketCap = soldWhole * priceNum;

  const graduationProgress = saleAllocation > 0n
    ? Number((amountSold * 10000n) / saleAllocation) / 100
    : 0;

  return {
    tokenId,
    type: arenaPaired ? "ARENA-paired" : "AVAX-paired",
    name,
    symbol,
    tokenAddress,
    creator: params.creatorAddress,
    priceAvax,
    marketCapAvax: marketCap.toFixed(4),
    graduationProgress: `${graduationProgress.toFixed(2)}%`,
    graduated,
    amountSold: ethers.formatUnits(amountSold, 18),
    totalSupply: ethers.formatUnits(supply, 18),
    saleAllocation: ethers.formatUnits(saleAllocation, 18),
    remainingForSale: ethers.formatUnits(maxForSale, 18),
    curveParams: {
      a: params.a.toString(),
      b: params.b.toString(),
      curveScaler: params.curveScaler.toString(),
    },
    creatorFeeBps: params.creatorFeeBasisPoints.toString(),
    lpPercentage: params.lpPercentage.toString(),
    salePercentage: params.salePercentage.toString(),
  };
}

export async function getTokenQuote(
  tokenId: string,
  amount: string,
  side: "buy" | "sell",
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
) {
  const contract = getContract(tokenId, launchContract, tokenManager);
  const id = BigInt(tokenId);
  const arenaPaired = isArenaPaired(tokenId);

  if (side === "buy") {
    const avaxWei = ethers.parseEther(amount);
    if (!arenaPaired) {
      const tokenAmountWei = await binarySearchTokenAmount(launchContract, avaxWei, id);
      if (tokenAmountWei === 0n) return { tokenId, side, avaxIn: amount, tokensOut: "0", note: "Insufficient liquidity or token sold out" };
      const exactCost: bigint = await launchContract.calculateCostWithFees(tokenAmountWei / GRANULARITY_SCALER, id);
      return {
        tokenId, side,
        avaxIn: ethers.formatEther(exactCost),
        tokensOut: ethers.formatUnits(tokenAmountWei, 18),
      };
    } else {
      return {
        tokenId, side,
        avaxIn: amount,
        tokensOut: "determined at execution (ARENA-paired, helper converts automatically)",
      };
    }
  } else {
    const tokenAmountWei = ethers.parseUnits(amount, 18);
    const reward: bigint = await contract.calculateRewardWithFees(tokenAmountWei, id);
    return {
      tokenId, side,
      tokenAmount: amount,
      rewardAvax: arenaPaired ? undefined : ethers.formatEther(reward),
      rewardArena: arenaPaired ? ethers.formatUnits(reward, 18) : undefined,
      note: arenaPaired ? "Reward is in ARENA. Use AVAX Helper to convert to AVAX." : undefined,
    };
  }
}

export async function getTokenBalance(
  wallet: string,
  tokenId: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
) {
  const contract = getContract(tokenId, launchContract, tokenManager);
  const params = await contract.getTokenParameters(BigInt(tokenId));
  const tokenAddress = params.tokenContractAddress;
  if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance: bigint = await token.balanceOf(wallet);
  return {
    wallet,
    tokenId,
    tokenAddress,
    balance: ethers.formatUnits(balance, 18),
  };
}

export async function getPortfolio(
  wallet: string,
  tokenIds: number[],
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
) {
  if (tokenIds.length === 0) return { wallet, positions: [], totalValueAvax: "0" };

  const positions: any[] = [];
  let totalValue = 0;

  const checks = tokenIds.map(async (tid) => {
    try {
      const tokenId = tid.toString();
      const contract = getContract(tokenId, launchContract, tokenManager);
      const params = await contract.getTokenParameters(BigInt(tokenId));
      if (params.tokenContractAddress === ethers.ZeroAddress) return null;

      const token = new ethers.Contract(params.tokenContractAddress, ERC20_ABI, provider);
      const balance: bigint = await token.balanceOf(wallet);
      if (balance === 0n) return null;

      let name = "Unknown", symbol = "UNKNOWN";
      try { [name, symbol] = await Promise.all([token.name(), token.symbol()]); } catch {}

      let valueAvax = "0";
      if (!params.lpDeployed) {
        try {
          const reward: bigint = await contract.calculateRewardWithFees(balance, BigInt(tokenId));
          valueAvax = ethers.formatEther(reward);
        } catch {}
      }

      return {
        tokenId, name, symbol,
        tokenAddress: params.tokenContractAddress,
        balance: ethers.formatUnits(balance, 18),
        valueAvax,
        graduated: params.lpDeployed,
      };
    } catch { return null; }
  });

  const results = (await Promise.all(checks)).filter(Boolean);
  for (const pos of results) {
    positions.push(pos);
    totalValue += parseFloat(pos!.valueAvax);
  }

  return { wallet, positions, totalValueAvax: totalValue.toFixed(6) };
}

export async function getActivity(
  tokenId: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  count = 20,
) {
  const contract = getContract(tokenId, launchContract, tokenManager);
  const id = BigInt(tokenId);
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 5000);

  const [buyEvents, sellEvents] = await Promise.all([
    contract.queryFilter(contract.filters.Buy(null, id), fromBlock, currentBlock),
    contract.queryFilter(contract.filters.Sell(null, id), fromBlock, currentBlock),
  ]);

  const arenaPaired = isArenaPaired(tokenId);
  const formatAmount = (v: bigint) => arenaPaired ? ethers.formatUnits(v, 18) : ethers.formatEther(v);

  const events = [
    ...buyEvents.map((e: any) => ({
      type: "buy",
      user: e.args.user,
      tokenAmount: ethers.formatUnits(e.args.tokenAmount, 18),
      cost: formatAmount(e.args.cost),
      block: e.blockNumber,
    })),
    ...sellEvents.map((e: any) => ({
      type: "sell",
      user: e.args.user,
      tokenAmount: ethers.formatUnits(e.args.tokenAmount, 18),
      reward: formatAmount(e.args.reward),
      block: e.blockNumber,
    })),
  ];

  events.sort((a, b) => b.block - a.block);
  return { tokenId, events: events.slice(0, count) };
}

export async function getMarketCap(
  tokenId: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
) {
  const info = await getTokenInfo(tokenId, launchContract, tokenManager, provider);
  return {
    tokenId,
    name: info.name,
    symbol: info.symbol,
    priceAvax: info.priceAvax,
    marketCapAvax: info.marketCapAvax,
    amountSold: info.amountSold,
    graduated: info.graduated,
    graduationProgress: info.graduationProgress,
  };
}
