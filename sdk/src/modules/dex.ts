import { ethers, type JsonRpcProvider } from "ethers";
import {
  WAVAX, LB_ROUTER, LB_QUOTER, ERC20_ABI, LB_ROUTER_ABI, LB_QUOTER_ABI,
  DEFAULT_SLIPPAGE_BPS, CHAIN_ID,
} from "../constants.js";
import type { UnsignedTx } from "../types.js";

/** Well-known tokens on Avalanche */
const KNOWN_TOKENS: Record<string, string> = {
  AVAX: WAVAX,
  WAVAX: WAVAX,
  USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "USDC.e": "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664",
  USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  "USDT.e": "0xc7198437980c041c805A1EDcbA50c1Ce5db95118",
  JOE: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
  ARENA: "0xB8d7710f7d8349A506b75dD184F05777c82dAd0C",
  "BTC.b": "0x152b9d0FdC40C096DE20232Db5A0dF62B48dEeEB",
  "WETH.e": "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  GMX: "0x62edc0692BD897D2295872a9FFCac5425011c661",
  sAVAX: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE",
};

export class DexModule {
  private lbQuoter: ethers.Contract;

  constructor(private provider: JsonRpcProvider) {
    this.lbQuoter = new ethers.Contract(ethers.getAddress(LB_QUOTER), LB_QUOTER_ABI, provider);
  }

  /** Resolve token symbol or address to a checksummed address */
  private resolveToken(tokenOrAddress: string): string {
    const upper = tokenOrAddress.toUpperCase();
    if (KNOWN_TOKENS[upper]) return ethers.getAddress(KNOWN_TOKENS[upper]);
    if (KNOWN_TOKENS[tokenOrAddress]) return ethers.getAddress(KNOWN_TOKENS[tokenOrAddress]);
    if (tokenOrAddress.startsWith("0x")) return ethers.getAddress(tokenOrAddress);
    throw new Error(`Unknown token: ${tokenOrAddress}. Use a symbol (AVAX, USDC, JOE, ARENA) or a 0x contract address.`);
  }

  /** List known tokens */
  getTokens(): { tokens: Array<{ symbol: string; address: string }>; note: string } {
    const tokens = Object.entries(KNOWN_TOKENS).map(([symbol, address]) => ({ symbol, address }));
    return { tokens, note: "You can also pass any ERC-20 contract address directly." };
  }

  /** Look up any ERC-20 token by address */
  async getTokenInfo(address: string): Promise<{ address: string; symbol: string; name: string; decimals: number }> {
    const addr = ethers.getAddress(address);
    const token = new ethers.Contract(addr, ERC20_ABI, this.provider);
    const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
    return { address: addr, symbol, name, decimals: Number(decimals) };
  }

  /** Get balance of any token */
  async getBalance(wallet: string, tokenOrAddress: string): Promise<{ wallet: string; token: string; balance: string; formatted: string; symbol: string }> {
    const address = this.resolveToken(tokenOrAddress);
    if (address.toLowerCase() === WAVAX.toLowerCase() && tokenOrAddress.toUpperCase() === "AVAX") {
      const balance = await this.provider.getBalance(wallet);
      return { wallet, token: "AVAX", balance: balance.toString(), formatted: ethers.formatEther(balance), symbol: "AVAX" };
    }
    const token = new ethers.Contract(address, ERC20_ABI, this.provider);
    const [balance, symbol, decimals] = await Promise.all([token.balanceOf(wallet), token.symbol(), token.decimals()]);
    return { wallet, token: address, balance: balance.toString(), formatted: ethers.formatUnits(balance, decimals), symbol };
  }

  /** Quote a swap between any two tokens */
  async quote(from: string, to: string, amount: string): Promise<{ from: string; to: string; amountIn: string; amountOut: string; rate: string; path: string[] }> {
    const fromAddr = this.resolveToken(from);
    const toAddr = this.resolveToken(to);
    const fromToken = new ethers.Contract(fromAddr, ERC20_ABI, this.provider);
    const decimals = fromAddr.toLowerCase() === WAVAX.toLowerCase() ? 18 : Number(await fromToken.decimals());
    const amountIn = ethers.parseUnits(amount, decimals);

    const route = [fromAddr, toAddr];
    const quoteResult = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const amountOut: bigint = quoteResult.amounts[quoteResult.amounts.length - 1];

    const toToken = new ethers.Contract(toAddr, ERC20_ABI, this.provider);
    const toDecimals = toAddr.toLowerCase() === WAVAX.toLowerCase() ? 18 : Number(await toToken.decimals());
    const outFormatted = ethers.formatUnits(amountOut, toDecimals);

    return {
      from, to, amountIn: amount, amountOut: outFormatted,
      rate: (parseFloat(outFormatted) / parseFloat(amount)).toFixed(6),
      path: route,
    };
  }

  /** Build swap transactions (1 tx for AVAX→token, 2 txs for token→token with approve) */
  async buildSwap(wallet: string, from: string, to: string, amount: string, slippageBps = DEFAULT_SLIPPAGE_BPS): Promise<{ transactions: UnsignedTx[]; summary: string }> {
    const fromAddr = this.resolveToken(from);
    const toAddr = this.resolveToken(to);
    const isFromNative = from.toUpperCase() === "AVAX";
    const isToNative = to.toUpperCase() === "AVAX";

    const fromToken = new ethers.Contract(fromAddr, ERC20_ABI, this.provider);
    const fromDecimals = isFromNative ? 18 : Number(await fromToken.decimals());

    let amountIn: bigint;
    if (amount === "max" && !isFromNative) {
      amountIn = await fromToken.balanceOf(wallet);
      if (amountIn === 0n) throw new Error("No balance to swap");
    } else {
      amountIn = ethers.parseUnits(amount, fromDecimals);
    }

    const route = [fromAddr, toAddr];
    const quoteResult = await this.lbQuoter.findBestPathFromAmountIn(route, amountIn);
    const expectedOut: bigint = quoteResult.amounts[quoteResult.amounts.length - 1];
    if (expectedOut === 0n) throw new Error("Quote returned zero — no liquidity for this pair");

    const clampedSlippage = BigInt(Math.max(0, Math.min(10000, Number(slippageBps))));
    const amountOutMin = expectedOut - (expectedOut * clampedSlippage) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const path = {
      pairBinSteps: [...quoteResult.binSteps].map((b: any) => b.toString()),
      versions: [...quoteResult.versions].map((v: any) => Number(v)),
      tokenPath: [...route],
    };

    const txs: UnsignedTx[] = [];
    const routerIface = new ethers.Interface(LB_ROUTER_ABI);

    if (isFromNative) {
      const data = routerIface.encodeFunctionData("swapExactNATIVEForTokens", [amountOutMin, path, wallet, deadline]);
      txs.push({ to: ethers.getAddress(LB_ROUTER), data, value: ethers.toBeHex(amountIn, 32), chainId: CHAIN_ID, gasLimit: "500000", description: `Swap ${amount} AVAX → ${to}` });
    } else if (isToNative) {
      const erc20Iface = new ethers.Interface(ERC20_ABI);
      txs.push({
        to: fromAddr, data: erc20Iface.encodeFunctionData("approve", [ethers.getAddress(LB_ROUTER), amountIn]),
        value: "0", chainId: CHAIN_ID, gasLimit: "60000", description: `Approve ${from} for swap`,
      });
      const data = routerIface.encodeFunctionData("swapExactTokensForNATIVE", [amountIn, amountOutMin, path, wallet, deadline]);
      txs.push({ to: ethers.getAddress(LB_ROUTER), data, value: "0", chainId: CHAIN_ID, gasLimit: "500000", description: `Swap ${from} → AVAX` });
    } else {
      // token→token: not directly supported by LB Router in a single hop, but we can try
      const erc20Iface = new ethers.Interface(ERC20_ABI);
      txs.push({
        to: fromAddr, data: erc20Iface.encodeFunctionData("approve", [ethers.getAddress(LB_ROUTER), amountIn]),
        value: "0", chainId: CHAIN_ID, gasLimit: "60000", description: `Approve ${from} for swap`,
      });
      // For token→token, route through WAVAX
      throw new Error("Direct token→token swaps not yet supported. Route through AVAX: swap TOKEN→AVAX, then AVAX→TOKEN.");
    }

    const toToken = new ethers.Contract(toAddr, ERC20_ABI, this.provider);
    const toDecimals = isToNative ? 18 : Number(await toToken.decimals());

    return { transactions: txs, summary: `Swap ${amount} ${from} → ~${ethers.formatUnits(expectedOut, toDecimals)} ${to}` };
  }
}
