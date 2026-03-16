import { ethers } from "ethers";
import { ERC20_ABI } from "../core/constants";
import type { UnsignedTx } from "../core/types";

const PHARAOH_API = "https://www.phar.gg/api/0x";
const NATIVE_AVAX = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export interface PharaohQuote {
  liquidityAvailable: boolean;
  buyAmount: string;
  sellAmount: string;
  buyToken: string;
  sellToken: string;
  allowanceTarget?: string;
  issues?: { allowance?: any; balance?: any };
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

/** Get a quote from Pharaoh DEX aggregator */
export async function getPharaohQuote(
  sellToken: string,
  buyToken: string,
  sellAmountWei: string,
  taker: string,
  slippageBps = 100,
): Promise<PharaohQuote | null> {
  const params = new URLSearchParams({
    chainId: "43114",
    sellToken,
    buyToken,
    sellAmount: sellAmountWei,
    taker,
    slippageBps: slippageBps.toString(),
  });

  try {
    const res = await fetch(`${PHARAOH_API}?${params}`);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.liquidityAvailable) return null;
    return data as PharaohQuote;
  } catch {
    return null;
  }
}

/** Build unsigned swap tx(s) via Pharaoh */
export async function buildPharaohSwapTx(
  wallet: string,
  fromAddress: string,
  toAddress: string,
  amountWei: bigint,
  fromSymbol: string,
  toSymbol: string,
  fromDecimals: number,
  toDecimals: number,
  slippageBps = 100,
): Promise<{ transactions: UnsignedTx[]; summary: string; via: string } | null> {
  const isFromNative = fromSymbol.toUpperCase() === "AVAX";
  const sellToken = isFromNative ? NATIVE_AVAX : fromAddress;
  const isToNative = toSymbol.toUpperCase() === "AVAX";
  const buyToken = isToNative ? NATIVE_AVAX : toAddress;

  const quote = await getPharaohQuote(sellToken, buyToken, amountWei.toString(), wallet, slippageBps);
  if (!quote) return null;

  const txs: UnsignedTx[] = [];
  const displayIn = ethers.formatUnits(amountWei, fromDecimals);
  const displayOut = ethers.formatUnits(BigInt(quote.buyAmount), toDecimals);

  // If selling a token (not native AVAX), may need approve
  if (!isFromNative && quote.issues?.allowance != null && quote.allowanceTarget) {
    const approveIface = new ethers.Interface(ERC20_ABI);
    const approveData = approveIface.encodeFunctionData("approve", [
      ethers.getAddress(quote.allowanceTarget), amountWei,
    ]);
    txs.push({
      to: ethers.getAddress(fromAddress),
      data: approveData,
      value: "0x0",
      chainId: 43114,
      gas: "60000",
      gasLimit: "60000",
      description: `Approve ${displayIn} ${fromSymbol} for Pharaoh swap`,
    });
  }

  txs.push({
    to: ethers.getAddress(quote.transaction.to),
    data: quote.transaction.data,
    value: ethers.toBeHex(BigInt(quote.transaction.value), 32),
    chainId: 43114,
    gas: quote.transaction.gas,
    gasLimit: quote.transaction.gas,
    description: `Swap ${displayIn} ${fromSymbol} for ~${displayOut} ${toSymbol} via Pharaoh`,
  });

  return {
    transactions: txs,
    summary: `${displayIn} ${fromSymbol} → ~${displayOut} ${toSymbol} via Pharaoh DEX (slippage: ${slippageBps / 100}%)`,
    via: "pharaoh",
  };
}
