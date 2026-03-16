"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildArenaSwapBuyTx = buildArenaSwapBuyTx;
exports.buildArenaSwapSellTx = buildArenaSwapSellTx;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
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
/** Get a quote via Yield Yak routing (auto-finds best path & adapters) */
async function getYakQuote(provider, amountIn, tokenIn, tokenOut) {
    const router = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_SWAP_ROUTER), ARENA_ROUTER_ABI, provider);
    const [offer, amountOutAfterFees, feeAmount] = await router.quoteYakExactIn(amountIn, tokenIn, tokenOut, 3, // maxSteps
    true, // feeOnInput
    ethers_1.ethers.ZeroAddress);
    return {
        amountOut: amountOutAfterFees,
        feeAmount,
        offer: {
            amounts: offer.amounts.map((a) => a),
            adapters: [...offer.adapters],
            path: [...offer.path],
            gasEstimate: offer.gasEstimate,
        },
    };
}
/** Build unsigned tx to buy a graduated token with AVAX */
async function buildArenaSwapBuyTx(provider, wallet, tokenAddress, avaxAmountWei, slippageBps = 500) {
    // Get quote — Yield Yak finds the best route automatically
    const quote = await getYakQuote(provider, avaxAmountWei, ethers_1.ethers.getAddress(constants_1.WAVAX), ethers_1.ethers.getAddress(tokenAddress));
    if (quote.amountOut === 0n)
        throw new Error("Arena router returned 0 output — no liquidity for this graduated token");
    // Apply slippage
    const minOut = quote.amountOut - (quote.amountOut * BigInt(slippageBps)) / 10000n;
    // Build Trade struct
    const trade = {
        amountIn: avaxAmountWei,
        amountOut: quote.amountOut,
        path: quote.offer.path,
        adapters: quote.offer.adapters,
    };
    const iface = new ethers_1.ethers.Interface(ARENA_ROUTER_ABI);
    const data = iface.encodeFunctionData("yakSwapExactAVAXForTokens", [
        trade,
        wallet,
        minOut,
        true, // feeOnInput
    ]);
    // Get token info for display
    const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
    const displayIn = ethers_1.ethers.formatEther(avaxAmountWei);
    const displayOut = ethers_1.ethers.formatUnits(quote.amountOut, Number(decimals));
    const swapTx = {
        to: ethers_1.ethers.getAddress(constants_1.ARENA_SWAP_ROUTER),
        data,
        value: ethers_1.ethers.toBeHex(avaxAmountWei, 32),
        chainId: 43114,
        gas: "1000000",
        gasLimit: "1000000",
        description: `Buy ~${displayOut} ${symbol} with ${displayIn} AVAX via Arena`,
    };
    return {
        transactions: [swapTx],
        summary: `${displayIn} AVAX → ~${displayOut} ${symbol} via Arena DEX (slippage: ${slippageBps / 100}%)`,
        via: "arena-router",
    };
}
/** Build unsigned tx(s) to sell a graduated token for AVAX */
async function buildArenaSwapSellTx(provider, wallet, tokenAddress, tokenAmountWei, slippageBps = 500) {
    // Get quote
    const quote = await getYakQuote(provider, tokenAmountWei, ethers_1.ethers.getAddress(tokenAddress), ethers_1.ethers.getAddress(constants_1.WAVAX));
    if (quote.amountOut === 0n)
        throw new Error("Arena router returned 0 output — no liquidity for this graduated token");
    // Apply slippage
    const minOut = quote.amountOut - (quote.amountOut * BigInt(slippageBps)) / 10000n;
    // Get token info for display
    const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
    const displayIn = ethers_1.ethers.formatUnits(tokenAmountWei, Number(decimals));
    const displayOut = ethers_1.ethers.formatEther(quote.amountOut);
    const txs = [];
    // Approve router to spend tokens
    const erc20Iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
    const approveData = erc20Iface.encodeFunctionData("approve", [
        ethers_1.ethers.getAddress(constants_1.ARENA_SWAP_ROUTER),
        tokenAmountWei,
    ]);
    txs.push({
        to: ethers_1.ethers.getAddress(tokenAddress),
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
    const iface = new ethers_1.ethers.Interface(ARENA_ROUTER_ABI);
    const sellData = iface.encodeFunctionData("yakSwapExactTokensForAVAX", [
        trade,
        wallet,
        minOut,
        true, // feeOnInput
    ]);
    txs.push({
        to: ethers_1.ethers.getAddress(constants_1.ARENA_SWAP_ROUTER),
        data: sellData,
        value: "0x0",
        chainId: 43114,
        gas: "1000000",
        gasLimit: "1000000",
        description: `Step 2/2: Sell ${displayIn} ${symbol} for ~${displayOut} AVAX via Arena`,
    });
    return {
        transactions: txs,
        summary: `${displayIn} ${symbol} → ~${displayOut} AVAX via Arena DEX (slippage: ${slippageBps / 100}%)`,
        via: "arena-router",
    };
}
//# sourceMappingURL=arena-router.js.map