"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLaunchpadContracts = createLaunchpadContracts;
exports.isArenaPaired = isArenaPaired;
exports.getContract = getContract;
exports.binarySearchTokenAmount = binarySearchTokenAmount;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
function createLaunchpadContracts(provider) {
    return {
        launchContract: new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LAUNCH_CONTRACT), constants_1.LAUNCH_CONTRACT_ABI, provider),
        tokenManager: new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.TOKEN_MANAGER), constants_1.TOKEN_MANAGER_ABI, provider),
        avaxHelper: new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.AVAX_HELPER), constants_1.AVAX_HELPER_ABI, provider),
    };
}
function isArenaPaired(tokenId) {
    return BigInt(tokenId) >= constants_1.ARENA_PAIRED_THRESHOLD;
}
function getContract(tokenId, launchContract, tokenManager) {
    return isArenaPaired(tokenId) ? tokenManager : launchContract;
}
/** Binary search: find max tokens purchasable with given AVAX budget (AVAX-paired only) */
async function binarySearchTokenAmount(launchContract, avaxBudgetWei, tokenId) {
    let maxForSale;
    try {
        maxForSale = await launchContract.getMaxTokensForSale(tokenId);
    }
    catch {
        maxForSale = 100000000n * constants_1.GRANULARITY_SCALER;
    }
    const maxWhole = maxForSale / constants_1.GRANULARITY_SCALER;
    if (maxWhole <= 0n)
        return 0n;
    let lo = 1n;
    let hi = maxWhole;
    let best = 0n;
    for (let i = 0; i < 30 && lo <= hi; i++) {
        const mid = (lo + hi) / 2n;
        try {
            const cost = await launchContract.calculateCostWithFees(mid, tokenId);
            if (cost <= avaxBudgetWei) {
                best = mid;
                lo = mid + 1n;
            }
            else {
                hi = mid - 1n;
            }
        }
        catch {
            hi = mid - 1n;
        }
    }
    return best > 0n ? best * constants_1.GRANULARITY_SCALER : 0n;
}
//# sourceMappingURL=helpers.js.map