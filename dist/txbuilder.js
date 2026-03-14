"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxBuilder = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ethers_1 = require("ethers");
const constants_1 = require("./constants");
// ArenaRouter wrapper contract (deployed by you, collects 0.3% fee)
const ARENA_ROUTER = process.env.ARENA_ROUTER || "";
// Minimal ABI for the ArenaRouter wrapper contract
const ARENA_ROUTER_ABI = [
    "function buyArena(tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, uint256 amountOutMin, uint256 deadline) payable returns (uint256 arenaOut)",
    "function feeBps() view returns (uint256)",
];
class TxBuilder {
    constructor(rpcUrl) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl || constants_1.RPC_URL);
        this.arenaToken = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN), constants_1.ERC20_ABI, this.provider);
        this.lbQuoter = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LB_QUOTER), constants_1.LB_QUOTER_ABI, this.provider);
        if (ARENA_ROUTER) {
            this.routerContract = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(ARENA_ROUTER), ARENA_ROUTER_ABI, this.provider);
        }
        else {
            this.routerContract = null;
        }
    }
    get routerAddress() {
        return ARENA_ROUTER;
    }
    /** Get a quote: how much ARENA for a given AVAX amount */
    async getQuote(avaxAmount) {
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n; // 0.3%
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
    /** Get staking info for a wallet */
    async getStakeInfo(wallet) {
        const staking = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), constants_1.ARENA_STAKING_ABI, this.provider);
        const decimals = await this.arenaToken.decimals();
        const [stakedRaw] = await staking.getUserInfo(wallet, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
        const pendingRaw = await staking.pendingReward(wallet, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
        return {
            stakedAmount: ethers_1.ethers.formatUnits(stakedRaw, decimals),
            pendingRewards: ethers_1.ethers.formatUnits(pendingRaw, decimals),
        };
    }
    /**
     * Build unsigned tx to buy ARENA through the ArenaRouter (0.3% fee).
     */
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
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour for agents
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
            value: amountIn.toString(),
            chainId: 43114,
            gas: "500000",
            gasLimit: "500000",
            description: `Buy ARENA with ${avaxAmount} AVAX (0.3% fee: ${ethers_1.ethers.formatEther(fee)} AVAX). IMPORTANT: Use gasLimit 500000 — default gas estimates are too low for DEX swaps.`,
        };
    }
    /**
     * Build unsigned tx to approve ARENA for staking.
     */
    async buildApproveStakingTx(wallet, amount) {
        const decimals = await this.arenaToken.decimals();
        let approveAmount;
        if (amount === "max") {
            approveAmount = await this.arenaToken.balanceOf(wallet);
        }
        else {
            approveAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const data = iface.encodeFunctionData("approve", [ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), approveAmount]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN),
            data,
            value: "0",
            chainId: 43114,
            description: `Approve ${ethers_1.ethers.formatUnits(approveAmount, decimals)} ARENA for staking`,
        };
    }
    /**
     * Build unsigned tx to stake ARENA.
     */
    async buildStakeTx(wallet, amount) {
        const decimals = await this.arenaToken.decimals();
        let stakeAmount;
        if (amount === "max") {
            stakeAmount = await this.arenaToken.balanceOf(wallet);
        }
        else {
            stakeAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const iface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        const data = iface.encodeFunctionData("deposit", [stakeAmount]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data,
            value: "0",
            chainId: 43114,
            description: `Stake ${ethers_1.ethers.formatUnits(stakeAmount, decimals)} ARENA`,
        };
    }
    /**
     * Build unsigned tx to unstake ARENA.
     */
    async buildUnstakeTx(wallet, amount) {
        const decimals = await this.arenaToken.decimals();
        const staking = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), constants_1.ARENA_STAKING_ABI, this.provider);
        let withdrawAmount;
        if (amount === "max") {
            const [stakedRaw] = await staking.getUserInfo(wallet, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
            withdrawAmount = stakedRaw;
        }
        else {
            withdrawAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const iface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        const data = iface.encodeFunctionData("withdraw", [withdrawAmount]);
        return {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data,
            value: "0",
            chainId: 43114,
            description: `Unstake ${ethers_1.ethers.formatUnits(withdrawAmount, decimals)} ARENA`,
        };
    }
    /**
     * Build full buy-and-stake flow (3 transactions).
     */
    async buildBuyAndStakeTxs(wallet, avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const buyTx = await this.buildBuyTx(wallet, avaxAmount, slippageBps);
        // Approve max uint256 so any amount received from buy can be staked
        const iface = new ethers_1.ethers.Interface(constants_1.ERC20_ABI);
        const approveData = iface.encodeFunctionData("approve", [
            ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            ethers_1.ethers.MaxUint256,
        ]);
        const approveTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN),
            data: approveData,
            value: "0",
            chainId: 43114,
            description: "Approve ARENA for staking (unlimited)",
        };
        // Estimate ARENA output for the stake tx description
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const fee = (amountIn * 30n) / 10000n;
        const netAmount = amountIn - fee;
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, netAmount);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const decimals = await this.arenaToken.decimals();
        // Stake tx: use "max" to stake entire ARENA balance (agent must execute AFTER buy confirms)
        const stakingIface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        // We can't use "max" at build time since the buy hasn't happened yet,
        // so we use the estimated amount from the quote
        const stakeData = stakingIface.encodeFunctionData("deposit", [expectedOut]);
        const stakeTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data: stakeData,
            value: "0",
            chainId: 43114,
            description: `Stake ~${ethers_1.ethers.formatUnits(expectedOut, decimals)} ARENA`,
        };
        return [
            { ...buyTx, description: `Step 1/3: ${buyTx.description}` },
            { ...approveTx, description: `Step 2/3: ${approveTx.description}` },
            { ...stakeTx, description: `Step 3/3: ${stakeTx.description}` },
        ];
    }
    /** Broadcast a signed transaction */
    async broadcast(signedTx) {
        const txResponse = await this.provider.broadcastTransaction(signedTx);
        const receipt = await txResponse.wait();
        if (receipt && receipt.status === 0) {
            throw new Error(`Transaction reverted on-chain: ${txResponse.hash}`);
        }
        return txResponse.hash;
    }
}
exports.TxBuilder = TxBuilder;
//# sourceMappingURL=txbuilder.js.map