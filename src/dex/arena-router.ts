import { ethers } from "ethers";
import {
  ARENA_SWAP_ROUTER,
  WAVAX,
  ERC20_ABI,
} from "../core/constants";
import type { UnsignedTx } from "../core/types";

/**
 * Arena's DEX router at 0xDE9D7290959b6060860b983b32f2d65b2701EBC2
 * Wraps Yield Yak aggregator + Arena V4 pools.
 * Uses quoteYakExactIn to find best route, then yakSwap* to execute.
 */

const ARENA_ROUTER_ABI = [
  // Quote — auto-finds best route via Yield Yak
  "function quoteYakExactIn(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps, bool _feeOnInput, address _referrer) view returns (tuple(uint256[] amounts, address[] adapters, address[] path, uint256 gasEstimate) offer, uint256 amountOutAfterFees, uint256 feeAmount, uint256 referrerFeeAmount)",
  // Swap AVAX → token (payable)
  "function yakSwapExactAVAXForTokens(tuple(uint256 amountIn, uint256 amountOut, address[] path, address[] adapters) _trade, address _to, uint256 _minAmountOut, bool _feeOnInput) payable",
  // Swap token → AVAX
  "function yakSwapExactTokensForAVAX(tuple(uint256 amountIn, uint256 amountOut, address[] path, address[] adapters) _trade, address _to, uint256 _minAmountOut, bool _feeOnInput)",
  // Arena V4 pool quote (fallback)
  "function quoteArenaExactIn(uint256 _amountIn, address[] _path, bool _feeOnInput, address _referrer) view returns (uint256[] amounts, uint256 amountOutAfterFees, uint256 feeAmount, uint256 referrerFeeAmount)",
  // Arena V4 pool swap (fallback)
  "function arenaSwapExactAVAXForTokens(uint256 _amountOutMin, address[] _path, address _to, uint256 _deadline, bool _feeOnInput) payable",
  "function arenaSwapExactTokensForAVAX(uint256 _amountIn, uint256 _amountOutMin, address[] _path, address _to, uint256 _deadline, bool _feeOnInput)",
];

interface YakQuote {
  amountOut: bigint;
  feeAmount: bigint;
  offer: {
    amounts: bigint[];
    adapters: string[];
    path: string[];
    gasEstimate: bigint;
  };
}

/** Get a quote via Yield Yak routing (auto-finds best path & adapters) */
async function getYakQuote(
  provider: ethers.JsonRpcProvider,
  amountIn: bigint,
  tokenIn: string,
  tokenOut: string,
): Promise<YakQuote> {
  const router = new ethers.Contract(
    ethers.getAddress(ARENA_SWAP_ROUTER),
    ARENA_ROUTER_ABI,
    provider,
  );

  const [offer, amountOutAfterFees, feeAmount] = await router.quoteYakExactIn(
    amountIn,
    tokenIn,
    tokenOut,
    3, // maxSteps
    true, // feeOnInput
    ethers.ZeroAddress, // no referrer
  );

  return {
    amountOut: amountOutAfterFees,
    feeAmount,
    offer: {
      amounts: offer.amounts.map((a: bigint) => a),
      adapters: [...offer.adapters],
      path: [...offer.path],
      gasEstimate: offer.gasEstimate,
    },
  };
}

/** Build unsigned tx to buy a graduated token with AVAX */
export async function buildArenaSwapBuyTx(
  provider: ethers.JsonRpcProvider,
  wallet: string,
  tokenAddress: string,
  avaxAmountWei: bigint,
  slippageBps = 500,
): Promise<{ transactions: UnsignedTx[]; summary: string; via: string }> {
  // Get quote — Yield Yak finds the best route automatically
  const quote = await getYakQuote(
    provider,
    avaxAmountWei,
    ethers.getAddress(WAVAX),
    ethers.getAddress(tokenAddress),
  );

  if (quote.amountOut === 0n) throw new Error("Arena router returned 0 output — no liquidity for this graduated token");

  // Apply slippage
  const minOut = quote.amountOut - (quote.amountOut * BigInt(slippageBps)) / 10000n;

  // Build Trade struct
  const trade = {
    amountIn: avaxAmountWei,
    amountOut: quote.amountOut,
    path: quote.offer.path,
    adapters: quote.offer.adapters,
  };

  const iface = new ethers.Interface(ARENA_ROUTER_ABI);
  const data = iface.encodeFunctionData("yakSwapExactAVAXForTokens", [
    trade,
    wallet,
    minOut,
    true, // feeOnInput
  ]);

  // Get token info for display
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);

  const displayIn = ethers.formatEther(avaxAmountWei);
  const displayOut = ethers.formatUnits(quote.amountOut, Number(decimals));

  const swapTx: UnsignedTx = {
    to: ethers.getAddress(ARENA_SWAP_ROUTER),
    data,
    value: ethers.toBeHex(avaxAmountWei, 32),
    chainId: 43114,
    gas: "600000",
    gasLimit: "600000",
    description: `Buy ~${displayOut} ${symbol} with ${displayIn} AVAX via Arena`,
  };

  return {
    transactions: [swapTx],
    summary: `${displayIn} AVAX → ~${displayOut} ${symbol} via Arena DEX (slippage: ${slippageBps / 100}%)`,
    via: "arena-router",
  };
}

/** Build unsigned tx(s) to sell a graduated token for AVAX */
export async function buildArenaSwapSellTx(
  provider: ethers.JsonRpcProvider,
  wallet: string,
  tokenAddress: string,
  tokenAmountWei: bigint,
  slippageBps = 500,
): Promise<{ transactions: UnsignedTx[]; summary: string; via: string }> {
  // Get quote
  const quote = await getYakQuote(
    provider,
    tokenAmountWei,
    ethers.getAddress(tokenAddress),
    ethers.getAddress(WAVAX),
  );

  if (quote.amountOut === 0n) throw new Error("Arena router returned 0 output — no liquidity for this graduated token");

  // Apply slippage
  const minOut = quote.amountOut - (quote.amountOut * BigInt(slippageBps)) / 10000n;

  // Get token info for display
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);

  const displayIn = ethers.formatUnits(tokenAmountWei, Number(decimals));
  const displayOut = ethers.formatEther(quote.amountOut);

  const txs: UnsignedTx[] = [];

  // Approve router to spend tokens
  const erc20Iface = new ethers.Interface(ERC20_ABI);
  const approveData = erc20Iface.encodeFunctionData("approve", [
    ethers.getAddress(ARENA_SWAP_ROUTER),
    tokenAmountWei,
  ]);
  txs.push({
    to: ethers.getAddress(tokenAddress),
    data: approveData,
    value: "0x0",
    chainId: 43114,
    gas: "60000",
    gasLimit: "60000",
    description: `Step 1/2: Approve ${displayIn} ${symbol} for Arena Router`,
  });

  // Build Trade struct
  const trade = {
    amountIn: tokenAmountWei,
    amountOut: quote.amountOut,
    path: quote.offer.path,
    adapters: quote.offer.adapters,
  };

  const iface = new ethers.Interface(ARENA_ROUTER_ABI);
  const sellData = iface.encodeFunctionData("yakSwapExactTokensForAVAX", [
    trade,
    wallet,
    minOut,
    true, // feeOnInput
  ]);

  txs.push({
    to: ethers.getAddress(ARENA_SWAP_ROUTER),
    data: sellData,
    value: "0x0",
    chainId: 43114,
    gas: "600000",
    gasLimit: "600000",
    description: `Step 2/2: Sell ${displayIn} ${symbol} for ~${displayOut} AVAX via Arena`,
  });

  return {
    transactions: txs,
    summary: `${displayIn} ${symbol} → ~${displayOut} AVAX via Arena DEX (slippage: ${slippageBps / 100}%)`,
    via: "arena-router",
  };
}
