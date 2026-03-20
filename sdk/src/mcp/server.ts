import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Logiqical } from "../client.js";
import { SocialModule } from "../modules/social.js";

function ok(data: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

export function createMcpServer(agent: Logiqical): McpServer {
  const server = new McpServer({ name: "logiqical", version: "0.3.0" });
  const w = agent.address;

  // ── Wallet ──

  server.tool("get_address", "Get the agent's wallet address", {}, async () => {
    return ok({ address: w, canSign: agent.canSign });
  });

  server.tool("get_balance", "Get native token balance (AVAX)", {}, async () => {
    try { return ok({ balance: await agent.getBalance(), token: "AVAX" }); }
    catch (e) { return err(e); }
  });

  server.tool("send_avax", "Send AVAX to an address", {
    to: z.string().describe("Recipient address"),
    amount: z.string().describe("Amount of AVAX (e.g. '0.1')"),
  }, async ({ to, amount }) => {
    try { return ok(await agent.send(to, amount)); }
    catch (e) { return err(e); }
  });

  server.tool("sign_message", "Sign a message with the agent's wallet", {
    message: z.string().describe("Message to sign"),
  }, async ({ message }) => {
    try { return ok({ signature: await agent.signMessage(message) }); }
    catch (e) { return err(e); }
  });

  // ── Swap (ARENA <-> AVAX) ──

  server.tool("get_balances", "Get AVAX and ARENA balances", {
    wallet: z.string().optional().describe("Wallet address (defaults to agent wallet)"),
  }, async ({ wallet }) => {
    try { return ok(await agent.swap.getBalances(wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("swap_quote_buy", "Quote: how much ARENA for a given AVAX amount", {
    avax: z.string().describe("AVAX amount (e.g. '0.1')"),
  }, async ({ avax }) => {
    try { return ok(await agent.swap.quote(avax)); }
    catch (e) { return err(e); }
  });

  server.tool("swap_quote_sell", "Quote: how much AVAX for selling ARENA", {
    arena: z.string().describe("ARENA amount"),
  }, async ({ arena }) => {
    try { return ok(await agent.swap.sellQuote(arena)); }
    catch (e) { return err(e); }
  });

  server.tool("swap_buy_arena", "Buy ARENA with AVAX — signs and broadcasts", {
    avax: z.string().describe("AVAX to spend"),
    slippage: z.number().optional().describe("Slippage bps (default 500)"),
  }, async ({ avax, slippage }) => {
    try { return ok(await agent.execute(agent.swap.buildBuy(w, avax, slippage))); }
    catch (e) { return err(e); }
  });

  server.tool("swap_sell_arena", "Sell ARENA for AVAX — signs and broadcasts", {
    amount: z.string().describe("ARENA to sell, or 'max'"),
    slippage: z.number().optional().describe("Slippage bps (default 500)"),
  }, async ({ amount, slippage }) => {
    try { return ok(await agent.execute(agent.swap.buildSell(w, amount, slippage))); }
    catch (e) { return err(e); }
  });

  // ── Staking ──

  server.tool("stake_info", "Get staking position: staked amount + pending rewards", {
    wallet: z.string().optional().describe("Wallet address"),
  }, async ({ wallet }) => {
    try { return ok(await agent.staking.getInfo(wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("stake_arena", "Stake ARENA tokens — signs and broadcasts", {
    amount: z.string().describe("ARENA to stake, or 'max'"),
  }, async ({ amount }) => {
    try { return ok(await agent.execute(agent.staking.buildStake(w, amount))); }
    catch (e) { return err(e); }
  });

  server.tool("unstake_arena", "Unstake ARENA + claim rewards — signs and broadcasts", {
    amount: z.string().describe("ARENA to unstake, or 'max'"),
  }, async ({ amount }) => {
    try { return ok(await agent.execute(agent.staking.buildUnstake(w, amount))); }
    catch (e) { return err(e); }
  });

  server.tool("buy_and_stake", "Buy ARENA with AVAX and stake in one flow — signs and broadcasts", {
    avax: z.string().describe("AVAX to spend"),
  }, async ({ avax }) => {
    try { return ok(await agent.execute(agent.staking.buildBuyAndStake(w, avax))); }
    catch (e) { return err(e); }
  });

  // ── DEX ──

  server.tool("dex_tokens", "List known tokens available for swapping on Avalanche", {}, async () => {
    try { return ok(agent.dex.getTokens()); }
    catch (e) { return err(e); }
  });

  server.tool("dex_token_info", "Look up any ERC-20 token by address", {
    address: z.string().describe("Token contract address"),
  }, async ({ address }) => {
    try { return ok(await agent.dex.getTokenInfo(address)); }
    catch (e) { return err(e); }
  });

  server.tool("dex_balance", "Check balance of any token", {
    token: z.string().describe("Token symbol (USDC, JOE) or address"),
    wallet: z.string().optional().describe("Wallet address"),
  }, async ({ token, wallet }) => {
    try { return ok(await agent.dex.getBalance(wallet || w, token)); }
    catch (e) { return err(e); }
  });

  server.tool("dex_quote", "Get a swap quote between any two tokens", {
    from: z.string().describe("Source token"),
    to: z.string().describe("Destination token"),
    amount: z.string().describe("Amount of source token"),
  }, async ({ from, to, amount }) => {
    try { return ok(await agent.dex.quote(from, to, amount)); }
    catch (e) { return err(e); }
  });

  server.tool("dex_swap", "Swap any tokens — signs and broadcasts", {
    from: z.string().describe("Source token"),
    to: z.string().describe("Destination token"),
    amount: z.string().describe("Amount to swap, or 'max'"),
    slippage: z.number().optional().describe("Slippage bps (default 500)"),
  }, async ({ from, to, amount, slippage }) => {
    try { return ok(await agent.execute(agent.dex.buildSwap(w, from, to, amount, slippage))); }
    catch (e) { return err(e); }
  });

  // ── Launchpad ──

  server.tool("launchpad_overview", "Get platform overview: total tokens, fees, contracts", {}, async () => {
    try { return ok(await agent.launchpad.getOverview()); }
    catch (e) { return err(e); }
  });

  server.tool("launchpad_recent", "Get recently launched tokens", {
    count: z.number().optional().describe("Number of tokens (default 10)"),
  }, async ({ count }) => {
    try { return ok(await agent.launchpad.getRecent(count)); }
    catch (e) { return err(e); }
  });

  server.tool("launchpad_token", "Get full token info by ID", {
    tokenId: z.string().describe("Token ID"),
  }, async ({ tokenId }) => {
    try { return ok(await agent.launchpad.getToken(tokenId)); }
    catch (e) { return err(e); }
  });

  server.tool("launchpad_quote", "Get buy or sell quote for a launchpad token", {
    tokenId: z.string().describe("Token ID"),
    side: z.enum(["buy", "sell"]).describe("Trade side"),
    amount: z.string().describe("AVAX amount (buy) or token amount (sell)"),
  }, async ({ tokenId, side, amount }) => {
    try { return ok(await agent.launchpad.quote(tokenId, side, amount)); }
    catch (e) { return err(e); }
  });

  server.tool("launchpad_buy", "Buy a launchpad token — signs and broadcasts", {
    tokenId: z.string().describe("Token ID"),
    avax: z.string().describe("AVAX to spend"),
    slippage: z.number().optional().describe("Slippage bps"),
  }, async ({ tokenId, avax, slippage }) => {
    try { return ok(await agent.execute(agent.launchpad.buildBuy(w, tokenId, avax, slippage))); }
    catch (e) { return err(e); }
  });

  server.tool("launchpad_sell", "Sell a launchpad token — signs and broadcasts", {
    tokenId: z.string().describe("Token ID"),
    amount: z.string().describe("Token amount, or 'max'"),
    slippage: z.number().optional().describe("Slippage bps"),
  }, async ({ tokenId, amount, slippage }) => {
    try { return ok(await agent.execute(agent.launchpad.buildSell(w, tokenId, amount, slippage))); }
    catch (e) { return err(e); }
  });

  // ── Tickets ──

  server.tool("tickets_buy_price", "Get buy price for Arena tickets", {
    subject: z.string().describe("Subject wallet address"),
    amount: z.string().optional().describe("Tickets (default 1, supports 0.5)"),
  }, async ({ subject, amount }) => {
    try { return ok(await agent.tickets.getBuyPrice(subject, amount)); }
    catch (e) { return err(e); }
  });

  server.tool("tickets_sell_price", "Get sell price for Arena tickets", {
    subject: z.string().describe("Subject wallet address"),
    amount: z.string().optional().describe("Tickets (default 1)"),
  }, async ({ subject, amount }) => {
    try { return ok(await agent.tickets.getSellPrice(subject, amount)); }
    catch (e) { return err(e); }
  });

  server.tool("tickets_balance", "Get ticket balance", {
    subject: z.string().describe("Subject wallet"),
    user: z.string().optional().describe("User wallet"),
  }, async ({ subject, user }) => {
    try { return ok(await agent.tickets.getBalance(subject, user || w)); }
    catch (e) { return err(e); }
  });

  server.tool("tickets_supply", "Get total ticket supply for a subject", {
    subject: z.string().describe("Subject wallet"),
  }, async ({ subject }) => {
    try { return ok(await agent.tickets.getSupply(subject)); }
    catch (e) { return err(e); }
  });

  server.tool("tickets_fees", "Get ticket fee structure", {}, async () => {
    try { return ok(await agent.tickets.getFees()); }
    catch (e) { return err(e); }
  });

  server.tool("tickets_buy", "Buy Arena tickets — signs and broadcasts", {
    subject: z.string().describe("Subject wallet"),
    amount: z.string().optional().describe("Tickets (default 1)"),
  }, async ({ subject, amount }) => {
    try { return ok(await agent.execute(agent.tickets.buildBuyTx(w, subject, amount))); }
    catch (e) { return err(e); }
  });

  server.tool("tickets_sell", "Sell Arena tickets — signs and broadcasts", {
    subject: z.string().describe("Subject wallet"),
    amount: z.string().optional().describe("Tickets (default 1)"),
  }, async ({ subject, amount }) => {
    try { return ok(await agent.execute(agent.tickets.buildSellTx(w, subject, amount))); }
    catch (e) { return err(e); }
  });

  // ── Bridge ──

  server.tool("bridge_info", "Get supported chains, USDC addresses, native token constant", {}, async () => {
    try { return ok(agent.bridge.getInfo()); }
    catch (e) { return err(e); }
  });

  server.tool("bridge_chains", "Get all supported chains for bridging", {}, async () => {
    try { return ok(await agent.bridge.getChains()); }
    catch (e) { return err(e); }
  });

  server.tool("bridge_tokens", "Get tokens available on specified chains", {
    chains: z.string().describe("Comma-separated chain IDs (e.g. '43114,42161')"),
  }, async ({ chains }) => {
    try { return ok(await agent.bridge.getTokens(chains)); }
    catch (e) { return err(e); }
  });

  server.tool("bridge_quote", "Get a cross-chain bridge quote with transaction", {
    fromChainId: z.number().describe("Source chain ID"),
    toChainId: z.number().describe("Destination chain ID"),
    fromToken: z.string().describe("Source token address"),
    toToken: z.string().describe("Destination token address"),
    fromAmount: z.string().describe("Amount (human-readable)"),
    fromAddress: z.string().optional().describe("Sender (defaults to agent)"),
    slippage: z.number().optional().describe("Slippage decimal (default 0.03)"),
  }, async ({ fromChainId, toChainId, fromToken, toToken, fromAmount, fromAddress, slippage }) => {
    try {
      return ok(await agent.bridge.getQuote(
        fromChainId, toChainId, fromToken, toToken, fromAmount, fromAddress || w, undefined, slippage,
      ));
    } catch (e) { return err(e); }
  });

  server.tool("bridge_routes", "Get multiple route options for bridging", {
    fromChainId: z.number().describe("Source chain ID"),
    toChainId: z.number().describe("Destination chain ID"),
    fromToken: z.string().describe("Source token address"),
    toToken: z.string().describe("Destination token address"),
    fromAmount: z.string().describe("Amount (human-readable)"),
    fromAddress: z.string().optional().describe("Sender (defaults to agent)"),
  }, async ({ fromChainId, toChainId, fromToken, toToken, fromAmount, fromAddress }) => {
    try {
      return ok(await agent.bridge.getRoutes(
        fromChainId, toChainId, fromToken, toToken, fromAmount, fromAddress || w,
      ));
    } catch (e) { return err(e); }
  });

  server.tool("bridge_status", "Check status of a cross-chain transfer", {
    txHash: z.string().describe("Source chain tx hash"),
    fromChainId: z.number().describe("Source chain ID"),
    toChainId: z.number().describe("Destination chain ID"),
  }, async ({ txHash, fromChainId, toChainId }) => {
    try { return ok(await agent.bridge.getStatus(txHash, fromChainId, toChainId)); }
    catch (e) { return err(e); }
  });

  // ── Perps ──

  server.tool("perps_register", "Register for perpetual futures on Hyperliquid", {}, async () => {
    try { return ok(await agent.perps.register()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_registration_status", "Check perps registration status", {}, async () => {
    try { return ok(await agent.perps.getRegistrationStatus()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_wallet_address", "Get Hyperliquid wallet address", {}, async () => {
    try { return ok(await agent.perps.getWalletAddress()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_trading_pairs", "Get all 250+ perpetual trading pairs", {}, async () => {
    try { return ok(await agent.perps.getTradingPairs()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_update_leverage", "Set leverage for a market", {
    symbol: z.string().describe("Market symbol (BTC, ETH, SOL)"),
    leverage: z.number().describe("Leverage (1-50)"),
    leverageType: z.enum(["cross", "isolated"]).optional(),
  }, async ({ symbol, leverage, leverageType }) => {
    try { return ok(await agent.perps.updateLeverage(symbol, leverage, leverageType)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_place_order", "Place a perpetual futures order", {
    orders: z.array(z.record(z.any())).describe("Array of order objects"),
  }, async ({ orders }) => {
    try { return ok(await agent.perps.placeOrder(orders)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_cancel_orders", "Cancel open perps orders", {
    cancels: z.array(z.object({
      assetIndex: z.number(), oid: z.number(),
    })).describe("Orders to cancel"),
  }, async ({ cancels }) => {
    try { return ok(await agent.perps.cancelOrders(cancels)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_close_position", "Close a perpetual position", {
    symbol: z.string(), positionSide: z.enum(["long", "short"]),
    size: z.number(), currentPrice: z.number(),
    closePercent: z.number().optional(),
  }, async ({ symbol, positionSide, size, currentPrice, closePercent }) => {
    try { return ok(await agent.perps.closePosition(symbol, positionSide, size, currentPrice, closePercent)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_orders", "Get open perps orders", {}, async () => {
    try { return ok(await agent.perps.getOrders()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_positions", "Get perps positions and margin summary", {
    wallet: z.string().describe("Hyperliquid wallet address"),
  }, async ({ wallet }) => {
    try { return ok(await agent.perps.getPositions(wallet)); }
    catch (e) { return err(e); }
  });

  // ── Signals ──

  server.tool("signals_market", "Get market signal for an asset (price, funding, OI, volume)", {
    coin: z.string().describe("Asset symbol (BTC, ETH, SOL)"),
  }, async ({ coin }) => {
    try { return ok(await agent.signals.getMarketSignal(coin)); }
    catch (e) { return err(e); }
  });

  server.tool("signals_technical", "Get technical analysis (SMA, RSI, trend, support/resistance)", {
    coin: z.string().describe("Asset symbol"),
    interval: z.string().optional().describe("Candle interval (1m, 5m, 15m, 1h, 4h, 1d)"),
  }, async ({ coin, interval }) => {
    try { return ok(await agent.signals.getTechnicalSignal(coin, interval)); }
    catch (e) { return err(e); }
  });

  server.tool("signals_whales", "Get whale positions from orderbook depth", {
    coin: z.string().describe("Asset symbol"),
    minUsd: z.number().optional().describe("Minimum position USD (default 100000)"),
  }, async ({ coin, minUsd }) => {
    try { return ok(await agent.signals.getWhalePositions(coin, minUsd)); }
    catch (e) { return err(e); }
  });

  server.tool("signals_funding", "Get funding rate extremes across all markets", {
    count: z.number().optional().describe("Top N (default 10)"),
  }, async ({ count }) => {
    try { return ok(await agent.signals.getFundingExtremes(count)); }
    catch (e) { return err(e); }
  });

  server.tool("signals_summary", "Full signal summary: market + technicals + whales + verdict", {
    coin: z.string().describe("Asset symbol"),
  }, async ({ coin }) => {
    try { return ok(await agent.signals.summary(coin)); }
    catch (e) { return err(e); }
  });

  server.tool("signals_scan", "Scan all markets for top trading opportunities", {
    count: z.number().optional().describe("Max opportunities (default 5)"),
  }, async ({ count }) => {
    try { return ok(await agent.signals.scan(count)); }
    catch (e) { return err(e); }
  });

  // ── Social ──

  server.tool("social_search_users", "Search Arena users", {
    q: z.string().describe("Search query"),
  }, async ({ q }) => {
    try { return ok(await agent.social.searchUsers(q)); }
    catch (e) { return err(e); }
  });

  server.tool("social_user_by_handle", "Get user by Arena handle", {
    handle: z.string().describe("Arena handle"),
  }, async ({ handle }) => {
    try { return ok(await agent.social.getUserByHandle(handle)); }
    catch (e) { return err(e); }
  });

  server.tool("social_me", "Get your agent's Arena profile", {}, async () => {
    try { return ok(await agent.social.getMe()); }
    catch (e) { return err(e); }
  });

  server.tool("social_top_users", "Get top Arena users", {}, async () => {
    try { return ok(await agent.social.getTopUsers()); }
    catch (e) { return err(e); }
  });

  server.tool("social_follow", "Follow an Arena user", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.follow(userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_unfollow", "Unfollow an Arena user", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.unfollow(userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_update_profile", "Update Arena profile", {
    userName: z.string().optional(), bio: z.string().optional(),
    profilePicture: z.string().optional(),
  }, async (params) => {
    try { return ok(await agent.social.updateProfile(params)); }
    catch (e) { return err(e); }
  });

  server.tool("social_conversations", "List chat conversations", {}, async () => {
    try { return ok(await agent.social.getConversations()); }
    catch (e) { return err(e); }
  });

  server.tool("social_send_message", "Send a chat message", {
    groupId: z.string().describe("Chat group UUID"),
    text: z.string().describe("Message text"),
    replyId: z.string().optional(),
  }, async ({ groupId, text, replyId }) => {
    try { return ok(await agent.social.sendMessage(groupId, text, replyId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_messages", "Read messages from a chat", {
    groupId: z.string().describe("Chat group UUID"),
    after: z.string().optional().describe("Get messages after this timestamp"),
  }, async ({ groupId, after }) => {
    try { return ok(await agent.social.getMessages(groupId, after)); }
    catch (e) { return err(e); }
  });

  server.tool("social_create_thread", "Create a post/thread", {
    content: z.string().describe("Post content"),
    replyToId: z.string().optional(),
  }, async ({ content, replyToId }) => {
    try { return ok(await agent.social.createThread(content, replyToId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_like_thread", "Like a thread", {
    threadId: z.string(),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.likeThread(threadId)); }
    catch (e) { return err(e); }
  });

  // ── Market Data (CoinGecko) ──

  server.tool("market_price", "Get price, 24h change, market cap, volume for coins", {
    ids: z.string().describe("CoinGecko IDs, comma-separated (e.g. 'bitcoin,ethereum,avalanche-2')"),
  }, async ({ ids }) => {
    try { return ok(await agent.market.price(ids.split(",").map(s => s.trim()))); }
    catch (e) { return err(e); }
  });

  server.tool("market_trending", "Get trending coins on CoinGecko", {}, async () => {
    try { return ok(await agent.market.trending()); }
    catch (e) { return err(e); }
  });

  server.tool("market_top", "Get top coins by market cap", {
    count: z.number().optional().describe("Number of coins (default 20)"),
    page: z.number().optional().describe("Page number (default 1)"),
  }, async ({ count, page }) => {
    try { return ok(await agent.market.markets(count, page)); }
    catch (e) { return err(e); }
  });

  server.tool("market_search", "Search for coins by name or symbol", {
    query: z.string().describe("Search query"),
  }, async ({ query }) => {
    try { return ok(await agent.market.search(query)); }
    catch (e) { return err(e); }
  });

  server.tool("market_avax_price", "Get current AVAX price and 24h change", {}, async () => {
    try { return ok(await agent.market.avaxPrice()); }
    catch (e) { return err(e); }
  });

  server.tool("market_arena_price", "Get current ARENA price and 24h change", {}, async () => {
    try { return ok(await agent.market.arenaPrice()); }
    catch (e) { return err(e); }
  });

  // ── DeFi (sAVAX + ERC-4626 Vaults) ──

  server.tool("defi_savax_info", "Get sAVAX staking info: exchange rate, total staked, your balance", {
    wallet: z.string().optional().describe("Wallet to check balance (defaults to agent)"),
  }, async ({ wallet }) => {
    try { return ok(await agent.defi.sAvaxInfo(wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("defi_savax_quote", "Quote: how much sAVAX for staking AVAX", {
    avax: z.string().describe("AVAX amount to stake"),
  }, async ({ avax }) => {
    try { return ok(await agent.defi.sAvaxStakeQuote(avax)); }
    catch (e) { return err(e); }
  });

  server.tool("defi_savax_stake", "Stake AVAX → sAVAX (Benqi liquid staking) — signs and broadcasts", {
    avax: z.string().describe("AVAX to stake"),
  }, async ({ avax }) => {
    try { return ok(await agent.execute(agent.defi.buildSAvaxStake(avax))); }
    catch (e) { return err(e); }
  });

  server.tool("defi_savax_unstake", "Request unstake sAVAX → AVAX (delayed) — signs and broadcasts", {
    amount: z.string().describe("sAVAX amount, or 'max'"),
  }, async ({ amount }) => {
    try { return ok(await agent.execute(agent.defi.buildSAvaxUnstake(w, amount))); }
    catch (e) { return err(e); }
  });

  server.tool("defi_vault_info", "Get info about an ERC-4626 vault", {
    vault: z.string().describe("Vault contract address"),
    wallet: z.string().optional().describe("Wallet to check position"),
  }, async ({ vault, wallet }) => {
    try { return ok(await agent.defi.vaultInfo(vault, wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("defi_vault_quote", "Quote vault deposit — how many shares for given assets", {
    vault: z.string().describe("Vault contract address"),
    amount: z.string().describe("Asset amount to deposit"),
  }, async ({ vault, amount }) => {
    try { return ok(await agent.defi.vaultDepositQuote(vault, amount)); }
    catch (e) { return err(e); }
  });

  server.tool("defi_vault_deposit", "Deposit into an ERC-4626 vault — signs and broadcasts", {
    vault: z.string().describe("Vault contract address"),
    amount: z.string().describe("Asset amount, or 'max'"),
  }, async ({ vault, amount }) => {
    try { return ok(await agent.execute(agent.defi.buildVaultDeposit(w, vault, amount))); }
    catch (e) { return err(e); }
  });

  server.tool("defi_vault_withdraw", "Withdraw from an ERC-4626 vault — signs and broadcasts", {
    vault: z.string().describe("Vault contract address"),
    amount: z.string().describe("Asset amount, or 'max'"),
  }, async ({ vault, amount }) => {
    try { return ok(await agent.execute(agent.defi.buildVaultWithdraw(w, vault, amount))); }
    catch (e) { return err(e); }
  });

  // ── Policy & Budget ──

  server.tool("policy_get", "Get the current spending policy", {}, async () => {
    try { return ok(agent.getPolicy()); }
    catch (e) { return err(e); }
  });

  server.tool("policy_set", "Replace the entire spending policy", {
    maxPerTx: z.string().optional().describe("Max AVAX per transaction"),
    maxPerHour: z.string().optional().describe("Max AVAX per hour"),
    maxPerDay: z.string().optional().describe("Max AVAX per day"),
    allowedContracts: z.array(z.string()).optional().describe("Allowlisted contract addresses"),
    blockedContracts: z.array(z.string()).optional().describe("Blocklisted contract addresses"),
    simulateBeforeSend: z.boolean().optional().describe("Simulate transactions before sending"),
    dryRun: z.boolean().optional().describe("Dry run mode (no broadcasting)"),
  }, async (policy) => {
    try { agent.setPolicy(policy); return ok({ status: "policy_updated", policy: agent.getPolicy() }); }
    catch (e) { return err(e); }
  });

  server.tool("policy_budget", "Get budget status: spent this hour, today, remaining", {}, async () => {
    try { return ok(agent.getBudgetStatus()); }
    catch (e) { return err(e); }
  });

  // ── Agent Registration ──

  server.tool("agent_register", "Register a new AI agent on Arena (returns API key — save immediately)", {
    name: z.string().describe("Agent display name"),
    handle: z.string().describe("Unique agent handle"),
    address: z.string().describe("Agent wallet address"),
    bio: z.string().optional().describe("Agent bio"),
    profilePictureUrl: z.string().optional().describe("Profile picture URL"),
    bannerUrl: z.string().optional().describe("Banner image URL"),
  }, async (opts) => {
    try { return ok(await SocialModule.registerAgent(opts)); }
    catch (e) { return err(e); }
  });

  // ── Feed Auto-Posting ──

  server.tool("social_post_trade", "Auto-post a trade update to Arena feed", {
    action: z.enum(["buy", "sell", "swap", "bridge", "stake", "long", "short", "close"]).describe("Trade action"),
    token: z.string().optional().describe("Token symbol"),
    amount: z.string().optional().describe("Amount traded"),
    price: z.string().optional().describe("Price in USD"),
    fromToken: z.string().optional().describe("Source token (for swaps)"),
    toToken: z.string().optional().describe("Destination token (for swaps)"),
    pnl: z.string().optional().describe("PnL for closed positions"),
    hash: z.string().optional().describe("Transaction hash"),
    extra: z.string().optional().describe("Additional info"),
  }, async (trade) => {
    try { return ok(await agent.social.postTradeUpdate(trade)); }
    catch (e) { return err(e); }
  });

  // ── Copy Trading ──

  server.tool("copy_get_positions", "Get open positions of a Hyperliquid wallet (target for copy trading)", {
    wallet: z.string().describe("Target wallet address to copy"),
  }, async ({ wallet }) => {
    try { return ok(await agent.copyTrading.getTargetPositions(wallet)); }
    catch (e) { return err(e); }
  });

  server.tool("copy_calculate_orders", "Compare target vs agent positions and calculate mirror orders", {
    targetWallet: z.string().describe("Wallet to copy from"),
    agentWallet: z.string().optional().describe("Your agent wallet (defaults to agent address)"),
    scaleFactor: z.number().optional().describe("Position scale (0.1 = 10% of target size, default 0.1)"),
  }, async ({ targetWallet, agentWallet, scaleFactor }) => {
    try { return ok(await agent.copyTrading.calculateMirrorOrders(targetWallet, agentWallet || w, scaleFactor)); }
    catch (e) { return err(e); }
  });

  server.tool("copy_execute", "One-shot copy trade: mirror a wallet's positions (calculate + execute)", {
    targetWallet: z.string().describe("Wallet to copy from"),
    agentWallet: z.string().optional().describe("Your agent wallet (defaults to agent address)"),
    scaleFactor: z.number().optional().describe("Position scale (0.1 = 10% of target size, default 0.1)"),
  }, async ({ targetWallet, agentWallet, scaleFactor }) => {
    try { return ok(await agent.copyTrading.copyOnce(targetWallet, agentWallet || w, scaleFactor)); }
    catch (e) { return err(e); }
  });

  // ── Perps USDC Deposit ──

  server.tool("perps_deposit_info", "Get Hyperliquid deposit info (addresses, chain, USDC)", {}, async () => {
    try { return ok(agent.perps.getDepositInfo()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_arbitrum_usdc_balance", "Check USDC balance on Arbitrum", {
    wallet: z.string().optional().describe("Wallet (defaults to agent)"),
  }, async ({ wallet }) => {
    try { return ok({ balance: await agent.perps.getArbitrumUSDCBalance(wallet || w), token: "USDC", chain: "Arbitrum" }); }
    catch (e) { return err(e); }
  });

  server.tool("perps_deposit_usdc", "Build USDC deposit tx for Hyperliquid (execute on Arbitrum network)", {
    amount: z.string().describe("USDC amount to deposit"),
  }, async ({ amount }) => {
    try { return ok(agent.perps.buildDepositUSDC(amount)); }
    catch (e) { return err(e); }
  });

  // ── Contract Call (advanced) ──

  server.tool("call_contract", "Call any smart contract method — signs and broadcasts", {
    contract: z.string().describe("Contract address"),
    abi: z.array(z.string()).describe("Human-readable ABI array"),
    method: z.string().describe("Method name"),
    args: z.array(z.any()).optional().describe("Method arguments"),
    value: z.string().optional().describe("Native token to send (e.g. '0.1')"),
  }, async ({ contract, abi, method, args, value }) => {
    try { return ok(await agent.call({ contract, abi, method, args, value })); }
    catch (e) { return err(e); }
  });

  return server;
}
