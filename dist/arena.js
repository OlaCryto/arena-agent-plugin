"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArenaPlugin = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("./constants");
class ArenaPlugin {
    constructor(privateKey, rpcUrl) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl || constants_1.RPC_URL);
        this.wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        this.arenaToken = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN), constants_1.ERC20_ABI, this.wallet);
        this.staking = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_STAKING), constants_1.ARENA_STAKING_ABI, this.wallet);
        this.lbRouter = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LB_ROUTER), constants_1.LB_ROUTER_ABI, this.wallet);
        this.lbQuoter = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.LB_QUOTER), constants_1.LB_QUOTER_ABI, this.provider);
    }
    get address() {
        return this.wallet.address;
    }
    /** Get AVAX balance of the agent wallet */
    async getAvaxBalance() {
        const bal = await this.provider.getBalance(this.wallet.address);
        return ethers_1.ethers.formatEther(bal);
    }
    /** Get ARENA token balance of the agent wallet */
    async getArenaBalance() {
        const bal = await this.arenaToken.balanceOf(this.wallet.address);
        const decimals = await this.arenaToken.decimals();
        return ethers_1.ethers.formatUnits(bal, decimals);
    }
    /** Get a quote: how much ARENA for a given amount of AVAX */
    async getQuote(avaxAmount) {
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        try {
            const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
            const amountsOut = quote.amounts;
            const arenaOut = amountsOut[amountsOut.length - 1];
            const decimals = await this.arenaToken.decimals();
            return ethers_1.ethers.formatUnits(arenaOut, decimals);
        }
        catch {
            throw new Error("Failed to get quote — no liquidity path found for AVAX→ARENA");
        }
    }
    /**
     * Buy ARENA tokens with AVAX via LFJ Router V2.2.
     * @param avaxAmount Amount of AVAX to spend (e.g. "1.5")
     * @param slippageBps Slippage tolerance in basis points (default 100 = 1%)
     */
    async buyArena(avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const amountIn = ethers_1.ethers.parseEther(avaxAmount);
        const route = [constants_1.WAVAX, constants_1.ARENA_TOKEN];
        // Get quote for minimum output
        const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
        const expectedOut = quote.amounts[quote.amounts.length - 1];
        const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
        const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
        // Copy arrays — ethers v6 returns frozen/read-only Result objects
        const path = {
            pairBinSteps: [...quote.binSteps],
            versions: [...quote.versions],
            tokenPath: [...route],
        };
        const tx = await this.lbRouter.swapExactNATIVEForTokens(amountOutMin, path, this.wallet.address, deadline, { value: amountIn });
        const receipt = await tx.wait();
        const decimals = await this.arenaToken.decimals();
        return {
            txHash: receipt.hash,
            amountIn: avaxAmount,
            amountOut: ethers_1.ethers.formatUnits(expectedOut, decimals),
        };
    }
    /**
     * Stake ARENA tokens into the Arena staking contract.
     * Approves + deposits in one flow.
     * @param amount Amount of ARENA to stake (e.g. "1000"). Use "max" to stake entire balance.
     */
    async stakeArena(amount) {
        const decimals = await this.arenaToken.decimals();
        let stakeAmount;
        if (amount === "max") {
            stakeAmount = await this.arenaToken.balanceOf(this.wallet.address);
            if (stakeAmount === 0n)
                throw new Error("No ARENA tokens to stake");
        }
        else {
            stakeAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        // Check current allowance
        const currentAllowance = await this.arenaToken.allowance(this.wallet.address, constants_1.ARENA_STAKING);
        let approveTxHash = "already-approved";
        if (currentAllowance < stakeAmount) {
            const approveTx = await this.arenaToken.approve(constants_1.ARENA_STAKING, stakeAmount);
            const approveReceipt = await approveTx.wait();
            approveTxHash = approveReceipt.hash;
        }
        // Deposit into staking contract
        const stakeTx = await this.staking.deposit(stakeAmount);
        const stakeReceipt = await stakeTx.wait();
        return {
            approveTxHash,
            stakeTxHash: stakeReceipt.hash,
            amountStaked: ethers_1.ethers.formatUnits(stakeAmount, decimals),
        };
    }
    /**
     * Buy ARENA with AVAX and immediately stake it.
     * @param avaxAmount Amount of AVAX to spend
     * @param slippageBps Slippage tolerance in basis points
     */
    async buyAndStake(avaxAmount, slippageBps = constants_1.DEFAULT_SLIPPAGE_BPS) {
        const buy = await this.buyArena(avaxAmount, slippageBps);
        const stake = await this.stakeArena("max");
        return { buy, stake };
    }
    /** Get staking info for the agent wallet */
    async getStakeInfo() {
        const decimals = await this.arenaToken.decimals();
        const [stakedRaw] = await this.staking.getUserInfo(this.wallet.address, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
        const pendingRaw = await this.staking.pendingReward(this.wallet.address, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
        return {
            stakedAmount: ethers_1.ethers.formatUnits(stakedRaw, decimals),
            pendingRewards: ethers_1.ethers.formatUnits(pendingRaw, decimals),
        };
    }
    /** Withdraw staked ARENA (also claims pending rewards) */
    async unstake(amount) {
        const decimals = await this.arenaToken.decimals();
        let withdrawAmount;
        if (amount === "max") {
            const [stakedRaw] = await this.staking.getUserInfo(this.wallet.address, ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN));
            withdrawAmount = stakedRaw;
            if (withdrawAmount === 0n)
                throw new Error("Nothing staked to withdraw");
        }
        else {
            withdrawAmount = ethers_1.ethers.parseUnits(amount, decimals);
        }
        const tx = await this.staking.withdraw(withdrawAmount);
        const receipt = await tx.wait();
        return {
            txHash: receipt.hash,
            amountWithdrawn: ethers_1.ethers.formatUnits(withdrawAmount, decimals),
        };
    }
}
exports.ArenaPlugin = ArenaPlugin;
//# sourceMappingURL=arena.js.map