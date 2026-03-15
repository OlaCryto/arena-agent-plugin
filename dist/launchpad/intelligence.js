"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenInfo = getTokenInfo;
exports.getTokenQuote = getTokenQuote;
exports.getTokenBalance = getTokenBalance;
exports.getPortfolio = getPortfolio;
exports.getActivity = getActivity;
exports.getMarketCap = getMarketCap;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
const helpers_1 = require("./helpers");
async function getTokenInfo(tokenId, launchContract, tokenManager, provider) {
    const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
    const id = BigInt(tokenId);
    const arenaPaired = (0, helpers_1.isArenaPaired)(tokenId);
    const [params, supply, maxForSale] = await Promise.all([
        contract.getTokenParameters(id),
        contract.tokenSupply(id),
        contract.getMaxTokensForSale(id),
    ]);
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers_1.ethers.ZeroAddress)
        throw new Error(`Token ID ${tokenId} not found`);
    const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, provider);
    let name = "Unknown", symbol = "UNKNOWN";
    try {
        [name, symbol] = await Promise.all([token.name(), token.symbol()]);
    }
    catch { }
    let priceAvax = "0";
    const graduated = params.lpDeployed;
    if (!graduated) {
        try {
            const costOf1 = await contract.calculateCostWithFees(1n, id);
            priceAvax = ethers_1.ethers.formatEther(costOf1);
        }
        catch { }
    }
    const salePerc = BigInt(params.salePercentage);
    const saleAllocation = (supply * salePerc) / 100n;
    const amountSold = saleAllocation > maxForSale ? saleAllocation - maxForSale : 0n;
    const soldWhole = Number(amountSold / constants_1.GRANULARITY_SCALER);
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
        amountSold: ethers_1.ethers.formatUnits(amountSold, 18),
        totalSupply: ethers_1.ethers.formatUnits(supply, 18),
        saleAllocation: ethers_1.ethers.formatUnits(saleAllocation, 18),
        remainingForSale: ethers_1.ethers.formatUnits(maxForSale, 18),
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
async function getTokenQuote(tokenId, amount, side, launchContract, tokenManager) {
    const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
    const id = BigInt(tokenId);
    const arenaPaired = (0, helpers_1.isArenaPaired)(tokenId);
    if (side === "buy") {
        const avaxWei = ethers_1.ethers.parseEther(amount);
        if (!arenaPaired) {
            const tokenAmountWei = await (0, helpers_1.binarySearchTokenAmount)(launchContract, avaxWei, id);
            if (tokenAmountWei === 0n)
                return { tokenId, side, avaxIn: amount, tokensOut: "0", note: "Insufficient liquidity or token sold out" };
            const exactCost = await launchContract.calculateCostWithFees(tokenAmountWei / constants_1.GRANULARITY_SCALER, id);
            return {
                tokenId, side,
                avaxIn: ethers_1.ethers.formatEther(exactCost),
                tokensOut: ethers_1.ethers.formatUnits(tokenAmountWei, 18),
            };
        }
        else {
            return {
                tokenId, side,
                avaxIn: amount,
                tokensOut: "determined at execution (ARENA-paired, helper converts automatically)",
            };
        }
    }
    else {
        const tokenAmountWei = ethers_1.ethers.parseUnits(amount, 18);
        const reward = await contract.calculateRewardWithFees(tokenAmountWei, id);
        return {
            tokenId, side,
            tokenAmount: amount,
            rewardAvax: arenaPaired ? undefined : ethers_1.ethers.formatEther(reward),
            rewardArena: arenaPaired ? ethers_1.ethers.formatUnits(reward, 18) : undefined,
            note: arenaPaired ? "Reward is in ARENA. Use AVAX Helper to convert to AVAX." : undefined,
        };
    }
}
async function getTokenBalance(wallet, tokenId, launchContract, tokenManager, provider) {
    const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
    const params = await contract.getTokenParameters(BigInt(tokenId));
    const tokenAddress = params.tokenContractAddress;
    if (tokenAddress === ethers_1.ethers.ZeroAddress)
        throw new Error(`Token ID ${tokenId} not found`);
    const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, provider);
    const balance = await token.balanceOf(wallet);
    return {
        wallet,
        tokenId,
        tokenAddress,
        balance: ethers_1.ethers.formatUnits(balance, 18),
    };
}
async function getPortfolio(wallet, tokenIds, launchContract, tokenManager, provider) {
    if (tokenIds.length === 0)
        return { wallet, positions: [], totalValueAvax: "0" };
    const positions = [];
    let totalValue = 0;
    const checks = tokenIds.map(async (tid) => {
        try {
            const tokenId = tid.toString();
            const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
            const params = await contract.getTokenParameters(BigInt(tokenId));
            if (params.tokenContractAddress === ethers_1.ethers.ZeroAddress)
                return null;
            const token = new ethers_1.ethers.Contract(params.tokenContractAddress, constants_1.ERC20_ABI, provider);
            const balance = await token.balanceOf(wallet);
            if (balance === 0n)
                return null;
            let name = "Unknown", symbol = "UNKNOWN";
            try {
                [name, symbol] = await Promise.all([token.name(), token.symbol()]);
            }
            catch { }
            let valueAvax = "0";
            if (!params.lpDeployed) {
                try {
                    const reward = await contract.calculateRewardWithFees(balance, BigInt(tokenId));
                    valueAvax = ethers_1.ethers.formatEther(reward);
                }
                catch { }
            }
            return {
                tokenId, name, symbol,
                tokenAddress: params.tokenContractAddress,
                balance: ethers_1.ethers.formatUnits(balance, 18),
                valueAvax,
                graduated: params.lpDeployed,
            };
        }
        catch {
            return null;
        }
    });
    const results = (await Promise.all(checks)).filter(Boolean);
    for (const pos of results) {
        positions.push(pos);
        totalValue += parseFloat(pos.valueAvax);
    }
    return { wallet, positions, totalValueAvax: totalValue.toFixed(6) };
}
async function getActivity(tokenId, launchContract, tokenManager, provider, count = 20) {
    const contract = (0, helpers_1.getContract)(tokenId, launchContract, tokenManager);
    const id = BigInt(tokenId);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);
    const [buyEvents, sellEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Buy(null, id), fromBlock, currentBlock),
        contract.queryFilter(contract.filters.Sell(null, id), fromBlock, currentBlock),
    ]);
    const arenaPaired = (0, helpers_1.isArenaPaired)(tokenId);
    const formatAmount = (v) => arenaPaired ? ethers_1.ethers.formatUnits(v, 18) : ethers_1.ethers.formatEther(v);
    const events = [
        ...buyEvents.map((e) => ({
            type: "buy",
            user: e.args.user,
            tokenAmount: ethers_1.ethers.formatUnits(e.args.tokenAmount, 18),
            cost: formatAmount(e.args.cost),
            block: e.blockNumber,
        })),
        ...sellEvents.map((e) => ({
            type: "sell",
            user: e.args.user,
            tokenAmount: ethers_1.ethers.formatUnits(e.args.tokenAmount, 18),
            reward: formatAmount(e.args.reward),
            block: e.blockNumber,
        })),
    ];
    events.sort((a, b) => b.block - a.block);
    return { tokenId, events: events.slice(0, count) };
}
async function getMarketCap(tokenId, launchContract, tokenManager, provider) {
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
//# sourceMappingURL=intelligence.js.map