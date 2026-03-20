import { ethers, type JsonRpcProvider } from "ethers";
import { ARENA_SHARES_CONTRACT, SHARES_ABI, FRACTION_SCALER, CHAIN_ID } from "../constants.js";
import type { UnsignedTx } from "../types.js";

export interface TicketPriceResponse { price: string; priceWithFee?: string; priceAfterFee?: string; tickets: string; fractionalAmount: number; }
export interface TicketBalanceResponse { tickets: string; fractionalAmount: string; }
export interface TicketSupplyResponse { wholeSupply: string; fractionalSupply: string; tickets: string; }
export interface TicketFeesResponse { protocolFee: string; subjectFee: string; referralFee: string; totalFeePercent: string; }

export class TicketsModule {
  private contract: ethers.Contract;

  constructor(private provider: JsonRpcProvider) {
    this.contract = new ethers.Contract(ethers.getAddress(ARENA_SHARES_CONTRACT), SHARES_ABI, provider);
  }

  async getBuyPrice(subject: string, amount = "1"): Promise<TicketPriceResponse> {
    const fractionalAmount = this.ticketsToFractional(amount);
    const subjectAddr = ethers.getAddress(subject);
    const [price, priceWithFee] = await Promise.all([
      this.contract.getBuyPriceForFractionalShares(subjectAddr, fractionalAmount),
      this.contract.getBuyPriceForFractionalSharesAfterFee(subjectAddr, fractionalAmount),
    ]);
    return { price: ethers.formatEther(price), priceWithFee: ethers.formatEther(priceWithFee), tickets: amount, fractionalAmount };
  }

  async getSellPrice(subject: string, amount = "1"): Promise<TicketPriceResponse> {
    const fractionalAmount = this.ticketsToFractional(amount);
    const subjectAddr = ethers.getAddress(subject);
    const [price, priceAfterFee] = await Promise.all([
      this.contract.getSellPriceForFractionalShares(subjectAddr, fractionalAmount),
      this.contract.getSellPriceForFractionalSharesAfterFee(subjectAddr, fractionalAmount),
    ]);
    return { price: ethers.formatEther(price), priceAfterFee: ethers.formatEther(priceAfterFee), tickets: amount, fractionalAmount };
  }

  async getBalance(subject: string, user: string): Promise<TicketBalanceResponse> {
    const frac: bigint = await this.contract.getMyFractionalShares(ethers.getAddress(subject), ethers.getAddress(user));
    return { tickets: (Number(frac) / FRACTION_SCALER).toString(), fractionalAmount: frac.toString() };
  }

  async getSupply(subject: string): Promise<TicketSupplyResponse> {
    const subjectAddr = ethers.getAddress(subject);
    const [wholeSupply, fracSupply] = await Promise.all([
      this.contract.getSharesSupply(subjectAddr),
      this.contract.getTotalFractionalSupply(subjectAddr),
    ]);
    return { wholeSupply: wholeSupply.toString(), fractionalSupply: fracSupply.toString(), tickets: (Number(fracSupply) / FRACTION_SCALER).toString() };
  }

  async getFees(): Promise<TicketFeesResponse> {
    const [protocol, subject, referral] = await Promise.all([
      this.contract.protocolFeePercent(),
      this.contract.subjectFeePercent(),
      this.contract.referralFeePercent(),
    ]);
    const toPercent = (v: bigint) => (Number(v) / 1e16).toFixed(1) + "%";
    return { protocolFee: toPercent(protocol), subjectFee: toPercent(subject), referralFee: toPercent(referral), totalFeePercent: toPercent(protocol + subject + referral) };
  }

  async buildBuyTx(wallet: string, subject: string, amount = "1"): Promise<{ transaction: UnsignedTx }> {
    const fractionalAmount = this.ticketsToFractional(amount);
    const subjectAddr = ethers.getAddress(subject);
    const userAddr = ethers.getAddress(wallet);
    const cost: bigint = await this.contract.getBuyPriceForFractionalSharesAfterFee(subjectAddr, fractionalAmount);
    if (cost === 0n) throw new Error("Could not get buy price — subject may not exist");

    const iface = new ethers.Interface(SHARES_ABI);
    const data = iface.encodeFunctionData("buyFractionalShares", [subjectAddr, userAddr, fractionalAmount]);

    return {
      transaction: {
        to: ethers.getAddress(ARENA_SHARES_CONTRACT),
        data,
        value: ethers.toBeHex(cost, 32),
        chainId: CHAIN_ID,
        gasLimit: "200000",
        description: `Buy ${amount} ticket(s) for ~${ethers.formatEther(cost)} AVAX`,
      },
    };
  }

  async buildSellTx(wallet: string, subject: string, amount = "1"): Promise<{ transaction: UnsignedTx }> {
    const fractionalAmount = this.ticketsToFractional(amount);
    const subjectAddr = ethers.getAddress(subject);
    const userAddr = ethers.getAddress(wallet);

    const balance: bigint = await this.contract.getMyFractionalShares(subjectAddr, userAddr);
    if (balance < BigInt(fractionalAmount)) {
      throw new Error(`Insufficient tickets: have ${(Number(balance) / FRACTION_SCALER)}, trying to sell ${amount}`);
    }

    const proceeds: bigint = await this.contract.getSellPriceForFractionalSharesAfterFee(subjectAddr, fractionalAmount);
    const iface = new ethers.Interface(SHARES_ABI);
    const data = iface.encodeFunctionData("sellFractionalShares", [subjectAddr, userAddr, fractionalAmount]);

    return {
      transaction: {
        to: ethers.getAddress(ARENA_SHARES_CONTRACT),
        data,
        value: "0x0",
        chainId: CHAIN_ID,
        gasLimit: "200000",
        description: `Sell ${amount} ticket(s) for ~${ethers.formatEther(proceeds)} AVAX`,
      },
    };
  }

  private ticketsToFractional(tickets: string): number {
    const num = parseFloat(tickets);
    if (isNaN(num) || num <= 0) throw new Error(`Invalid ticket amount: ${tickets}`);
    return Math.round(num * FRACTION_SCALER);
  }
}
