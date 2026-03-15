import { ethers } from "ethers";
import {
  ARENA_TOKEN, ARENA_STAKING,
  ERC20_ABI, ARENA_STAKING_ABI,
} from "../core/constants";
import type { UnsignedTx } from "../core/types";
import type { SwapModule } from "../swap";

export class StakingModule {
  private arenaToken: ethers.Contract;

  constructor(
    private provider: ethers.JsonRpcProvider,
    private swap: SwapModule,
  ) {
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, provider);
  }

  /** Get staking info for a wallet */
  async getStakeInfo(wallet: string): Promise<{ stakedAmount: string; pendingRewards: string }> {
    const staking = new ethers.Contract(ethers.getAddress(ARENA_STAKING), ARENA_STAKING_ABI, this.provider);
    const decimals = await this.arenaToken.decimals();
    const [stakedRaw] = await staking.getUserInfo(wallet, ethers.getAddress(ARENA_TOKEN));
    const pendingRaw = await staking.pendingReward(wallet, ethers.getAddress(ARENA_TOKEN));
    return {
      stakedAmount: ethers.formatUnits(stakedRaw, decimals),
      pendingRewards: ethers.formatUnits(pendingRaw, decimals),
    };
  }

  /** Build unsigned tx to approve ARENA for staking */
  async buildApproveStakingTx(wallet: string, amount: string): Promise<UnsignedTx> {
    const decimals = await this.arenaToken.decimals();
    let approveAmount: bigint;

    if (amount === "max") {
      approveAmount = await this.arenaToken.balanceOf(wallet);
    } else {
      approveAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData("approve", [ethers.getAddress(ARENA_STAKING), approveAmount]);

    return {
      to: ethers.getAddress(ARENA_TOKEN),
      data,
      value: "0",
      chainId: 43114,
      gas: "60000",
      gasLimit: "60000",
      description: `Approve ${ethers.formatUnits(approveAmount, decimals)} ARENA for staking`,
    };
  }

  /** Build unsigned tx to stake ARENA */
  async buildStakeTx(wallet: string, amount: string): Promise<UnsignedTx> {
    const decimals = await this.arenaToken.decimals();
    let stakeAmount: bigint;

    if (amount === "max") {
      stakeAmount = await this.arenaToken.balanceOf(wallet);
    } else {
      stakeAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ARENA_STAKING_ABI);
    const data = iface.encodeFunctionData("deposit", [stakeAmount]);

    return {
      to: ethers.getAddress(ARENA_STAKING),
      data,
      value: "0",
      chainId: 43114,
      gas: "300000",
      gasLimit: "300000",
      description: `Stake ${ethers.formatUnits(stakeAmount, decimals)} ARENA`,
    };
  }

  /** Build unsigned tx to unstake ARENA */
  async buildUnstakeTx(wallet: string, amount: string): Promise<UnsignedTx> {
    const decimals = await this.arenaToken.decimals();
    const staking = new ethers.Contract(ethers.getAddress(ARENA_STAKING), ARENA_STAKING_ABI, this.provider);
    let withdrawAmount: bigint;

    if (amount === "max") {
      const [stakedRaw] = await staking.getUserInfo(wallet, ethers.getAddress(ARENA_TOKEN));
      withdrawAmount = stakedRaw;
    } else {
      withdrawAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ARENA_STAKING_ABI);
    const data = iface.encodeFunctionData("withdraw", [withdrawAmount]);

    return {
      to: ethers.getAddress(ARENA_STAKING),
      data,
      value: "0",
      chainId: 43114,
      gas: "300000",
      gasLimit: "300000",
      description: `Unstake ${ethers.formatUnits(withdrawAmount, decimals)} ARENA`,
    };
  }

  /** Build full buy-and-stake flow (3 transactions) */
  async buildBuyAndStakeTxs(
    wallet: string,
    avaxAmount: string,
    slippageBps?: number
  ): Promise<UnsignedTx[]> {
    const buyTx = await this.swap.buildBuyTx(wallet, avaxAmount, slippageBps);

    const iface = new ethers.Interface(ERC20_ABI);
    const approveData = iface.encodeFunctionData("approve", [
      ethers.getAddress(ARENA_STAKING),
      ethers.MaxUint256,
    ]);
    const approveTx: UnsignedTx = {
      to: ethers.getAddress(ARENA_TOKEN),
      data: approveData,
      value: "0",
      chainId: 43114,
      gas: "60000",
      gasLimit: "60000",
      description: "Approve ARENA for staking (max allowance)",
    };

    const stakingIface = new ethers.Interface(ARENA_STAKING_ABI);
    const stakeData = stakingIface.encodeFunctionData("deposit", [ethers.MaxUint256]);
    const stakeTx: UnsignedTx = {
      to: ethers.getAddress(ARENA_STAKING),
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
