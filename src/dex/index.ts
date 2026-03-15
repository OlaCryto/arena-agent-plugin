import { ethers } from "ethers";
import {
  WAVAX, LB_ROUTER, LB_QUOTER,
  ERC20_ABI, LB_ROUTER_ABI, LB_QUOTER_ABI,
  DEFAULT_SLIPPAGE_BPS,
} from "../core/constants";
import type { UnsignedTx } from "../core/types";
import { POPULAR_TOKENS, resolveToken, type TokenInfo } from "./tokens";

// Additional LBRouter ABI for token→token swaps
const LB_ROUTER_EXTRA_ABI = [
  ...LB_ROUTER_ABI,
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
];

export class DexModule {
  private lbQuoter: ethers.Contract;

  constructor(private provider: ethers.JsonRpcProvider) {
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, provider);
  }

  /** List all known tokens */
  getTokenList(): TokenInfo[] {
    return Object.values(POPULAR_TOKENS);
  }

  /** Fetch on-chain token info for any address */
  async getTokenInfo(address: string): Promise<TokenInfo> {
    const addr = this.checksumAddr(address);
    const token = new ethers.Contract(addr, ERC20_ABI, this.provider);
    const [symbol, name, decimals] = await Promise.all([
      token.symbol(),
      token.name(),
      token.decimals(),
    ]);
    return { address: addr, symbol, name, decimals: Number(decimals) };
  }

  /** Normalize any address to proper EIP-55 checksum */
  private checksumAddr(addr: string): string {
    return ethers.getAddress(addr.toLowerCase());
  }

  /** Resolve a symbol or address to full token info, fetching on-chain if needed */
  async resolveTokenFull(input: string): Promise<TokenInfo> {
    const known = resolveToken(input);
    if (known) return { ...known, address: this.checksumAddr(known.address) };

    if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
      return this.getTokenInfo(input);
    }

    throw new Error(`Unknown token "${input}". Use a symbol (AVAX, USDC, JOE, etc.) or a contract address (0x...).`);
  }

  /** Get a quote for any token pair */
  async getQuote(
    fromInput: string,
    toInput: string,
    amount: string
  ): Promise<{
    fromToken: TokenInfo;
    toToken: TokenInfo;
    amountIn: string;
    amountOut: string;
    route: string[];
    priceImpact: string;
  }> {
    const fromToken = await this.resolveTokenFull(fromInput);
    const toToken = await this.resolveTokenFull(toInput);

    const amountIn = ethers.parseUnits(amount, fromToken.decimals);

    // Build route — if neither token is WAVAX, route through WAVAX
    const fromAddr = fromToken.symbol === "AVAX" ? WAVAX : fromToken.address;
    const toAddr = toToken.symbol === "AVAX" ? WAVAX : toToken.address;

    let route: string[];
    if (fromAddr.toLowerCase() === WAVAX.toLowerCase() || toAddr.toLowerCase() === WAVAX.toLowerCase()) {
      route = [fromAddr, toAddr];
    } else {
      route = [fromAddr, WAVAX, toAddr];
    }

    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const amountsArr: bigint[] = [...quote.amounts];
    const amountOut = amountsArr[amountsArr.length - 1];

    // Price impact: compare virtual (no-slippage) vs actual
    const virtualArr: bigint[] = [...quote.virtualAmountsWithoutSlippage];
    const virtualOut = virtualArr[virtualArr.length - 1];
    let impact = "0";
    if (virtualOut > 0n) {
      const impactBps = ((virtualOut - amountOut) * 10000n) / virtualOut;
      impact = (Number(impactBps) / 100).toFixed(2);
    }

    return {
      fromToken,
      toToken,
      amountIn: amount,
      amountOut: ethers.formatUnits(amountOut, toToken.decimals),
      route: route.map(a => {
        // Label the route with symbols
        for (const t of Object.values(POPULAR_TOKENS)) {
          if (t.address.toLowerCase() === a.toLowerCase()) return t.symbol;
        }
        return a;
      }),
      priceImpact: impact + "%",
    };
  }

  /** Get balance of any token for a wallet */
  async getBalance(wallet: string, tokenInput: string): Promise<{ token: TokenInfo; balance: string }> {
    const token = await this.resolveTokenFull(tokenInput);

    let balance: bigint;
    if (token.symbol === "AVAX" || token.symbol === "WAVAX") {
      if (tokenInput.toUpperCase() === "AVAX") {
        balance = await this.provider.getBalance(wallet);
        return { token, balance: ethers.formatEther(balance) };
      }
    }

    const contract = new ethers.Contract(ethers.getAddress(token.address), ERC20_ABI, this.provider);
    balance = await contract.balanceOf(wallet);
    return { token, balance: ethers.formatUnits(balance, token.decimals) };
  }

  /** Build unsigned swap transaction(s) for any pair */
  async buildSwapTx(
    wallet: string,
    fromInput: string,
    toInput: string,
    amount: string,
    slippageBps = DEFAULT_SLIPPAGE_BPS
  ): Promise<{ transactions: UnsignedTx[]; summary: string }> {
    const fromToken = await this.resolveTokenFull(fromInput);
    const toToken = await this.resolveTokenFull(toInput);

    const isFromNative = fromInput.toUpperCase() === "AVAX";
    const isToNative = toInput.toUpperCase() === "AVAX";

    const fromAddr = fromToken.symbol === "AVAX" ? WAVAX : fromToken.address;
    const toAddr = toToken.symbol === "AVAX" ? WAVAX : toToken.address;

    // Parse amount
    let amountIn: bigint;
    if (amount === "max") {
      if (isFromNative) {
        const bal = await this.provider.getBalance(wallet);
        // Reserve 0.05 AVAX for gas
        const reserve = ethers.parseEther("0.05");
        if (bal <= reserve) throw new Error("AVAX balance too low (need to reserve gas)");
        amountIn = bal - reserve;
      } else {
        const contract = new ethers.Contract(ethers.getAddress(fromToken.address), ERC20_ABI, this.provider);
        amountIn = await contract.balanceOf(wallet);
        if (amountIn === 0n) throw new Error(`No ${fromToken.symbol} balance to sell`);
      }
    } else {
      amountIn = ethers.parseUnits(amount, fromToken.decimals);
    }

    // Build route
    let route: string[];
    if (fromAddr.toLowerCase() === WAVAX.toLowerCase() || toAddr.toLowerCase() === WAVAX.toLowerCase()) {
      route = [fromAddr, toAddr];
    } else {
      route = [fromAddr, WAVAX, toAddr];
    }

    // Get quote
    const quote = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const amountsArr: bigint[] = [...quote.amounts];
    const expectedOut = amountsArr[amountsArr.length - 1];
    const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const path = {
      pairBinSteps: [...quote.binSteps].map((b: any) => b.toString()),
      versions: [...quote.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    const txs: UnsignedTx[] = [];
    const iface = new ethers.Interface(LB_ROUTER_EXTRA_ABI);
    const displayAmountIn = amount === "max"
      ? ethers.formatUnits(amountIn, fromToken.decimals)
      : amount;
    const displayAmountOut = ethers.formatUnits(expectedOut, toToken.decimals);

    if (isFromNative) {
      // AVAX → Token: single tx, no approve needed
      const data = iface.encodeFunctionData("swapExactNATIVEForTokens", [
        amountOutMin, path, wallet, deadline,
      ]);
      txs.push({
        to: ethers.getAddress(LB_ROUTER),
        data,
        value: ethers.toBeHex(amountIn),
        chainId: 43114,
        gas: "500000",
        gasLimit: "500000",
        description: `Swap ${displayAmountIn} AVAX for ~${displayAmountOut} ${toToken.symbol}`,
      });
    } else if (isToNative) {
      // Token → AVAX: approve + swap
      const approveIface = new ethers.Interface(ERC20_ABI);
      const approveData = approveIface.encodeFunctionData("approve", [
        ethers.getAddress(LB_ROUTER), amountIn,
      ]);
      txs.push({
        to: ethers.getAddress(fromToken.address),
        data: approveData,
        value: "0x0",
        chainId: 43114,
        gas: "60000",
        gasLimit: "60000",
        description: `Approve ${displayAmountIn} ${fromToken.symbol} for swap`,
      });

      const data = iface.encodeFunctionData("swapExactTokensForNATIVE", [
        amountIn, amountOutMin, path, wallet, deadline,
      ]);
      txs.push({
        to: ethers.getAddress(LB_ROUTER),
        data,
        value: "0x0",
        chainId: 43114,
        gas: "500000",
        gasLimit: "500000",
        description: `Swap ${displayAmountIn} ${fromToken.symbol} for ~${displayAmountOut} AVAX`,
      });
    } else {
      // Token → Token: approve + swap
      const approveIface = new ethers.Interface(ERC20_ABI);
      const approveData = approveIface.encodeFunctionData("approve", [
        ethers.getAddress(LB_ROUTER), amountIn,
      ]);
      txs.push({
        to: ethers.getAddress(fromToken.address),
        data: approveData,
        value: "0x0",
        chainId: 43114,
        gas: "60000",
        gasLimit: "60000",
        description: `Approve ${displayAmountIn} ${fromToken.symbol} for swap`,
      });

      const data = iface.encodeFunctionData("swapExactTokensForTokens", [
        amountIn, amountOutMin, path, wallet, deadline,
      ]);
      txs.push({
        to: ethers.getAddress(LB_ROUTER),
        data,
        value: "0x0",
        chainId: 43114,
        gas: "500000",
        gasLimit: "500000",
        description: `Swap ${displayAmountIn} ${fromToken.symbol} for ~${displayAmountOut} ${toToken.symbol}`,
      });
    }

    return {
      transactions: txs,
      summary: `${displayAmountIn} ${fromToken.symbol} → ~${displayAmountOut} ${toToken.symbol} (slippage: ${slippageBps / 100}%)`,
    };
  }
}

export { POPULAR_TOKENS, resolveToken } from "./tokens";
export type { TokenInfo } from "./tokens";
