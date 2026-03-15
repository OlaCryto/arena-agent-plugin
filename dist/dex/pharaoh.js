"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPharaohQuote = getPharaohQuote;
exports.buildPharaohSwapTx = buildPharaohSwapTx;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
const PHARAOH_API = "https://www.phar.gg/api/0x";
const NATIVE_AVAX = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
/** Get a quote from Pharaoh DEX aggregator */
async function getPharaohQuote(sellToken, buyToken, sellAmountWei, taker, slippageBps = 100) {
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
        if (!res.ok)
            return null;
        const data = await res.json();
        if (!data.liquidityAvailable)
            return null;
        return data;
    }
    catch {
        return null;
    }
}
/** Build unsigned swap tx(s) via Pharaoh */
async function buildPharaohSwapTx(wallet, fromAddress, toAddress, amountWei, fromSymbol, toSymbol, fromDecimals, toDecimals, slippageBps = 100) {
    const isFromNative = fromSymbol.toUpperCase() === "AVAX";
    const sellToken = isFromNative ? NATIVE_AVAX : fromAddress;
    const isToNative = toSymbol.toUpperCase() === "AVAX";
    const buyToken = isToNative ? NATIVE_AVAX : toAddress;
    const quote = await getPharaohQuote(sellToken, buyToken, amountWei.toString(), wallet, slippageBps);
    if (!quote)
        return null;
    const txs = [];
    const displayIn = ethers_1.ethers.formatUnits(amountWei, fromDecimals);
    const displayOut = ethers_1.ethers.formatUnits(BigInt(quote.buyAmount), toDecimals);
    // If selling a token (not native AVAX), may need approve
    if (!isFromNative && quote.issues?.allowance != null && quote.allowanceTarget) {
        const approveIface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const approveData = approveIface.encodeFunctionData("approve", [
            ethers_1.ethers.getAddress(quote.allowanceTarget), amountWei,
        ]);
        txs.push({
            to: ethers_1.ethers.getAddress(fromAddress),
            data: approveData,
            value: "0x0",
            chainId: 43114,
            gas: "60000",
            gasLimit: "60000",
            description: `Approve ${displayIn} ${fromSymbol} for Pharaoh swap`,
        });
    }
    txs.push({
        to: ethers_1.ethers.getAddress(quote.transaction.to),
        data: quote.transaction.data,
        value: ethers_1.ethers.toBeHex(BigInt(quote.transaction.value)),
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
//# sourceMappingURL=pharaoh.js.map