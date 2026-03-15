"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapModule = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
const ARENA_ROUTER = process.env.ARENA_ROUTER || "";
const ARENA_ROUTER_ABI = [
    "function buyArena(tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, uint256 amountOutMin, uint256 deadline) payable returns (uint256 arenaOut)",
    "function feeBps() view returns (uint256)",
];
class SwapModule {
    constructor(provider) {
        this.provider = provider;
        this.arenaToken = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN), constants_1.ERC20_ABI, provider);
        this.lbQuoter = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LB_QUOTER), constants_1.LB_QUOTER_ABI, provider);
        this.routerContract = ARENA_ROUTER
            ? new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(ARENA_ROUTER), ARENA_ROUTER_ABI, provider)
            : null;
    }
    get routerAddress() {
        return ARENA_ROUTER;
    }
    /** Get a buy quote: how much ARENA for a given AVAX amount */
    async getQuote(avaxAmount) {
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n;
        const netAmount = amountIn - fee;
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
        const arenaOut = quote.amounts[quote.amounts.length - 1];
        const decimals = await this.arenaToken.decimals();
        return {
            arenaOut: ethers_1.ethers.formatUnits(arenaOut, decimals),
            fee: ethers_1.ethers.formatEther(fee),
            netAvax: ethers_1.ethers.formatEther(netAmount),
        };
    }
    /** Get a sell quote: how much AVAX for a given ARENA amount */
    async getSellQuote(arenaAmount) {
        const decimals = await this.arenaToken.decimals();
        const amountIn = ethers_1.ethers.parseUnits(arenaAmount, decimals);
        const route = [constants_1.ARENA_TOKEN, constants_1.WAVAX];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
        const avaxOut = quote.amounts[quote.amounts.length - 1];
        return {
            avaxOut: ethers_1.ethers.formatEther(avaxOut),
            arenaIn: arenaAmount,
        };
    }
    /** Get wallet balances */
    async getBalances(wallet) {
        const [avax, arena] = await Promise.all([
            this.provider.getBalance(wallet),
            this.arenaToken.balanceOf(wallet),
        ]);
        const decimals = await this.arenaToken.decimals();
        return {
            avax: ethers_1.ethers.formatEther(avax),
            arena: ethers_1.ethers.formatUnits(arena, decimals),
        };
    }
    /** Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee) */
    async buildBuyTx(wallet, avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        if (!ARENA_ROUTER)
            throw new Error("ARENA_ROUTER contract not configured");
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n;
        const netAmount = amountIn - fee;
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const path = {
            pairBinSteps: [...quote.binSteps].map((b) => b.toString()),
            versions: [...quote.versions].map((v) => Number(v)),
            tokenPath: [...route],
        };
        const iface = new ethers_1.ethers.Interface(ARENA_ROUTER_ABI);
        const data = iface.encodeFunctionData("buyArena", [path, amountOutMin, deadline]);
        return {
            to: ethers_1.ethers.getAddress(ARENA_ROUTER),
            data,
            value: ethers_1.ethers.toBeHex(amountIn),
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Buy ARENA with ${avaxAmount} AVAX (0.3% fee: ${ethers_1.ethers.formatEther(fee)} AVAX). IMPORTANT: Use gasLimit 500000 — default gas estimates are too low for DEX swaps.`,
        };
    }
    /** Build unsigned txs to sell ARENA for AVAX via LFJ DEX: [approve, swap] */
    async buildSellArenaTx(wallet, arenaAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const decimals = await this.arenaToken.decimals();
        let sellAmount;
        if (arenaAmount === "max") {
            sellAmount = await this.arenaToken.balanceOf(wallet);
            if (sellAmount === 0n)
                throw new Error("No ARENA balance to sell");
        }
        else {
            sellAmount = ethers_1.ethers.parseUnits(arenaAmount, decimals);
        }
        const route = [constants_1.ARENA_TOKEN, constants_1.WAVAX];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, sellAmount);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const path = {
            pairBinSteps: [...quote.binSteps].map((b) => b.toString()),
            versions: [...quote.versions].map((v) => Number(v)),
            tokenPath: [...route],
        };
        const approveIface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const approveData = approveIface.encodeFunctionData("approve", [
            ethers_1.ethers.getAddress(constants_1.LB_ROUTER), sellAmount,
        ]);
        const approveTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN),
            data: approveData,
            value: "0",
            chainId: 43114,
            gas: "60000",
            gasLimit: "60000",
            description: `Approve ${ethers_1.ethers.formatUnits(sellAmount, decimals)} ARENA for swap`,
        };
        const swapIface = new ethers_1.ethers.Interface(constants_1.LB_ROUTER_ABI);
        const swapData = swapIface.encodeFunctionData("swapExactTokensForNATIVE", [
            sellAmount, amountOutMin, path, wallet, deadline,
        ]);
        const swapTx = {
            to: ethers_1.ethers.getAddress(constants_1.LB_ROUTER),
            data: swapData,
            value: "0",
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Sell ${ethers_1.ethers.formatUnits(sellAmount, decimals)} ARENA for ~${ethers_1.ethers.formatEther(expectedOut)} AVAX`,
        };
        return [approveTx, swapTx];
    }
}
exports.SwapModule = SwapModule;
//# sourceMappingURL=index.js.map