import { ethers } from "ethers";
import {
  ERC20_ABI,
  LAUNCH_CONTRACT, AVAX_HELPER,
  LAUNCH_CONTRACT_ABI, AVAX_HELPER_ABI,
  GRANULARITY_SCALER, DEFAULT_SLIPPAGE_BPS,
} from "../core/constants";
import type { UnsignedTx } from "../core/types";
import { isArenaPaired, getContract, binarySearchTokenAmount } from "./helpers";

/** Build unsigned tx to buy a launchpad token */
export async function buildLaunchpadBuyTx(
  wallet: string,
  tokenId: string,
  avaxAmount: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<UnsignedTx> {
  const id = BigInt(tokenId);
  const avaxWei = ethers.parseEther(avaxAmount);
  const arenaPaired = isArenaPaired(tokenId);
  const contract = getContract(tokenId, launchContract, tokenManager);

  const params = await contract.getTokenParameters(id);
  if (params.lpDeployed) throw new Error("Token has graduated to DEX — trade on a DEX instead");

  if (!arenaPaired) {
    const tokenAmountWei = await binarySearchTokenAmount(launchContract, avaxWei, id);
    if (tokenAmountWei === 0n) throw new Error("Cannot calculate buy amount — token may be sold out");

    const iface = new ethers.Interface(LAUNCH_CONTRACT_ABI);
    const data = iface.encodeFunctionData("buyAndCreateLpIfPossible", [tokenAmountWei, id]);

    return {
      to: ethers.getAddress(LAUNCH_CONTRACT),
      data,
      value: ethers.toBeHex(avaxWei),
      chainId: 43114,
      gas: "500000",
      gasLimit: "500000",
      description: `Buy ~${ethers.formatUnits(tokenAmountWei, 18)} tokens (ID ${tokenId}) with ${avaxAmount} AVAX`,
    };
  } else {
    const iface = new ethers.Interface(AVAX_HELPER_ABI);
    const data = iface.encodeFunctionData("buyAndCreateLpIfPossibleWithAvax", [id, 0n]);

    return {
      to: ethers.getAddress(AVAX_HELPER),
      data,
      value: ethers.toBeHex(avaxWei),
      chainId: 43114,
      gas: "500000",
      gasLimit: "500000",
      description: `Buy tokens (ID ${tokenId}) with ${avaxAmount} AVAX via ARENA Helper`,
    };
  }
}

/** Build unsigned txs to sell a launchpad token: [approve, sell] */
export async function buildLaunchpadSellTx(
  wallet: string,
  tokenId: string,
  amount: string,
  launchContract: ethers.Contract,
  tokenManager: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<UnsignedTx[]> {
  const id = BigInt(tokenId);
  const arenaPaired = isArenaPaired(tokenId);
  const contract = getContract(tokenId, launchContract, tokenManager);

  const params = await contract.getTokenParameters(id);
  if (params.lpDeployed) throw new Error("Token has graduated to DEX — trade on a DEX instead");
  const tokenAddress = params.tokenContractAddress;
  if (tokenAddress === ethers.ZeroAddress) throw new Error(`Token ID ${tokenId} not found`);

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  let sellAmount: bigint;
  if (amount === "max") {
    sellAmount = await token.balanceOf(wallet);
  } else {
    sellAmount = ethers.parseUnits(amount, 18);
  }
  if (sellAmount === 0n) throw new Error("Zero balance — nothing to sell");

  if (!arenaPaired) {
    sellAmount = (sellAmount / GRANULARITY_SCALER) * GRANULARITY_SCALER;
    if (sellAmount === 0n) throw new Error("Balance too small to sell (must be at least 1 whole token unit)");
  }

  const spender = arenaPaired ? ethers.getAddress(AVAX_HELPER) : ethers.getAddress(LAUNCH_CONTRACT);

  const erc20Iface = new ethers.Interface(ERC20_ABI);
  const approveData = erc20Iface.encodeFunctionData("approve", [spender, ethers.MaxUint256]);
  const approveTx: UnsignedTx = {
    to: tokenAddress,
    data: approveData,
    value: "0",
    chainId: 43114,
    gas: "60000",
    gasLimit: "60000",
    description: `Step 1/2: Approve token for selling`,
  };

  let sellData: string;
  let sellTo: string;
  if (!arenaPaired) {
    const iface = new ethers.Interface(LAUNCH_CONTRACT_ABI);
    sellData = iface.encodeFunctionData("sell", [sellAmount, id]);
    sellTo = ethers.getAddress(LAUNCH_CONTRACT);
  } else {
    let minOut = 0n;
    try {
      const reward: bigint = await contract.calculateRewardWithFees(sellAmount, id);
      minOut = reward - (reward * BigInt(slippageBps)) / 10000n;
    } catch {}
    const iface = new ethers.Interface(AVAX_HELPER_ABI);
    sellData = iface.encodeFunctionData("sellToAvax", [id, sellAmount, minOut]);
    sellTo = ethers.getAddress(AVAX_HELPER);
  }

  const sellTx: UnsignedTx = {
    to: sellTo,
    data: sellData,
    value: "0",
    chainId: 43114,
    gas: "500000",
    gasLimit: "500000",
    description: `Step 2/2: Sell ${ethers.formatUnits(sellAmount, 18)} tokens (ID ${tokenId})`,
  };

  return [approveTx, sellTx];
}
