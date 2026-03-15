"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentLaunches = getRecentLaunches;
exports.searchToken = searchToken;
exports.getGraduating = getGraduating;
exports.getOverview = getOverview;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
async function getRecentLaunches(launchContract, tokenManager, provider, count = 10, type = "all") {
    const results = [];
    const fetchToken = async (id, contract, pairType) => {
        try {
            const params = await contract.getTokenParameters(id);
            if (params.tokenContractAddress === ethers_1.ethers.ZeroAddress)
                return null;
            const token = new ethers_1.ethers.Contract(params.tokenContractAddress, constants_1.ERC20_ABI, provider);
            let name = "Unknown", symbol = "UNKNOWN";
            try {
                [name, symbol] = await Promise.all([token.name(), token.symbol()]);
            }
            catch { }
            const supply = await contract.tokenSupply(id);
            const maxForSale = await contract.getMaxTokensForSale(id);
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
                amountSold: ethers_1.ethers.formatUnits(sold, 18),
            };
        }
        catch {
            return null;
        }
    };
    if (type === "all" || type === "avax") {
        const latestAvax = await launchContract.tokenIdentifier();
        const avaxCount = type === "all" ? Math.ceil(count / 2) : count;
        const avaxPromises = [];
        for (let i = 0; i < avaxCount && latestAvax - BigInt(i) > 0n; i++) {
            avaxPromises.push(fetchToken(latestAvax - BigInt(i) - 1n, launchContract, "AVAX-paired"));
        }
        results.push(...(await Promise.all(avaxPromises)).filter(Boolean));
    }
    if (type === "all" || type === "arena") {
        const latestArena = await tokenManager.tokenIdentifier();
        const arenaCount = type === "all" ? Math.ceil(count / 2) : count;
        const arenaPromises = [];
        for (let i = 0; i < arenaCount && latestArena - BigInt(i) >= constants_1.ARENA_PAIRED_THRESHOLD; i++) {
            arenaPromises.push(fetchToken(latestArena - BigInt(i) - 1n, tokenManager, "ARENA-paired"));
        }
        results.push(...(await Promise.all(arenaPromises)).filter(Boolean));
    }
    return results.slice(0, count);
}
async function searchToken(launchContract, tokenManager, provider, query, getTokenInfo) {
    const searchContract = async (contract, label) => {
        const latest = await contract.tokenIdentifier();
        const start = label === "ARENA-paired" ? constants_1.ARENA_PAIRED_THRESHOLD : 1n;
        for (let id = latest - 1n; id >= start && id >= latest - 200n; id--) {
            try {
                const params = await contract.getTokenParameters(id);
                if (params.tokenContractAddress.toLowerCase() === query.toLowerCase()) {
                    return id.toString();
                }
            }
            catch {
                continue;
            }
        }
        return null;
    };
    const [avaxResult, arenaResult] = await Promise.all([
        searchContract(launchContract, "AVAX-paired"),
        searchContract(tokenManager, "ARENA-paired"),
    ]);
    const foundId = avaxResult || arenaResult;
    if (!foundId)
        throw new Error(`Token not found for address ${query} in recent launches`);
    return getTokenInfo(foundId);
}
async function getGraduating(launchContract, tokenManager, provider, count = 5) {
    const candidates = [];
    const checkBatch = async (contract, label) => {
        const latest = await contract.tokenIdentifier();
        const start = label === "ARENA-paired" ? constants_1.ARENA_PAIRED_THRESHOLD : 1n;
        const promises = [];
        for (let i = 0; i < 100 && latest - BigInt(i) - 1n >= start; i++) {
            const id = latest - BigInt(i) - 1n;
            promises.push((async () => {
                try {
                    const params = await contract.getTokenParameters(id);
                    if (params.lpDeployed)
                        return null;
                    const supply = await contract.tokenSupply(id);
                    const maxForSale = await contract.getMaxTokensForSale(id);
                    const saleAlloc = (supply * BigInt(params.salePercentage)) / 100n;
                    if (saleAlloc === 0n)
                        return null;
                    const sold = saleAlloc > maxForSale ? saleAlloc - maxForSale : 0n;
                    const progress = Number((sold * 10000n) / saleAlloc) / 100;
                    if (progress < 0.5)
                        return null;
                    const token = new ethers_1.ethers.Contract(params.tokenContractAddress, constants_1.ERC20_ABI, provider);
                    let name = "Unknown", symbol = "UNKNOWN";
                    try {
                        [name, symbol] = await Promise.all([token.name(), token.symbol()]);
                    }
                    catch { }
                    return { tokenId: id.toString(), progress, info: { name, symbol, type: label, tokenAddress: params.tokenContractAddress, graduationProgress: `${progress.toFixed(2)}%`, amountSold: ethers_1.ethers.formatUnits(sold, 18) } };
                }
                catch {
                    return null;
                }
            })());
        }
        return (await Promise.all(promises)).filter(Boolean);
    };
    const [avax, arena] = await Promise.all([
        checkBatch(launchContract, "AVAX-paired"),
        checkBatch(tokenManager, "ARENA-paired"),
    ]);
    candidates.push(...avax, ...arena);
    candidates.sort((a, b) => b.progress - a.progress);
    return candidates.slice(0, count).map(c => ({ ...c.info, tokenId: c.tokenId }));
}
async function getOverview(launchContract, tokenManager) {
    const [avaxLatest, arenaLatest, protocolFeeAvax, protocolFeeArena] = await Promise.all([
        launchContract.tokenIdentifier(),
        tokenManager.tokenIdentifier(),
        launchContract.protocolFeeBasisPoint(),
        tokenManager.protocolFeeBasisPoint(),
    ]);
    return {
        totalAvaxPairedTokens: (avaxLatest - 1n).toString(),
        totalArenaPairedTokens: (arenaLatest - constants_1.ARENA_PAIRED_THRESHOLD).toString(),
        totalTokens: ((avaxLatest - 1n) + (arenaLatest - constants_1.ARENA_PAIRED_THRESHOLD)).toString(),
        protocolFeeBps: {
            avaxPaired: protocolFeeAvax.toString(),
            arenaPaired: protocolFeeArena.toString(),
        },
        contracts: {
            launchContract: constants_1.LAUNCH_CONTRACT,
            tokenManager: constants_1.TOKEN_MANAGER,
            avaxHelper: constants_1.AVAX_HELPER,
        },
    };
}
//# sourceMappingURL=discovery.js.map