"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLaunchpadBuyTx = buildLaunchpadBuyTx;
exports.buildLaunchpadSellTx = buildLaunchpadSellTx;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
const helpers_1 = require("./helpers");
/** Build unsigned tx to buy a launchpad token */
async function buildLaunchpadBuyTx(wallet, tokenId, avaxAmount, launchContract, tokenManager, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
    const id = BigInt(tokenId);
    const avaxWei = ethers_1.ethers.parseEther(avaxAmount);
    const arenaPaired = (0, helpers_1.isArenaPaired)(tokenId);
    const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
    const params = await contract.getTokenParameters(id);
    if (params.lpDeployed)
        throw new Error("Token has graduated to DEX — trade on a DEX instead");
    if (!arenaPaired) {
        const tokenAmountWei = await (0, helpers_1.binarySearchTokenAmount)(launchContract, avaxWei, id);
        if (tokenAmountWei === 0n)
            throw new Error("Cannot calculate buy amount — token may be sold out");
        const iface = new ethers_1.ethers.Interface(constants_1.LAUNCH_CONTRACT_ABI);
        const data = iface.encodeFunctionData("buyAndCreateLpIfPossible", [tokenAmountWei, id]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT),
            data,
            value: ethers_1.ethers.toBeHex(avaxWei, 32),
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Buy ~${ethers_1.ethers.formatUnits(tokenAmountWei, 18)} tokens (ID ${tokenId}) with ${avaxAmount} AVAX`,
        };
    }
    else {
        const iface = new ethers_1.ethers.Interface(constants_1.AVAX_HELPER_ABI);
        const data = iface.encodeFunctionData("buyAndCreateLpIfPossibleWithAvax", [id, 0n]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.AVAX_HELPER),
            data,
            value: ethers_1.ethers.toBeHex(avaxWei, 32),
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Buy tokens (ID ${tokenId}) with ${avaxAmount} AVAX via ARENA Helper`,
        };
    }
}
/** Build unsigned txs to sell a launchpad token: [approve, sell] */
async function buildLaunchpadSellTx(wallet, tokenId, amount, launchContract, tokenManager, provider, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
    const id = BigInt(tokenId);
    const arenaPaired = (0, helpers_1.isArenaPaired)(tokenId);
    const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
    const params = await contract.getTokenParameters(id);
    if (params.lpDeployed)
        throw new Error("Token has graduated to DEX — trade on a DEX instead");
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers_1.ethers.ZeroAddress)
        throw new Error(`Token ID ${tokenId} not found`);
    const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, provider);
    let sellAmount;
    if (amount === "max") {
        sellAmount = await token.balanceOf(wallet);
    }
    else {
        sellAmount = ethers_1.ethers.parseUnits(amount, 18);
    }
    if (sellAmount === 0n)
        throw new Error("Zero balance — nothing to sell");
    if (!arenaPaired) {
        sellAmount = (sellAmount / constants_1.GRANULARITY_SCALER) * constants_1.GRANULARITY_SCALER;
        if (sellAmount === 0n)
            throw new Error("Balance too small to sell (must be at least 1 whole token unit)");
    }
    const spender = arenaPaired ? ethers_1.ethers.getAddress(constants_1.AVAX_HELPER) : ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT);
    const erc20Iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
    const approveData = erc20Iface.encodeFunctionData("approve", [spender, ethers_1.ethers.MaxUint256]);
    const approveTx = {
        to: tokenAddress,
        data: approveData,
        value: "0",
        chainId: 43114,
        gas: "60000",
        gasLimit: "60000",
        description: `Step 1/2: Approve token for selling`,
    };
    let sellData;
    let sellTo;
    if (!arenaPaired) {
        const iface = new ethers_1.ethers.Interface(constants_1.LAUNCH_CONTRACT_ABI);
        sellData = iface.encodeFunctionData("sell", [sellAmount, id]);
        sellTo = ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT);
    }
    else {
        let minOut = 0n;
        try {
            const reward = await contract.calculateRewardWithFees(sellAmount, id);
            minOut = reward - (reward * BigInt(slippageBps)) / 10000n;
        }
        catch { }
        const iface = new ethers_1.ethers.Interface(constants_1.AVAX_HELPER_ABI);
        sellData = iface.encodeFunctionData("sellToAvax", [id, sellAmount, minOut]);
        sellTo = ethers_1.ethers.getAddress(constants_1.AVAX_HELPER);
    }
    const sellTx = {
        to: sellTo,
        data: sellData,
        value: "0",
        chainId: 43114,
        gas: "500000",
        gasLimit: "500000",
        description: `Step 2/2: Sell ${ethers_1.ethers.formatUnits(sellAmount, 18)} tokens (ID ${tokenId})`,
    };
    return [approveTx, sellTx];
}
//# sourceMappingURL=trading.js.map