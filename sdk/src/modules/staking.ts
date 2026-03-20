import { ethers, type JsonRpcProvider } from "ethers";
import {
  ARENA_TOKEN, ARENA_STAKING, WAVAX, LB_QUOTER,
  ERC20_ABI, ARENA_STAKING_ABI, LB_QUOTER_ABI, LB_ROUTER_ABI, LB_ROUTER,
  DEFAULT_SLIPPAGE_BPS, CHAIN_ID,
} from "../constants.js";
import type { UnsignedTx } from "../types.js";

export class StakingModule {
  private arenaToken: ethers.Contract;
  private staking: ethers.Contract;

  constructor(private provider: JsonRpcProvider) {
    this.arenaToken = new ethers.Contract(ethers.getAddress(ARENA_TOKEN), ERC20_ABI, provider);
    this.staking = new ethers.Contract(ethers.getAddress(ARENA_STAKING), ARENA_STAKING_ABI, provider);
  }

  /** Get staking info — staked amount, pending rewards */
  async getInfo(wallet: string): Promise<{ staked: string; stakedFormatted: string; rewards: string; rewardsFormatted: string }> {
    const decimals = await this.arenaToken.decimals();
    const [stakedRaw] = await this.staking.getUserInfo(wallet, ethers.getAddress(ARENA_TOKEN));
    const pendingRaw = await this.staking.pendingReward(wallet, ethers.getAddress(ARENA_TOKEN));
    return {
      staked: stakedRaw.toString(),
      stakedFormatted: ethers.formatUnits(stakedRaw, decimals),
      rewards: pendingRaw.toString(),
      rewardsFormatted: ethers.formatUnits(pendingRaw, decimals),
    };
  }

  /** Build txs to stake ARENA: [approve, deposit] */
  async buildStake(wallet: string, amount: string): Promise<{ transactions: UnsignedTx[] }> {
    const decimals = await this.arenaToken.decimals();
    let stakeAmount: bigint;
    if (amount === "max") {
      stakeAmount = await this.arenaToken.balanceOf(wallet);
    } else {
      stakeAmount = ethers.parseUnits(amount, decimals);
    }

    const approveIface = new ethers.Interface(ERC20_ABI);
    const approveData = approveIface.encodeFunctionData("approve", [ethers.getAddress(ARENA_STAKING), stakeAmount]);

    const stakingIface = new ethers.Interface(ARENA_STAKING_ABI);
    const stakeData = stakingIface.encodeFunctionData("deposit", [stakeAmount]);

    return {
      transactions: [
        {
          to: ethers.getAddress(ARENA_TOKEN),
          data: approveData,
          value: "0",
          chainId: CHAIN_ID,
          gasLimit: "60000",
          description: `Approve ${ethers.formatUnits(stakeAmount, decimals)} ARENA for staking`,
        },
        {
          to: ethers.getAddress(ARENA_STAKING),
          data: stakeData,
          value: "0",
          chainId: CHAIN_ID,
          gasLimit: "300000",
          description: `Stake ${ethers.formatUnits(stakeAmount, decimals)} ARENA`,
        },
      ],
    };
  }

  /** Build tx to unstake ARENA + claim rewards */
  async buildUnstake(wallet: string, amount: string): Promise<{ transactions: UnsignedTx[] }> {
    const decimals = await this.arenaToken.decimals();
    let withdrawAmount: bigint;
    if (amount === "max") {
      const [stakedRaw] = await this.staking.getUserInfo(wallet, ethers.getAddress(ARENA_TOKEN));
      withdrawAmount = stakedRaw;
    } else {
      withdrawAmount = ethers.parseUnits(amount, decimals);
    }

    const iface = new ethers.Interface(ARENA_STAKING_ABI);
    const data = iface.encodeFunctionData("withdraw", [withdrawAmount]);

    return {
      transactions: [{
        to: ethers.getAddress(ARENA_STAKING),
        data,
        value: "0",
        chainId: CHAIN_ID,
        gasLimit: "300000",
        description: `Unstake ${ethers.formatUnits(withdrawAmount, decimals)} ARENA + claim rewards`,
      }],
    };
  }

  /** Build buy-and-stake flow (3 txs): buy ARENA via LFJ, approve, stake */
  async buildBuyAndStake(wallet: string, avaxAmount: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<{ transactions: UnsignedTx[] }> {
    const lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, this.provider);
    const amountIn = ethers.parseEther(avaxAmount);
    const route = [WAVAX, ARENA_TOKEN];
    const quote = await lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const expectedOut: bigint = quote.amounts[quote.amounts.length - 1];
    const clampedSlippage = BigInt(Math.max(0, Math.min(10000, Number(slippageBps))));
    const amountOutMin = expectedOut - (expectedOut * clampedSlippage) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const decimals = await this.arenaToken.decimals();

    const path = {
      pairBinSteps: [...quote.binSteps].map((b: any) => b.toString()),
      versions: [...quote.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    const routerIface = new ethers.Interface(LB_ROUTER_ABI);
    const buyData = routerIface.encodeFunctionData("swapExactNATIVEForTokens", [amountOutMin, path, wallet, deadline]);

    const erc20Iface = new ethers.Interface(ERC20_ABI);
    const approveData = erc20Iface.encodeFunctionData("approve", [ethers.getAddress(ARENA_STAKING), ethers.MaxUint256]);

    const stakingIface = new ethers.Interface(ARENA_STAKING_ABI);
    const stakeData = stakingIface.encodeFunctionData("deposit", [expectedOut]);

    return {
      transactions: [
        {
          to: ethers.getAddress(LB_ROUTER),
          data: buyData,
          value: ethers.toBeHex(amountIn, 32),
          chainId: CHAIN_ID,
          gasLimit: "500000",
          description: `Step 1/3: Buy ~${ethers.formatUnits(expectedOut, decimals)} ARENA with ${avaxAmount} AVAX`,
        },
        {
          to: ethers.getAddress(ARENA_TOKEN),
          data: approveData,
          value: "0",
          chainId: CHAIN_ID,
          gasLimit: "60000",
          description: `Step 2/3: Approve ARENA for staking`,
        },
        {
          to: ethers.getAddress(ARENA_STAKING),
          data: stakeData,
          value: "0",
          chainId: CHAIN_ID,
          gasLimit: "300000",
          description: `Step 3/3: Stake ~${ethers.formatUnits(expectedOut, decimals)} ARENA`,
        },
      ],
    };
  }
}
