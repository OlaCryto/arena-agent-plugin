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
  const server = new McpServer({ name: "logiqical", version: "0.7.0" });
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

  server.tool("sign_typed_data", "Sign EIP-712 typed data (used for perps auth)", {
    domain: z.record(z.any()).describe("EIP-712 domain"),
    types: z.record(z.any()).describe("EIP-712 types"),
    value: z.record(z.any()).describe("EIP-712 value"),
  }, async ({ domain, types, value }) => {
    try { return ok({ signature: await agent.signTypedData(domain, types, value) }); }
    catch (e) { return err(e); }
  });

  server.tool("simulate_tx", "Simulate a transaction (dry-run via eth_call)", {
    to: z.string().describe("Contract address"),
    data: z.string().describe("Encoded calldata"),
    value: z.string().optional().describe("Value in wei"),
  }, async ({ to, data, value }) => {
    try { await agent.simulate({ to, data, value: value || "0", chainId: 43114 }); return ok({ status: "simulation_passed" }); }
    catch (e) { return err(e); }
  });

  server.tool("switch_network", "Switch network (avalanche or fuji)", {
    network: z.string().describe("Network name: 'avalanche' or 'fuji'"),
  }, async ({ network }) => {
    try { const newAgent = agent.switchNetwork(network); return ok({ status: "switched", network, address: newAgent.address }); }
    catch (e) { return err(e); }
  });

  server.tool("update_policy", "Update specific policy fields (partial update)", {
    maxPerTx: z.string().optional().describe("Max AVAX per transaction"),
    maxPerHour: z.string().optional().describe("Max AVAX per hour"),
    maxPerDay: z.string().optional().describe("Max AVAX per day"),
    simulateBeforeSend: z.boolean().optional().describe("Simulate before sending"),
    dryRun: z.boolean().optional().describe("Dry run mode"),
  }, async (updates) => {
    try { agent.updatePolicy(updates); return ok({ status: "policy_updated", policy: agent.getPolicy() }); }
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

  server.tool("bridge_token", "Get specific token info on a chain", {
    chainId: z.number().describe("Chain ID (e.g. 43114)"),
    address: z.string().describe("Token contract address"),
  }, async ({ chainId, address }) => {
    try { return ok(await agent.bridge.getToken(chainId, address)); }
    catch (e) { return err(e); }
  });

  server.tool("bridge_connections", "Get available bridge connections between chains", {
    fromChainId: z.number().describe("Source chain ID"),
    toChainId: z.number().describe("Destination chain ID"),
    fromToken: z.string().optional().describe("Source token address"),
    toToken: z.string().optional().describe("Destination token address"),
  }, async ({ fromChainId, toChainId, fromToken, toToken }) => {
    try { return ok(await agent.bridge.getConnections(fromChainId, toChainId, fromToken, toToken)); }
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
    wallet: z.string().optional().describe("Hyperliquid wallet address (defaults to agent)"),
  }, async ({ wallet }) => {
    try { return ok(await agent.perps.getPositions(wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_auth_status", "Check Hyperliquid auth/onboarding status", {}, async () => {
    try { return ok(await agent.perps.getAuthStatus()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_auth_payload", "Get auth signing payload for a step", {
    step: z.string().describe("Auth step name"),
    mainWalletAddress: z.string().optional().describe("Main wallet address"),
  }, async ({ step, mainWalletAddress }) => {
    try { return ok(await agent.perps.getAuthPayload(step, mainWalletAddress)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_auth_submit", "Submit auth signature for a step", {
    step: z.string().describe("Auth step name"),
    signature: z.string().describe("Signed payload"),
    mainWalletAddress: z.string().optional().describe("Main wallet address"),
    metadata: z.record(z.any()).optional().describe("Additional metadata"),
  }, async ({ step, signature, mainWalletAddress, metadata }) => {
    try { return ok(await agent.perps.submitAuthSignature(step, signature, mainWalletAddress, metadata)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_enable_hip3", "Enable HIP-3 for Hyperliquid", {}, async () => {
    try { return ok(await agent.perps.enableHip3()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_trade_history", "Get perps trade executions history", {}, async () => {
    try { return ok(await agent.perps.getTradeExecutions()); }
    catch (e) { return err(e); }
  });

  server.tool("perps_open_orders", "Get open orders for a wallet on Hyperliquid", {
    wallet: z.string().optional().describe("Wallet address (defaults to agent)"),
  }, async ({ wallet }) => {
    try { return ok(await agent.perps.getOpenOrders(wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("perps_arbitrum_eth_balance", "Check ETH balance on Arbitrum (for gas)", {
    wallet: z.string().optional().describe("Wallet (defaults to agent)"),
  }, async ({ wallet }) => {
    try { return ok({ balance: await agent.perps.getArbitrumETHBalance(wallet || w), token: "ETH", chain: "Arbitrum" }); }
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

  server.tool("signals_asset_contexts", "Get all Hyperliquid asset metadata and market contexts", {}, async () => {
    try { return ok(await agent.signals.getAssetContexts()); }
    catch (e) { return err(e); }
  });

  server.tool("signals_candles", "Get raw candle/OHLCV data for charting", {
    coin: z.string().describe("Asset symbol (BTC, ETH, SOL)"),
    interval: z.string().optional().describe("Candle interval: 1m, 5m, 15m, 1h, 4h, 1d (default 1h)"),
    count: z.number().optional().describe("Number of candles (default 100)"),
  }, async ({ coin, interval, count }) => {
    try { return ok(await agent.signals.getCandles(coin, interval, count)); }
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

  server.tool("social_messages", "Read newer messages from a chat (latest, or after a timestamp)", {
    groupId: z.string().describe("Chat group UUID"),
    after: z.string().optional().describe("Timestamp (ms) — get messages after this time. Omit for latest."),
  }, async ({ groupId, after }) => {
    try { return ok(await agent.social.getMessages(groupId, after)); }
    catch (e) { return err(e); }
  });

  server.tool("social_older_messages", "Read older message history from a chat (scroll back in time)", {
    groupId: z.string().describe("Chat group UUID"),
    before: z.string().optional().describe("Timestamp (ms) — get messages before this time. Omit for oldest available."),
  }, async ({ groupId, before }) => {
    try { return ok(await agent.social.getOlderMessages(groupId, before)); }
    catch (e) { return err(e); }
  });

  server.tool("social_create_thread", "Create a post/thread", {
    content: z.string().describe("Post content (HTML formatting)"),
  }, async ({ content }) => {
    try { return ok(await agent.social.createThread(content)); }
    catch (e) { return err(e); }
  });

  server.tool("social_like_thread", "Like a thread", {
    threadId: z.string(),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.likeThread(threadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_repost", "Repost/retweet a thread", {
    threadId: z.string().describe("Thread ID to repost"),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.repost(threadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_update_banner", "Update Arena profile banner image", {
    bannerUrl: z.string().describe("Banner image URL"),
  }, async ({ bannerUrl }) => {
    try { return ok(await agent.social.updateBanner(bannerUrl)); }
    catch (e) { return err(e); }
  });

  server.tool("social_user_by_id", "Get Arena user by UUID", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.getUserById(userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_followers", "Get a user's followers", {
    userId: z.string().describe("User UUID"),
    page: z.number().optional().describe("Page number (default 1)"),
    pageSize: z.number().optional().describe("Results per page (default 20)"),
  }, async ({ userId, page, pageSize }) => {
    try { return ok(await agent.social.getFollowers(userId, page, pageSize)); }
    catch (e) { return err(e); }
  });

  server.tool("social_following", "Get who a user follows", {
    userId: z.string().describe("User UUID"),
    page: z.number().optional().describe("Page number (default 1)"),
    pageSize: z.number().optional().describe("Results per page (default 20)"),
  }, async ({ userId, page, pageSize }) => {
    try { return ok(await agent.social.getFollowing(userId, page, pageSize)); }
    catch (e) { return err(e); }
  });

  server.tool("social_shares_stats", "Get shares/ticket stats for a user", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.getSharesStats(userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_shareholders", "Get share holders for a user", {
    userId: z.string().optional().describe("User UUID"),
    page: z.number().optional().describe("Page number (default 1)"),
    pageSize: z.number().optional().describe("Results per page (default 20)"),
  }, async ({ userId, page, pageSize }) => {
    try { return ok(await agent.social.getShareHolders(userId, page, pageSize)); }
    catch (e) { return err(e); }
  });

  server.tool("social_holdings", "Get agent's share holdings", {
    page: z.number().optional().describe("Page number (default 1)"),
    pageSize: z.number().optional().describe("Results per page (default 20)"),
  }, async ({ page, pageSize }) => {
    try { return ok(await agent.social.getHoldings(page, pageSize)); }
    catch (e) { return err(e); }
  });

  server.tool("social_direct_messages", "List DM conversations", {}, async () => {
    try { return ok(await agent.social.getDirectMessages()); }
    catch (e) { return err(e); }
  });

  server.tool("social_group_chats", "List group chat conversations", {}, async () => {
    try { return ok(await agent.social.getGroupChats()); }
    catch (e) { return err(e); }
  });

  server.tool("social_group_info", "Get group chat details", {
    groupId: z.string().describe("Chat group UUID"),
  }, async ({ groupId }) => {
    try { return ok(await agent.social.getGroup(groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_group_members", "Get members of a group chat", {
    groupId: z.string().describe("Chat group UUID"),
  }, async ({ groupId }) => {
    try { return ok(await agent.social.getMembers(groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_get_or_create_dm", "Start a DM conversation with a user", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.getOrCreateDM(userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_accept_chat", "Accept a chat invitation", {
    groupId: z.string().describe("Chat group UUID"),
  }, async ({ groupId }) => {
    try { return ok(await agent.social.acceptChat(groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_search_messages", "Search chat messages", {
    q: z.string().describe("Search query"),
    groupId: z.string().optional().describe("Limit to specific group"),
  }, async ({ q, groupId }) => {
    try { return ok(await agent.social.searchMessages(q, groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_react", "React to a chat message", {
    messageId: z.string().describe("Message UUID"),
    groupId: z.string().describe("Chat group UUID"),
    reaction: z.string().describe("Reaction emoji"),
  }, async ({ messageId, groupId, reaction }) => {
    try { return ok(await agent.social.react(messageId, groupId, reaction)); }
    catch (e) { return err(e); }
  });

  // ── Social: Additional Chat ──

  server.tool("social_unreact", "Remove a reaction from a chat message", {
    messageId: z.string().describe("Message UUID"),
    groupId: z.string().describe("Chat group UUID"),
  }, async ({ messageId, groupId }) => {
    try { return ok(await agent.social.unreact(messageId, groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_leave_chat", "Leave a chat conversation", {
    groupId: z.string().describe("Chat group UUID"),
  }, async ({ groupId }) => {
    try { return ok(await agent.social.leaveChat(groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_search_rooms", "Search chat rooms by name", {
    q: z.string().describe("Search query"),
  }, async ({ q }) => {
    try { return ok(await agent.social.searchRooms(q)); }
    catch (e) { return err(e); }
  });

  server.tool("social_search_dms", "Search direct message conversations", {
    q: z.string().describe("Search query"),
  }, async ({ q }) => {
    try { return ok(await agent.social.searchDMs(q)); }
    catch (e) { return err(e); }
  });

  server.tool("social_search_project_chats", "Search project/group chats", {
    q: z.string().describe("Search query"),
  }, async ({ q }) => {
    try { return ok(await agent.social.searchProjectChats(q)); }
    catch (e) { return err(e); }
  });

  server.tool("social_pin_group", "Pin or unpin a conversation", {
    groupId: z.string().describe("Chat group UUID"),
    isPinned: z.boolean().optional().describe("Pin (true) or unpin (false)"),
  }, async ({ groupId, isPinned }) => {
    try { return ok(await agent.social.pinGroup(groupId, isPinned ?? true)); }
    catch (e) { return err(e); }
  });

  server.tool("social_chat_settings", "Get chat privacy settings", {}, async () => {
    try { return ok(await agent.social.getChatSettings()); }
    catch (e) { return err(e); }
  });

  server.tool("social_update_chat_settings", "Update chat privacy settings", {
    holders: z.boolean().describe("Allow key holders to DM"),
    followers: z.boolean().describe("Allow followers to DM"),
  }, async ({ holders, followers }) => {
    try { return ok(await agent.social.updateChatSettings(holders, followers)); }
    catch (e) { return err(e); }
  });

  server.tool("social_messages_around", "Get messages surrounding a specific message", {
    groupId: z.string().describe("Chat group UUID"),
    messageId: z.string().describe("Target message UUID"),
  }, async ({ groupId, messageId }) => {
    try { return ok(await agent.social.getMessagesAround(groupId, messageId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_unread_messages", "Get messages around first unread message in a group", {
    groupId: z.string().describe("Chat group UUID"),
  }, async ({ groupId }) => {
    try { return ok(await agent.social.getUnreadMessages(groupId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_mention_status", "Get mention counts grouped by chats", {
    groupIds: z.string().optional().describe("Comma-separated group IDs to filter"),
  }, async ({ groupIds }) => {
    try { return ok(await agent.social.getMentionStatus(groupIds)); }
    catch (e) { return err(e); }
  });

  server.tool("social_mute_group", "Mute or unmute notifications for a group", {
    groupId: z.string().describe("Chat group UUID"),
    muted: z.boolean().optional().describe("Mute (true) or unmute (false)"),
  }, async ({ groupId, muted }) => {
    try { return ok(await agent.social.muteGroup(groupId, muted ?? true)); }
    catch (e) { return err(e); }
  });

  server.tool("social_chat_requests", "Search for users to start a DM with", {
    q: z.string().optional().describe("Search query"),
  }, async ({ q }) => {
    try { return ok(await agent.social.getChatRequests(q)); }
    catch (e) { return err(e); }
  });

  // ── Social: Threads & Feed ──

  server.tool("social_user_profile", "Get detailed user profile by handle (may return more data than user_by_handle)", {
    handle: z.string().describe("User handle (without @)"),
  }, async ({ handle }) => {
    try { return ok(await agent.social.getUserProfile(handle)); }
    catch (e) { return err(e); }
  });

  server.tool("social_get_thread", "Get a specific thread by ID", {
    threadId: z.string().describe("Thread UUID"),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.getThread(threadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_answer_thread", "Reply to a thread (uses Arena's answer endpoint)", {
    content: z.string().describe("Reply content (HTML)"),
    threadId: z.string().describe("Thread UUID to reply to"),
    userId: z.string().describe("User ID of thread author"),
  }, async ({ content, threadId, userId }) => {
    try { return ok(await agent.social.answerThread(content, threadId, userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_thread_answers", "Get replies to a thread", {
    threadId: z.string().describe("Thread UUID"),
    page: z.number().optional().describe("Page number"),
  }, async ({ threadId, page }) => {
    try { return ok(await agent.social.getThreadAnswers(threadId, page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_nested_answers", "Get nested replies to a thread", {
    threadId: z.string().describe("Thread UUID"),
    page: z.number().optional().describe("Page number"),
  }, async ({ threadId, page }) => {
    try { return ok(await agent.social.getNestedAnswers(threadId, page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_unlike_thread", "Unlike a previously liked thread", {
    threadId: z.string().describe("Thread UUID"),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.unlikeThread(threadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_delete_thread", "Delete a thread", {
    threadId: z.string().describe("Thread UUID"),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.deleteThread(threadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_delete_repost", "Delete a repost", {
    threadId: z.string().describe("Original thread UUID"),
  }, async ({ threadId }) => {
    try { return ok(await agent.social.deleteRepost(threadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_quote_thread", "Quote a thread with your own commentary", {
    content: z.string().describe("Your comment (HTML)"),
    quotedThreadId: z.string().describe("Thread UUID to quote"),
  }, async ({ content, quotedThreadId }) => {
    try { return ok(await agent.social.quoteThread(content, quotedThreadId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_my_feed", "Get your personalized feed", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getMyFeed(page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_trending_posts", "Get trending posts on Arena", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getTrendingPosts(page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_user_threads", "Get all threads by a specific user", {
    userId: z.string().describe("User UUID"),
    page: z.number().optional().describe("Page number"),
  }, async ({ userId, page }) => {
    try { return ok(await agent.social.getUserThreads(userId, page)); }
    catch (e) { return err(e); }
  });

  // ── Notifications ──

  server.tool("social_notifications", "Get all notifications (likes, replies, follows, mentions)", {
    page: z.number().optional().describe("Page number"),
    type: z.string().optional().describe("Filter: like, repost, reply, follow, mention, quote"),
  }, async ({ page, type }) => {
    try { return ok(await agent.social.getNotifications(page, 20, type)); }
    catch (e) { return err(e); }
  });

  server.tool("social_unseen_notifications", "Get unread notifications", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getUnseenNotifications(page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_mark_notification_seen", "Mark a notification as seen", {
    notificationId: z.string().describe("Notification UUID"),
  }, async ({ notificationId }) => {
    try { return ok(await agent.social.markNotificationSeen(notificationId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_mark_all_seen", "Mark all notifications as seen", {}, async () => {
    try { return ok(await agent.social.markAllNotificationsSeen()); }
    catch (e) { return err(e); }
  });

  // ── Communities ──

  server.tool("social_top_communities", "Get top communities on Arena", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getTopCommunities(page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_new_communities", "Get newly created communities", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getNewCommunities(page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_search_communities", "Search communities by name", {
    q: z.string().describe("Search query"),
  }, async ({ q }) => {
    try { return ok(await agent.social.searchCommunities(q)); }
    catch (e) { return err(e); }
  });

  server.tool("social_community_feed", "Get threads from a community", {
    communityId: z.string().describe("Community UUID"),
    page: z.number().optional().describe("Page number"),
  }, async ({ communityId, page }) => {
    try { return ok(await agent.social.getCommunityFeed(communityId, page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_follow_community", "Join/follow a community", {
    communityId: z.string().describe("Community UUID"),
  }, async ({ communityId }) => {
    try { return ok(await agent.social.followCommunity(communityId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_unfollow_community", "Leave/unfollow a community", {
    communityId: z.string().describe("Community UUID"),
  }, async ({ communityId }) => {
    try { return ok(await agent.social.unfollowCommunity(communityId)); }
    catch (e) { return err(e); }
  });

  // ── Shares (additional) ──

  server.tool("social_earnings_breakdown", "Get earnings breakdown from shares", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.getEarningsBreakdown(userId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_holder_addresses", "Get on-chain addresses of share holders", {
    userId: z.string().describe("User UUID"),
  }, async ({ userId }) => {
    try { return ok(await agent.social.getHolderAddresses(userId)); }
    catch (e) { return err(e); }
  });

  // ── Stages ──

  server.tool("social_create_stage", "Create an audio stage room", {
    name: z.string().describe("Stage name"),
    privacyType: z.number().optional().describe("0=public, 1=followers, 2=shareholders"),
    scheduledStartTime: z.string().optional().describe("ISO datetime to schedule"),
  }, async ({ name, privacyType, scheduledStartTime }) => {
    try { return ok(await agent.social.createStage(name, { privacyType, scheduledStartTime })); }
    catch (e) { return err(e); }
  });

  server.tool("social_start_stage", "Start a scheduled stage", {
    stageId: z.string().describe("Stage UUID"),
  }, async ({ stageId }) => {
    try { return ok(await agent.social.startStage(stageId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_end_stage", "End a live stage", {
    stageId: z.string().describe("Stage UUID"),
  }, async ({ stageId }) => {
    try { return ok(await agent.social.endStage(stageId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_active_stages", "Get active stages on Arena", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getActiveStages(page)); }
    catch (e) { return err(e); }
  });

  server.tool("social_stage_info", "Get details about a specific stage", {
    stageId: z.string().describe("Stage UUID"),
  }, async ({ stageId }) => {
    try { return ok(await agent.social.getStageInfo(stageId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_join_stage", "Join a stage as listener or speaker", {
    stageId: z.string().describe("Stage UUID"),
    role: z.string().optional().describe("listener or speaker (default: listener)"),
  }, async ({ stageId, role }) => {
    try { return ok(await agent.social.joinStage(stageId, role)); }
    catch (e) { return err(e); }
  });

  server.tool("social_leave_stage", "Leave a stage", {
    stageId: z.string().describe("Stage UUID"),
  }, async ({ stageId }) => {
    try { return ok(await agent.social.leaveStage(stageId)); }
    catch (e) { return err(e); }
  });

  // ── Livestreams ──

  server.tool("social_create_livestream", "Create a livestream", {
    name: z.string().describe("Livestream name"),
    privacyType: z.number().optional().describe("0=public, 1=followers, 2=shareholders"),
    scheduledStartTime: z.string().optional().describe("ISO datetime to schedule"),
  }, async ({ name, privacyType, scheduledStartTime }) => {
    try { return ok(await agent.social.createLivestream(name, { privacyType, scheduledStartTime })); }
    catch (e) { return err(e); }
  });

  server.tool("social_start_livestream", "Start a scheduled livestream", {
    livestreamId: z.string().describe("Livestream UUID"),
  }, async ({ livestreamId }) => {
    try { return ok(await agent.social.startLivestream(livestreamId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_end_livestream", "End a live livestream", {
    livestreamId: z.string().describe("Livestream UUID"),
  }, async ({ livestreamId }) => {
    try { return ok(await agent.social.endLivestream(livestreamId)); }
    catch (e) { return err(e); }
  });

  server.tool("social_active_livestreams", "Get active livestreams on Arena", {
    page: z.number().optional().describe("Page number"),
  }, async ({ page }) => {
    try { return ok(await agent.social.getActiveLivestreams(page)); }
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

  server.tool("copy_agent_positions", "Get agent's own perps positions (for copy trading comparison)", {
    wallet: z.string().optional().describe("Agent wallet (defaults to agent address)"),
  }, async ({ wallet }) => {
    try { return ok(await agent.copyTrading.getAgentPositions(wallet || w)); }
    catch (e) { return err(e); }
  });

  server.tool("copy_execute_orders", "Execute specific mirror orders (from copy_calculate_orders)", {
    orders: z.array(z.record(z.any())).describe("Array of CopyOrder objects from calculate"),
    currentPrices: z.record(z.number()).describe("Map of symbol → current price"),
  }, async ({ orders, currentPrices }) => {
    try { return ok(await agent.copyTrading.executeMirrorOrders(orders as any, currentPrices)); }
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

  // ── x402 Micropayments ──

  server.tool("x402_create", "Create a paywalled x402 API endpoint on ArenaX402", {
    apiUrl: z.string().describe("Upstream API URL to paywall"),
    merchantWallet: z.string().describe("Wallet address to receive payments"),
    tokenAddress: z.string().describe("Payment token: 0x000...000 for AVAX, or ERC-20 address (ARENA/GLADIUS)"),
    amountWei: z.string().describe("Price in wei"),
    validForSec: z.number().describe("Session duration in seconds after payment"),
    name: z.string().optional().describe("Display name for the API"),
    description: z.string().optional().describe("Description shown on payment page"),
    webhookUri: z.string().optional().describe("Webhook URL called when payment confirmed"),
  }, async ({ apiUrl, merchantWallet, tokenAddress, amountWei, validForSec, name, description, webhookUri }) => {
    try { return ok(await agent.x402.createApi({ apiUrl, merchantWallet, tokenAddress, amountWei, validForSec, name, description, webhookUri })); }
    catch (e) { return err(e); }
  });

  server.tool("x402_access", "Access an x402 endpoint — returns 402 payment info or 200 content", {
    apiId: z.string().describe("The x402 API ID"),
    sessionId: z.string().optional().describe("X-402-Session header value (after payment)"),
  }, async ({ apiId, sessionId }) => {
    try { return ok(await agent.x402.access(apiId, sessionId)); }
    catch (e) { return err(e); }
  });

  server.tool("x402_pay", "Execute on-chain payment for x402 access — handles both AVAX and ERC-20", {
    session_id: z.string().describe("Session ID from 402 response"),
    contract: z.string().describe("x402 payment contract address"),
    amount_wei: z.string().describe("Payment amount in wei"),
    merchant_wallet: z.string().describe("Merchant wallet address"),
    token_address: z.string().describe("Token address (0x000...000 for native AVAX)"),
  }, async ({ session_id, contract, amount_wei, merchant_wallet, token_address }) => {
    try {
      const payment = { session_id, contract, amount_wei, merchant_wallet, token_address, network: { chain_id: 43114, name: "Avalanche C-Chain" }, calls: {} as any };
      const built = agent.x402.buildPayment(payment);
      const results = await agent.execute(Promise.resolve(built));
      return ok(results);
    }
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
