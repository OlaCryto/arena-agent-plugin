import { ethers, type JsonRpcProvider } from "ethers";
import { CHAIN_ID } from "../constants.js";
import type { UnsignedTx } from "../types.js";

// ── sAVAX (Benqi Liquid Staking) ──

const SAVAX_ADDRESS = "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE";
const SAVAX_ABI = [
  "function submit() payable returns (uint256)",
  "function requestUnlock(uint256 shareAmount) returns (uint256)",
  "function getPooledAvaxByShares(uint256 shareAmount) view returns (uint256)",
  "function getSharesByPooledAvax(uint256 avaxAmount) view returns (uint256)",
  "function totalPooledAvax() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function cooldownPeriod() view returns (uint256)",
  "function exchangeRate() view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

// ── ERC-4626 Vault ABI ──

const VAULT_ABI = [
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export class DefiModule {
  private savax: ethers.Contract;

  constructor(private provider: JsonRpcProvider) {
    this.savax = new ethers.Contract(ethers.getAddress(SAVAX_ADDRESS), SAVAX_ABI, provider);
  }

  // ── sAVAX Liquid Staking ──

  /** Get sAVAX staking info: exchange rate, total staked, your balance */
  async sAvaxInfo(wallet?: string): Promise<{
    exchangeRate: string; totalPooledAvax: string; totalShares: string;
    balance?: string; balanceInAvax?: string;
  }> {
    const [totalPooled, totalShares] = await Promise.all([
      this.savax.totalPooledAvax(),
      this.savax.totalShares(),
    ]);
    const exchangeRate = totalShares > 0n
      ? ethers.formatEther((totalPooled * ethers.parseEther("1")) / totalShares)
      : "1.0";

    const result: any = {
      exchangeRate,
      totalPooledAvax: ethers.formatEther(totalPooled),
      totalShares: ethers.formatEther(totalShares),
    };

    if (wallet) {
      const balance: bigint = await this.savax.balanceOf(wallet);
      const avaxValue: bigint = await this.savax.getPooledAvaxByShares(balance);
      result.balance = ethers.formatEther(balance);
      result.balanceInAvax = ethers.formatEther(avaxValue);
    }
    return result;
  }

  /** Quote: how much sAVAX for staking AVAX */
  async sAvaxStakeQuote(avaxAmount: string): Promise<{ avaxIn: string; savaxOut: string }> {
    const avaxWei = ethers.parseEther(avaxAmount);
    const shares: bigint = await this.savax.getSharesByPooledAvax(avaxWei);
    return { avaxIn: avaxAmount, savaxOut: ethers.formatEther(shares) };
  }

  /** Build tx to stake AVAX → sAVAX */
  async buildSAvaxStake(avaxAmount: string): Promise<{ transactions: UnsignedTx[] }> {
    const avaxWei = ethers.parseEther(avaxAmount);
    const iface = new ethers.Interface(SAVAX_ABI);
    const data = iface.encodeFunctionData("submit", []);
    return {
      transactions: [{
        to: ethers.getAddress(SAVAX_ADDRESS),
        data,
        value: ethers.toBeHex(avaxWei, 32),
        chainId: CHAIN_ID,
        gasLimit: "300000",
        description: `Stake ${avaxAmount} AVAX → sAVAX`,
      }],
    };
  }

  /** Build tx to request unstake sAVAX → AVAX (delayed) */
  async buildSAvaxUnstake(wallet: string, amount: string): Promise<{ transactions: UnsignedTx[] }> {
    let shareAmount: bigint;
    if (amount === "max") {
      shareAmount = await this.savax.balanceOf(wallet);
    } else {
      shareAmount = ethers.parseEther(amount);
    }
    if (shareAmount === 0n) throw new Error("Zero sAVAX balance");

    const iface = new ethers.Interface(SAVAX_ABI);
    const data = iface.encodeFunctionData("requestUnlock", [shareAmount]);
    return {
      transactions: [{
        to: ethers.getAddress(SAVAX_ADDRESS),
        data,
        value: "0",
        chainId: CHAIN_ID,
        gasLimit: "300000",
        description: `Request unstake ${ethers.formatEther(shareAmount)} sAVAX`,
      }],
    };
  }

  // ── ERC-4626 Vaults ──

  /** Get info about any ERC-4626 vault */
  async vaultInfo(vaultAddress: string, wallet?: string): Promise<{
    name: string; symbol: string; asset: string; totalAssets: string;
    totalSupply: string; sharePrice: string;
    userShares?: string; userAssets?: string;
  }> {
    const vault = new ethers.Contract(ethers.getAddress(vaultAddress), VAULT_ABI, this.provider);
    const [name, symbol, asset, totalAssets, totalSupply, decimals] = await Promise.all([
      vault.name(), vault.symbol(), vault.asset(),
      vault.totalAssets(), vault.totalSupply(), vault.decimals(),
    ]);

    const sharePrice = totalSupply > 0n
      ? ethers.formatUnits((totalAssets * (10n ** BigInt(decimals))) / totalSupply, decimals)
      : "1.0";

    const result: any = {
      name, symbol, asset,
      totalAssets: ethers.formatUnits(totalAssets, decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      sharePrice,
    };

    if (wallet) {
      const shares: bigint = await vault.balanceOf(wallet);
      const assets: bigint = shares > 0n ? await vault.convertToAssets(shares) : 0n;
      result.userShares = ethers.formatUnits(shares, decimals);
      result.userAssets = ethers.formatUnits(assets, decimals);
    }
    return result;
  }

  /** Quote vault deposit — how many shares for given assets */
  async vaultDepositQuote(vaultAddress: string, amount: string): Promise<{ assetsIn: string; sharesOut: string }> {
    const vault = new ethers.Contract(ethers.getAddress(vaultAddress), VAULT_ABI, this.provider);
    const decimals = Number(await vault.decimals());
    const assetsWei = ethers.parseUnits(amount, decimals);
    const shares: bigint = await vault.previewDeposit(assetsWei);
    return { assetsIn: amount, sharesOut: ethers.formatUnits(shares, decimals) };
  }

  /** Build txs to deposit into an ERC-4626 vault: [approve, deposit] */
  async buildVaultDeposit(wallet: string, vaultAddress: string, amount: string): Promise<{ transactions: UnsignedTx[] }> {
    const vaultAddr = ethers.getAddress(vaultAddress);
    const vault = new ethers.Contract(vaultAddr, VAULT_ABI, this.provider);
    const assetAddr: string = await vault.asset();
    const assetToken = new ethers.Contract(assetAddr, ERC20_ABI, this.provider);
    const decimals = Number(await assetToken.decimals());

    let depositAmount: bigint;
    if (amount === "max") {
      depositAmount = await assetToken.balanceOf(wallet);
    } else {
      depositAmount = ethers.parseUnits(amount, decimals);
    }
    if (depositAmount === 0n) throw new Error("Zero balance to deposit");

    const erc20Iface = new ethers.Interface(ERC20_ABI);
    const approveData = erc20Iface.encodeFunctionData("approve", [vaultAddr, depositAmount]);
    const vaultIface = new ethers.Interface(VAULT_ABI);
    const depositData = vaultIface.encodeFunctionData("deposit", [depositAmount, wallet]);

    return {
      transactions: [
        { to: assetAddr, data: approveData, value: "0", chainId: CHAIN_ID, gasLimit: "60000", description: `Approve asset for vault deposit` },
        { to: vaultAddr, data: depositData, value: "0", chainId: CHAIN_ID, gasLimit: "300000", description: `Deposit ${ethers.formatUnits(depositAmount, decimals)} into vault` },
      ],
    };
  }

  /** Build tx to withdraw from an ERC-4626 vault */
  async buildVaultWithdraw(wallet: string, vaultAddress: string, amount: string): Promise<{ transactions: UnsignedTx[] }> {
    const vaultAddr = ethers.getAddress(vaultAddress);
    const vault = new ethers.Contract(vaultAddr, VAULT_ABI, this.provider);
    const decimals = Number(await vault.decimals());

    let withdrawAmount: bigint;
    if (amount === "max") {
      const shares: bigint = await vault.balanceOf(wallet);
      withdrawAmount = await vault.convertToAssets(shares);
    } else {
      withdrawAmount = ethers.parseUnits(amount, decimals);
    }
    if (withdrawAmount === 0n) throw new Error("Nothing to withdraw");

    const iface = new ethers.Interface(VAULT_ABI);
    const data = iface.encodeFunctionData("withdraw", [withdrawAmount, wallet, wallet]);

    return {
      transactions: [{
        to: vaultAddr, data, value: "0", chainId: CHAIN_ID, gasLimit: "300000",
        description: `Withdraw ${ethers.formatUnits(withdrawAmount, decimals)} from vault`,
      }],
    };
  }
}
