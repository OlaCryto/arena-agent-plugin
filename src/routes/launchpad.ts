import { Router } from "express";
import type { LaunchpadModule } from "../launchpad";
import { trackPosition, removePosition, getPositions } from "../data/positions";
import * as arenaApi from "../data/arena-api";
import { requireApiKey } from "./middleware";
import { logTrade } from "../data/tradelog";
import {
  uploadTokenImage,
  createArenaCommunity,
  buildCreateTokenTx,
  getNextTokenId,
} from "../launchpad/launch";

function formatToken(t: arenaApi.ArenaToken) {
  return {
    tokenId: t.group_id,
    type: t.lp_paired_with === "ARENA" ? "ARENA-paired" : "AVAX-paired",
    name: t.token_name,
    symbol: t.token_symbol,
    tokenAddress: t.token_contract_address,
    photoUrl: t.photo_url,
    description: t.description?.trim() || null,
    creator: {
      address: t.creator_address,
      handle: t.creator_user_handle,
      photoUrl: t.creator_photo_url,
      twitterFollowers: t.creator_twitter_followers,
      totalTokensCreated: t.creator_total_tokens ?? null,
    },
    price: {
      eth: t.latest_price_eth,
      usd: t.latest_price_usd,
      avaxPrice: t.latest_avax_price,
    },
    volume: {
      totalEth: t.latest_total_volume_eth,
      totalUsd: t.latest_total_volume_usd,
    },
    holders: t.latest_holder_count,
    transactions: t.latest_transaction_count,
    graduationProgress: t.graduation_percentage != null ? `${t.graduation_percentage.toFixed(2)}%` : null,
    graduated: t.lp_deployed,
    supply: t.latest_supply_eth,
    createdAt: t.create_time ? new Date(parseInt(t.create_time) * 1000).toISOString() : null,
    whitelist: t.whitelist_info,
    isOfficial: t.is_official,
    dexPoolId: t.v4_pool_id,
  };
}

export function launchpadRoutes(launchpad: LaunchpadModule, provider?: import("ethers").JsonRpcProvider): Router {
  const router = Router();

  // Discovery
  router.get("/launchpad/recent", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 10, 50);
      const type = (req.query.type as string) || "all";
      const raw = await arenaApi.getRecentTokens(Math.min(count * 2, 50));
      let tokens = raw;
      if (type === "avax") tokens = raw.filter(t => t.lp_paired_with === "AVAX");
      else if (type === "arena") tokens = raw.filter(t => t.lp_paired_with === "ARENA");
      const result = tokens.slice(0, count).map(formatToken);
      res.json({ count: result.length, tokens: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/search", requireApiKey, async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.status(400).json({ error: "?q=<name, symbol, or contract address> required" });

      if (q.startsWith("0x") && q.length === 42) {
        const match = await arenaApi.getTokenByAddress(q);
        if (match) {
          const stats = await arenaApi.getTokenStats(q).catch(() => null);
          return res.json({ ...formatToken(match), stats: stats || undefined });
        }
        const result = await launchpad.searchToken(q);
        return res.json(result);
      }

      const results = await arenaApi.searchTokens(q, 20);
      if (results.length === 0) return res.status(404).json({ error: `No tokens found matching "${q}"` });
      res.json({ count: results.length, tokens: results.map(formatToken) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/graduating", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 5, 20);
      const tokens = await arenaApi.getGraduatingTokens(count);
      res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/graduated", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 10, 50);
      const tokens = await arenaApi.getGraduatedTokens(count);
      res.json({ count: tokens.length, tokens: tokens.map(formatToken) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/top-volume", requireApiKey, async (req, res) => {
    try {
      const timeframe = (req.query.timeframe as string) || "24h";
      if (!["5m", "1h", "4h", "24h", "all_time"].includes(timeframe)) {
        return res.status(400).json({ error: "timeframe must be 5m, 1h, 4h, 24h, or all_time" });
      }
      const count = Math.min(parseInt(req.query.count as string) || 10, 50);
      const tokens = await arenaApi.getTopVolume(timeframe as any, count);
      res.json({ count: tokens.length, timeframe, tokens: tokens.map(formatToken) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Intelligence
  router.get("/launchpad/token", requireApiKey, async (req, res) => {
    try {
      const tokenId = req.query.tokenId as string;
      const tokenAddress = req.query.address as string;
      if (!tokenId && !tokenAddress) return res.status(400).json({ error: "?tokenId= or ?address= required" });

      let onChainInfo: any = null;
      if (tokenId) {
        try { onChainInfo = await launchpad.getTokenInfo(tokenId); } catch {}
      }

      let apiData: any = null;
      let stats: any = null;
      const addr = tokenAddress || onChainInfo?.tokenAddress;
      if (addr) {
        const match = await arenaApi.getTokenByAddress(addr).catch(() => null);
        if (match) apiData = formatToken(match);
        stats = await arenaApi.getTokenStats(addr).catch(() => null);
      }

      res.json({
        ...(apiData || {}),
        ...(onChainInfo || {}),
        stats: stats ? {
          buys: { "5m": stats.buyCount5m, "1h": stats.buyCount1, "4h": stats.buyCount4, "12h": stats.buyCount12, "24h": stats.buyCount24 },
          sells: { "5m": stats.sellCount5m, "1h": stats.sellCount1, "4h": stats.sellCount4, "12h": stats.sellCount12, "24h": stats.sellCount24 },
          uniqueBuyers: { "5m": stats.uniqueBuys5m, "1h": stats.uniqueBuys1, "4h": stats.uniqueBuys4, "12h": stats.uniqueBuys12, "24h": stats.uniqueBuys24 },
          uniqueSellers: { "5m": stats.uniqueSells5m, "1h": stats.uniqueSells1, "4h": stats.uniqueSells4, "12h": stats.uniqueSells12, "24h": stats.uniqueSells24 },
          volume: { "5m": stats.volume5m, "1h": stats.volume1, "4h": stats.volume4, "12h": stats.volume12, "24h": stats.volume24 },
          priceChange: { "5m": stats.priceChange5m, "1h": stats.priceChange1, "4h": stats.priceChange4, "12h": stats.priceChange12, "24h": stats.priceChange24 },
        } : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/quote", requireApiKey, async (req, res) => {
    try {
      const tokenId = req.query.tokenId as string;
      const side = req.query.side as string;
      if (!tokenId || !side) return res.status(400).json({ error: "?tokenId= and ?side=buy|sell required" });
      const amount = side === "buy" ? req.query.avax as string : req.query.tokenAmount as string;
      if (!amount) return res.status(400).json({ error: side === "buy" ? "?avax= required for buy" : "?tokenAmount= required for sell" });
      const quote = await launchpad.getTokenQuote(tokenId, amount, side as any);
      res.json(quote);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/portfolio", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      if (!wallet) return res.status(400).json({ error: "?wallet= required" });
      const tokenIds = getPositions(wallet);
      const portfolio = await launchpad.getPortfolio(wallet, tokenIds);
      res.json(portfolio);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/market-cap", requireApiKey, async (req, res) => {
    try {
      const tokenId = req.query.tokenId as string;
      if (!tokenId) return res.status(400).json({ error: "?tokenId= required" });
      const mcap = await launchpad.getMarketCap(tokenId);
      res.json(mcap);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/activity", requireApiKey, async (req, res) => {
    try {
      const tokenId = req.query.tokenId as string;
      const tokenAddress = req.query.address as string;
      const count = Math.min(parseInt(req.query.count as string) || 20, 50);
      if (!tokenId && !tokenAddress) return res.status(400).json({ error: "?tokenId= or ?address= required" });

      let addr = tokenAddress;
      if (!addr && tokenId) {
        try {
          const info = await launchpad.getTokenInfo(tokenId);
          addr = info.tokenAddress;
        } catch {}
      }

      if (addr) {
        try {
          const trades = await arenaApi.getTokenTrades(addr, count);
          const formatted = trades.results.map(t => ({
            type: t.token_eth > 0 ? "buy" : "sell",
            trader: {
              address: t.user_address,
              handle: t.user_handle,
              name: t.username,
              photoUrl: t.user_photo_url,
              twitterFollowers: t.user_twitter_followers,
            },
            tokenAmount: Math.abs(t.token_eth),
            costOrReward: { eth: Math.abs(t.user_eth), usd: Math.abs(t.user_usd) },
            priceEth: t.price_eth,
            priceAfterEth: t.price_after_eth,
            txHash: t.transaction_hash,
            time: t.create_time ? new Date(parseInt(t.create_time) * 1000).toISOString() : null,
            traderCurrentBalance: t.current_balance,
          }));
          return res.json({ tokenId: tokenId || null, tokenAddress: addr, trades: formatted });
        } catch {}
      }

      if (tokenId) {
        const activity = await launchpad.getActivity(tokenId, count);
        return res.json(activity);
      }
      res.status(400).json({ error: "Could not resolve token address" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/holders", requireApiKey, async (req, res) => {
    try {
      const tokenAddress = req.query.address as string;
      const tokenId = req.query.tokenId as string;
      const count = Math.min(parseInt(req.query.count as string) || 20, 50);

      let addr = tokenAddress;
      if (!addr && tokenId) {
        try {
          const info = await launchpad.getTokenInfo(tokenId);
          addr = info.tokenAddress;
        } catch {}
      }
      if (!addr) return res.status(400).json({ error: "?address= or ?tokenId= required" });

      const holders = await arenaApi.getTokenHolders(addr, count);
      const formatted = holders.map(h => ({
        rank: parseInt(h.rank),
        address: h.user_address,
        handle: h.user_handle,
        name: h.username,
        photoUrl: h.user_photo_url,
        twitterFollowers: h.twitter_followers,
        balance: h.current_balance,
        unrealizedPnl: { eth: h.unrealized_pnl_eth, usd: h.unrealized_pnl_usd },
        realizedPnl: { eth: h.realized_pnl_eth, usd: h.realized_pnl_usd },
        buys: parseInt(h.buy_count),
        sells: parseInt(h.sell_count),
      }));
      res.json({ tokenAddress: addr, holders: formatted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/overview", requireApiKey, async (req, res) => {
    try {
      const overview = await launchpad.getOverview();
      res.json(overview);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/trades", requireApiKey, async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const trades = await arenaApi.getGlobalTrades(count, offset);
      const formatted = trades.results.map(t => ({
        type: t.token_eth > 0 ? "buy" : "sell",
        token: {
          name: t.token_name,
          symbol: t.token_symbol,
          address: t.token_contract_address,
          photoUrl: t.photo_url,
          tokenId: t.token_id,
        },
        trader: {
          address: t.user_address,
          handle: t.user_handle,
          name: t.username,
          photoUrl: t.user_photo_url,
          twitterFollowers: t.user_twitter_followers,
        },
        tokenAmount: Math.abs(t.token_eth),
        value: { eth: Math.abs(t.user_eth), usd: Math.abs(t.user_usd) },
        priceEth: t.price_eth,
        txHash: t.transaction_hash,
        time: t.create_time ? new Date(parseInt(t.create_time) * 1000).toISOString() : null,
      }));
      res.json({ count: formatted.length, offset, trades: formatted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trading
  router.get("/launchpad/build/buy", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const tokenId = req.query.tokenId as string;
      const avax = req.query.avax as string;
      const slippage = req.query.slippage as string;
      if (!wallet || !tokenId || !avax) return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?avax= required" });
      const result = await launchpad.buildLaunchpadBuyTx(wallet, tokenId, avax, slippage ? Number(slippage) : undefined);
      trackPosition(wallet, Number(tokenId));
      logTrade(req.get("X-API-Key") || "unknown", wallet, "launchpad-buy", `Buy tokenId ${tokenId} with ${avax} AVAX`, "launchpad");

      // Graduated tokens return a DexModule response
      if ("graduated" in result) {
        const { graduated, transactions, summary } = result as { graduated: true; transactions: any[]; summary: string };
        res.json({ graduated, transactions, summary, note: "This token has graduated from the bonding curve and now trades via Arena DEX." });
      } else {
        res.json(result);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/launchpad/build/sell", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const tokenId = req.query.tokenId as string;
      const amount = req.query.amount as string;
      const slippage = req.query.slippage as string;
      if (!wallet || !tokenId || !amount) return res.status(400).json({ error: "?wallet=, ?tokenId=, and ?amount= required" });
      const result = await launchpad.buildLaunchpadSellTx(wallet, tokenId, amount, slippage ? Number(slippage) : undefined);
      if (amount === "max") removePosition(wallet, Number(tokenId));
      logTrade(req.get("X-API-Key") || "unknown", wallet, "launchpad-sell", `Sell tokenId ${tokenId} amount ${amount}`, "launchpad");

      // Graduated tokens return a DexModule response
      if ("graduated" in result) {
        const { graduated, transactions, summary } = result as { graduated: true; transactions: any[]; summary: string };
        res.json({ graduated, transactions, summary, note: "This token has graduated from the bonding curve and now trades via Arena DEX." });
      } else {
        res.json({ transactions: result });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Token Launch ───

  /** Upload a token image (base64) and get the Arena-hosted URL */
  router.post("/launchpad/upload-image", requireApiKey, async (req, res) => {
    try {
      const { imageBase64, fileType } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "imageBase64 required in JSON body" });
      const imageUrl = await uploadTokenImage(imageBase64, fileType || "image/jpeg");
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Full token launch: upload image → create Arena community → build createToken tx */
  router.post("/launchpad/launch", requireApiKey, async (req, res) => {
    try {
      const { wallet, name, symbol, imageBase64, fileType, paymentToken, initialBuyAvax } = req.body;
      if (!wallet || !name || !symbol) {
        return res.status(400).json({ error: "wallet, name, and symbol required in JSON body" });
      }

      const pairType = paymentToken || "arena";
      if (!["avax", "arena"].includes(pairType)) {
        return res.status(400).json({ error: "paymentToken must be 'avax' or 'arena'" });
      }

      // Step 1: Upload image (optional — use default if not provided)
      let imageUrl = "";
      if (imageBase64) {
        imageUrl = await uploadTokenImage(imageBase64, fileType || "image/jpeg");
      }

      // Step 2: Create community on Arena backend (best-effort — requires ARENA_JWT to match wallet)
      let community: any = null;
      try {
        community = await createArenaCommunity({
          name,
          ticker: symbol,
          tokenName: name,
          photoURL: imageUrl,
          address: wallet,
          paymentToken: pairType,
        });
      } catch (err: any) {
        // Community creation is optional — token can still be created on-chain
        // Arena auto-links based on creator address when the on-chain tx confirms
        community = { skipped: true, reason: err.message };
      }

      // Step 3: Build unsigned createToken transaction
      const transaction = buildCreateTokenTx(wallet, name, symbol, pairType, initialBuyAvax || "0");

      // Step 4: Get next token ID for reference
      let nextTokenId = "unknown";
      if (provider) {
        try {
          nextTokenId = await getNextTokenId(provider, pairType);
        } catch {}
      }

      logTrade(req.get("X-API-Key") || "unknown", wallet, "launchpad-create", `Launch token "${name}" ($${symbol}) [${pairType}]`, "launchpad");

      res.json({
        community,
        imageUrl,
        transaction,
        nextTokenId,
        instructions: [
          "1. Sign and broadcast the transaction to create your token on-chain.",
          "2. Arena will automatically link the on-chain token to the community you just created.",
          `3. Your token will appear on arena.social once the transaction confirms.`,
          `4. Expected token ID: ${nextTokenId}`,
        ],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Build only the createToken transaction (no image upload or community creation) */
  router.get("/launchpad/build/create", requireApiKey, async (req, res) => {
    try {
      const wallet = req.query.wallet as string;
      const name = req.query.name as string;
      const symbol = req.query.symbol as string;
      const paymentToken = (req.query.paymentToken as string) || "arena";
      const initialBuyAvax = (req.query.initialBuyAvax as string) || "0";

      if (!wallet || !name || !symbol) {
        return res.status(400).json({ error: "?wallet=, ?name=, and ?symbol= required" });
      }

      const transaction = buildCreateTokenTx(wallet, name, symbol, paymentToken as "avax" | "arena", initialBuyAvax);

      let nextTokenId = "unknown";
      if (provider) {
        try {
          nextTokenId = await getNextTokenId(provider, paymentToken as "avax" | "arena");
        } catch {}
      }

      res.json({ transaction, nextTokenId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
