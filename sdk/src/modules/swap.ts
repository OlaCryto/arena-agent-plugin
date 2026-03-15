import type { HttpClient } from "../http.js";
import type {
  BalancesResponse,
  BuyQuoteResponse,
  SellQuoteResponse,
  SwapBuyResponse,
  SwapSellResponse,
} from "../types.js";

export class SwapModule {
  constructor(
    private http: HttpClient,
    private auth: () => Promise<void>,
  ) {}

  /**
   * Get AVAX and ARENA token balances for a wallet.
   * @param wallet - Wallet address to check
   */
  async getBalances(wallet: string): Promise<BalancesResponse> {
    await this.auth();
    return this.http.get("/balances", { wallet });
  }

  /**
   * Quote how much ARENA you get for a given amount of AVAX.
   * @param avax - Amount of AVAX to spend
   */
  async quote(avax: string): Promise<BuyQuoteResponse> {
    await this.auth();
    return this.http.get("/quote", { avax });
  }

  /**
   * Quote how much AVAX you get for selling a given amount of ARENA.
   * @param arena - Amount of ARENA to sell
   */
  async sellQuote(arena: string): Promise<SellQuoteResponse> {
    await this.auth();
    return this.http.get("/quote/sell", { arena });
  }

  /**
   * Build unsigned transaction to buy ARENA with AVAX.
   *
   * Sign the transaction, then broadcast via `client.broadcast()`.
   *
   * @param wallet - Your wallet address
   * @param avax - Amount of AVAX to spend
   * @param slippage - Slippage tolerance in basis points (default: 500 = 5%)
   */
  async buildBuy(wallet: string, avax: string, slippage?: number): Promise<SwapBuyResponse> {
    await this.auth();
    return this.http.get("/build/buy", { wallet, avax, slippage });
  }

  /**
   * Build unsigned transactions to sell ARENA for AVAX.
   *
   * Returns 2 transactions — execute in order:
   * 1. Approve — allows the DEX router to spend your ARENA
   * 2. Swap — executes the ARENA → AVAX swap
   *
   * Sign each, broadcast via `client.broadcast()`, wait for confirmation before the next.
   *
   * @param wallet - Your wallet address
   * @param amount - Amount of ARENA to sell, or "max" for entire balance
   * @param slippage - Slippage tolerance in basis points (default: 500 = 5%)
   */
  async buildSell(wallet: string, amount: string, slippage?: number): Promise<SwapSellResponse> {
    await this.auth();
    return this.http.get("/build/sell-arena", { wallet, amount, slippage });
  }
}
