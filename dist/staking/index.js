"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StakingModule = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("../core/constants");
class StakingModule {
    constructor(provider, swap) {
        this.provider = provider;
        this.swap = swap;
        this.arenaToken = new ethers_1.ethers.Contract(ethers_1.ethers.getAddress(constants_1.ARENA_TOKEN), constants_1.ERC20_ABI, provider);
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
    /** Build unsigned tx to approve ARENA for staking */
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
            gas: "60000",
            gasLimit: "60000",
            description: `Approve ${ethers_1.ethers.formatUnits(approveAmount, decimals)} ARENA for staking`,
        };
    }
    /** Build unsigned tx to stake ARENA */
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
            gas: "300000",
            gasLimit: "300000",
            description: `Stake ${ethers_1.ethers.formatUnits(stakeAmount, decimals)} ARENA`,
        };
    }
    /** Build unsigned tx to unstake ARENA */
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
            gas: "300000",
            gasLimit: "300000",
            description: `Unstake ${ethers_1.ethers.formatUnits(withdrawAmount, decimals)} ARENA`,
        };
    }
    /** Build full buy-and-stake flow (3 transactions) */
    async buildBuyAndStakeTxs(wallet, avaxAmount, slippageBps) {
        const buyTx = await this.swap.buildBuyTx(wallet, avaxAmount, slippageBps);
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
            gas: "60000",
            gasLimit: "60000",
            description: "Approve ARENA for staking (max allowance)",
        };
        const stakingIface = new ethers_1.ethers.Interface(constants_1.ARENA_STAKING_ABI);
        const stakeData = stakingIface.encodeFunctionData("deposit", [ethers_1.ethers.MaxUint256]);
        const stakeTx = {
            to: ethers_1.ethers.getAddress(constants_1.ARENA_STAKING),
            data: stakeData,
            value: "0",
            chainId: 43114,
            gas: "300000",
            gasLimit: "300000",
            description: "Stake all received ARENA",
        };
        return [buyTx, approveTx, stakeTx];
    }
}
exports.StakingModule = StakingModule;
//# sourceMappingURL=index.js.map