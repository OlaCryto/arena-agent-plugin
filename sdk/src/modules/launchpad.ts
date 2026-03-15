import type { HttpClient } from "../http.js";
import type {
  LaunchpadListResponse,
  LaunchpadToken,
  TokenDetailResponse,
  LaunchpadQuoteResponse,
  TokenActivityResponse,
  TokenHoldersResponse,
  GlobalTradesResponse,
  LaunchpadBuyResponse,
  LaunchpadSellResponse,
} from "../types.js";

export class LaunchpadModule {
  constructor(
    private http: HttpClient,
    private auth: () => Promise<void>,
  ) {}

  // ── Discovery ──

  /**
   * Get recently launched tokens on Arena.
   * @param count - Number of tokens (max 50, default 10)
   * @param type - Filter: "all", "avax" (AVAX-paired), or "arena" (ARENA-paired)
   */
  async getRecent(count?: number, type?: "all" | "avax" | "arena"): Promise<LaunchpadListResponse> {
    await this.auth();
    return this.http.get("/launchpad/recent", { count, type });
  }

  /**
   * Search for a token by name, symbol, or contract address.
   * @param q - Search query — name, symbol, or 0x contract address
   */
  async search(q: string): Promise<LaunchpadListResponse | LaunchpadToken> {
    await this.auth();
    return this.http.get("/launchpad/search", { q });
  }

  /**
   * Get tokens that are closest to graduating from the bonding curve to DEX.
   * @param count - Number of tokens (max 20, default 5)
   */
  async getGraduating(count?: number): Promise<LaunchpadListResponse> {
    await this.auth();
    return this.http.get("/launchpad/graduating", { count });
  }

  /**
   * Get tokens that have already graduated from the bonding curve to DEX.
   * @param count - Number of tokens (max 50, default 10)
   */
  async getGraduated(count?: number): Promise<LaunchpadListResponse> {
    await this.auth();
    return this.http.get("/launchpad/graduated", { count });
  }

  /**
   * Get top tokens by trading volume.
   * @param timeframe - "5m", "1h", "4h", "24h", or "all_time"
   * @param count - Number of tokens (max 50, default 10)
   */
  async getTopVolume(timeframe?: "5m" | "1h" | "4h" | "24h" | "all_time", count?: number): Promise<LaunchpadListResponse & { timeframe: string }> {
    await this.auth();
    return this.http.get("/launchpad/top-volume", { timeframe, count });
  }

  // ── Intelligence ──

  /**
   * Get full token profile with stats — price, market cap, graduation progress, buy/sell activity.
   * @param tokenId - Arena token ID
   * @param address - Or token contract address (0x...)
   */
  async getToken(tokenId?: string, address?: string): Promise<TokenDetailResponse> {
    await this.auth();
    return this.http.get("/launchpad/token", { tokenId, address });
  }

  /**
   * Get a buy or sell quote for a bonding curve token.
   * @param tokenId - Arena token ID
   * @param side - "buy" or "sell"
   * @param amount - For buy: AVAX amount. For sell: token amount.
   */
  async quote(tokenId: string, side: "buy" | "sell", amount: string): Promise<LaunchpadQuoteResponse> {
    await this.auth();
    const params: Record<string, string> = { tokenId, side };
    if (side === "buy") params.avax = amount;
    else params.tokenAmount = amount;
    return this.http.get("/launchpad/quote", params);
  }

  /**
   * Get agent's tracked portfolio — all launchpad tokens the agent has bought.
   * @param wallet - Agent wallet address
   */
  async getPortfolio(wallet: string): Promise<unknown> {
    await this.auth();
    return this.http.get("/launchpad/portfolio", { wallet });
  }

  /**
   * Get market cap data for a token.
   * @param tokenId - Arena token ID
   */
  async getMarketCap(tokenId: string): Promise<unknown> {
    await this.auth();
    return this.http.get("/launchpad/market-cap", { tokenId });
  }

  /**
   * Get recent trade activity for a token.
   * @param tokenId - Arena token ID
   * @param address - Or token contract address
   * @param count - Number of trades (max 50, default 20)
   */
  async getActivity(tokenId?: string, address?: string, count?: number): Promise<TokenActivityResponse> {
    await this.auth();
    return this.http.get("/launchpad/activity", { tokenId, address, count });
  }

  /**
   * Get top holders for a token with PnL data.
   * @param address - Token contract address
   * @param tokenId - Or Arena token ID
   * @param count - Number of holders (max 50, default 20)
   */
  async getHolders(address?: string, tokenId?: string, count?: number): Promise<TokenHoldersResponse> {
    await this.auth();
    return this.http.get("/launchpad/holders", { address, tokenId, count });
  }

  /**
   * Get platform overview — total tokens launched, contract addresses, stats.
   */
  async getOverview(): Promise<unknown> {
    await this.auth();
    return this.http.get("/launchpad/overview");
  }

  /**
   * Get the global trade feed across all launchpad tokens.
   * @param count - Number of trades (max 100, default 50)
   * @param offset - Pagination offset
   */
  async getTrades(count?: number, offset?: number): Promise<GlobalTradesResponse> {
    await this.auth();
    return this.http.get("/launchpad/trades", { count, offset });
  }

  // ── Trading ──

  /**
   * Build unsigned transaction to buy a launchpad token with AVAX.
   *
   * Auto-detects if the token is AVAX-paired or ARENA-paired and routes accordingly.
   * If the token has graduated to DEX, returns transactions for DEX swap instead.
   *
   * @param wallet - Your wallet address
   * @param tokenId - Arena token ID
   * @param avax - Amount of AVAX to spend
   * @param slippage - Slippage in basis points (default: 500 = 5%)
   */
  async buildBuy(wallet: string, tokenId: string, avax: string, slippage?: number): Promise<LaunchpadBuyResponse> {
    await this.auth();
    return this.http.get("/launchpad/build/buy", { wallet, tokenId, avax, slippage });
  }

  /**
   * Build unsigned transaction(s) to sell a launchpad token.
   *
   * Returns approve + sell transactions. Execute in order.
   * Use amount="max" to sell entire balance.
   *
   * If the token has graduated to DEX, returns transactions for DEX swap instead.
   *
   * @param wallet - Your wallet address
   * @param tokenId - Arena token ID
   * @param amount - Token amount to sell, or "max" for entire balance
   * @param slippage - Slippage in basis points (default: 500 = 5%)
   */
  async buildSell(wallet: string, tokenId: string, amount: string, slippage?: number): Promise<LaunchpadSellResponse> {
    await this.auth();
    return this.http.get("/launchpad/build/sell", { wallet, tokenId, amount, slippage });
  }
}
