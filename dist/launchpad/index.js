"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaunchpadModule = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
const helpers_1 = require("./helpers");
const pharaoh_1 = require("../dex/pharaoh");
const discovery = __importStar(require("./discovery"));
const intelligence = __importStar(require("./intelligence"));
const trading = __importStar(require("./trading"));
class LaunchpadModule {
    constructor(provider) {
        this.provider = provider;
        const contracts = (0, helpers_1.createLaunchpadContracts)(provider);
        this.launchContract = contracts.launchContract;
        this.tokenManager = contracts.tokenManager;
        this.avaxHelper = contracts.avaxHelper;
    }
    // ─── Discovery ───
    async getRecentLaunches(count = 10, type = "all") {
        return discovery.getRecentLaunches(this.launchContract, this.tokenManager, this.provider, count, type);
    }
    async searchToken(query) {
        return discovery.searchToken(this.launchContract, this.tokenManager, this.provider, query, (tokenId) => this.getTokenInfo(tokenId));
    }
    async getGraduating(count = 5) {
        return discovery.getGraduating(this.launchContract, this.tokenManager, this.provider, count);
    }
    async getOverview() {
        return discovery.getOverview(this.launchContract, this.tokenManager);
    }
    // ─── Intelligence ───
    async getTokenInfo(tokenId) {
        return intelligence.getTokenInfo(tokenId, this.launchContract, this.tokenManager, this.provider);
    }
    async getTokenQuote(tokenId, amount, side) {
        return intelligence.getTokenQuote(tokenId, amount, side, this.launchContract, this.tokenManager);
    }
    async getTokenBalance(wallet, tokenId) {
        return intelligence.getTokenBalance(wallet, tokenId, this.launchContract, this.tokenManager, this.provider);
    }
    async getPortfolio(wallet, tokenIds) {
        return intelligence.getPortfolio(wallet, tokenIds, this.launchContract, this.tokenManager, this.provider);
    }
    async getActivity(tokenId, count = 20) {
        return intelligence.getActivity(tokenId, this.launchContract, this.tokenManager, this.provider, count);
    }
    async getMarketCap(tokenId) {
        return intelligence.getMarketCap(tokenId, this.launchContract, this.tokenManager, this.provider);
    }
    // ─── Trading ───
    async buildLaunchpadBuyTx(wallet, tokenId, avaxAmount, slippageBps) {
        const contract = (0, helpers_1.getContract)(tokenId, this.launchContract, this.tokenManager);
        const params = await contract.getTokenParameters(BigInt(tokenId));
        if (params.lpDeployed) {
            const tokenAddress = params.tokenContractAddress;
            if (tokenAddress === ethers_1.ethers.ZeroAddress)
                throw new Error(`Token ID ${tokenId} not found`);
            // Get token info for display
            const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, this.provider);
            const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
            const amountWei = ethers_1.ethers.parseEther(avaxAmount);
            const result = await (0, pharaoh_1.buildPharaohSwapTx)(wallet, tokenAddress, tokenAddress, amountWei, "AVAX", symbol, 18, Number(decimals), slippageBps || 100);
            if (!result)
                throw new Error(`No liquidity found on Pharaoh DEX for this graduated token`);
            return { ...result, graduated: true };
        }
        return trading.buildLaunchpadBuyTx(wallet, tokenId, avaxAmount, this.launchContract, this.tokenManager, slippageBps);
    }
    async buildLaunchpadSellTx(wallet, tokenId, amount, slippageBps) {
        const contract = (0, helpers_1.getContract)(tokenId, this.launchContract, this.tokenManager);
        const params = await contract.getTokenParameters(BigInt(tokenId));
        if (params.lpDeployed) {
            const tokenAddress = params.tokenContractAddress;
            if (tokenAddress === ethers_1.ethers.ZeroAddress)
                throw new Error(`Token ID ${tokenId} not found`);
            const token = new ethers_1.ethers.Contract(tokenAddress, constants_1.ERC20_ABI, this.provider);
            const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
            let amountWei;
            if (amount === "max") {
                amountWei = await token.balanceOf(wallet);
                if (amountWei === 0n)
                    throw new Error("Zero balance — nothing to sell");
            }
            else {
                amountWei = ethers_1.ethers.parseUnits(amount, Number(decimals));
            }
            const result = await (0, pharaoh_1.buildPharaohSwapTx)(wallet, tokenAddress, tokenAddress, amountWei, symbol, "AVAX", Number(decimals), 18, slippageBps || 100);
            if (!result)
                throw new Error(`No liquidity found on Pharaoh DEX for this graduated token`);
            return { ...result, graduated: true };
        }
        return trading.buildLaunchpadSellTx(wallet, tokenId, amount, this.launchContract, this.tokenManager, this.provider, slippageBps);
    }
}
exports.LaunchpadModule = LaunchpadModule;
//# sourceMappingURL=index.js.map