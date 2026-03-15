import type { HttpClient } from "../http.js";
import type {
  DexTokensResponse,
  DexTokenInfoResponse,
  DexQuoteResponse,
  DexBalanceResponse,
  DexSwapResponse,
} from "../types.js";

export class DexModule {
  constructor(
    private http: HttpClient,
    private auth: () => Promise<void>,
  ) {}

  /**
   * List all known tokens with addresses and decimals.
   * You can also pass any contract address directly to other methods — not limited to this list.
   */
  async getTokens(): Promise<DexTokensResponse> {
    await this.auth();
    return this.http.get("/dex/tokens");
  }

  /**
   * Get on-chain info for any token by contract address — name, symbol, decimals.
   * @param address - Token contract address (0x...)
   */
  async getTokenInfo(address: string): Promise<DexTokenInfoResponse> {
    await this.auth();
    return this.http.get("/dex/token-info", { address });
  }

  /**
   * Quote a swap between any two tokens on Avalanche.
   * @param from - Source token symbol or contract address
   * @param to - Destination token symbol or contract address
   * @param amount - Amount of source token to swap
   */
  async quote(from: string, to: string, amount: string): Promise<DexQuoteResponse> {
    await this.auth();
    return this.http.get("/dex/quote", { from, to, amount });
  }

  /**
   * Get the balance of any token for a wallet.
   * @param wallet - Wallet address
   * @param token - Token symbol or contract address
   */
  async getBalance(wallet: string, token: string): Promise<DexBalanceResponse> {
    await this.auth();
    return this.http.get("/dex/balance", { wallet, token });
  }

  /**
   * Build unsigned transaction(s) to swap any token pair on Avalanche via LFJ/Pharaoh DEX.
   *
   * May return multiple transactions (approve + swap). Execute in order.
   *
   * @param wallet - Your wallet address
   * @param from - Source token symbol or contract address
   * @param to - Destination token symbol or contract address
   * @param amount - Amount to swap, or "max" for entire balance
   * @param slippage - Slippage tolerance in basis points (default: 500 = 5%)
   */
  async buildSwap(wallet: string, from: string, to: string, amount: string, slippage?: number): Promise<DexSwapResponse> {
    await this.auth();
    return this.http.get("/dex/build/swap", { wallet, from, to, amount, slippage });
  }
}
