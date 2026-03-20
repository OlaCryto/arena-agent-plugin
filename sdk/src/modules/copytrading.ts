import { HL_INFO } from "../constants.js";
import { PerpsModule } from "./perps.js";

export interface Position {
  coin: string;
  szi: string;       // signed size (negative = short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  leverage: { type: string; value: number };
}

export interface CopyOrder {
  symbol: string;
  direction: "long" | "short";
  size: number;
  action: "open" | "close";
  reason: string;
}

export class CopyTradingModule {
  private perps: PerpsModule;

  constructor(perps: PerpsModule) {
    this.perps = perps;
  }

  /** Fetch all open positions for a Hyperliquid wallet */
  async getTargetPositions(targetWallet: string): Promise<Position[]> {
    const state = await this.perps.getPositions(targetWallet);
    const assetPositions = state?.assetPositions ?? [];
    return assetPositions
      .map((ap: any) => ap.position)
      .filter((p: any) => p && parseFloat(p.szi) !== 0);
  }

  /** Fetch your agent's current positions */
  async getAgentPositions(agentWallet: string): Promise<Position[]> {
    const state = await this.perps.getPositions(agentWallet);
    const assetPositions = state?.assetPositions ?? [];
    return assetPositions
      .map((ap: any) => ap.position)
      .filter((p: any) => p && parseFloat(p.szi) !== 0);
  }

  /**
   * Compare target wallet positions with agent positions and return orders needed to mirror.
   * Uses proportional sizing based on the scale factor.
   *
   * @param targetWallet - Wallet to copy from
   * @param agentWallet - Your agent's wallet
   * @param scaleFactor - Position scale (0.1 = 10% of target size, 1.0 = same size)
   */
  async calculateMirrorOrders(
    targetWallet: string,
    agentWallet: string,
    scaleFactor = 0.1,
  ): Promise<{ orders: CopyOrder[]; targetPositions: Position[]; agentPositions: Position[] }> {
    const [targetPositions, agentPositions] = await Promise.all([
      this.getTargetPositions(targetWallet),
      this.getAgentPositions(agentWallet),
    ]);

    const agentMap = new Map<string, Position>();
    for (const p of agentPositions) {
      agentMap.set(p.coin, p);
    }

    const targetMap = new Map<string, Position>();
    for (const p of targetPositions) {
      targetMap.set(p.coin, p);
    }

    const orders: CopyOrder[] = [];

    // Open or adjust positions to match target
    for (const [coin, targetPos] of targetMap) {
      const targetSize = parseFloat(targetPos.szi);
      const direction: "long" | "short" = targetSize > 0 ? "long" : "short";
      const desiredSize = Math.abs(targetSize) * scaleFactor;
      const agentPos = agentMap.get(coin);

      if (!agentPos) {
        // No position — open one
        orders.push({ symbol: coin, direction, size: desiredSize, action: "open", reason: `Mirror ${coin} ${direction} from target` });
      } else {
        const agentSize = parseFloat(agentPos.szi);
        const agentDir: "long" | "short" = agentSize > 0 ? "long" : "short";

        if (agentDir !== direction) {
          // Wrong direction — close and reopen
          orders.push({ symbol: coin, direction: agentDir, size: Math.abs(agentSize), action: "close", reason: `Close ${agentDir} to flip to ${direction}` });
          orders.push({ symbol: coin, direction, size: desiredSize, action: "open", reason: `Mirror ${coin} ${direction} from target` });
        }
        // Already in correct direction — skip (don't over-adjust)
      }
    }

    // Close positions that target no longer holds
    for (const [coin, agentPos] of agentMap) {
      if (!targetMap.has(coin)) {
        const agentSize = parseFloat(agentPos.szi);
        const dir: "long" | "short" = agentSize > 0 ? "long" : "short";
        orders.push({ symbol: coin, direction: dir, size: Math.abs(agentSize), action: "close", reason: `Target closed ${coin} position` });
      }
    }

    return { orders, targetPositions, agentPositions };
  }

  /**
   * Execute mirror orders via the perps module (Arena API).
   * Returns results for each order.
   */
  async executeMirrorOrders(orders: CopyOrder[], currentPrices: Record<string, number>): Promise<any[]> {
    const results: any[] = [];
    for (const order of orders) {
      const price = currentPrices[order.symbol];
      if (!price) {
        results.push({ order, error: `No price for ${order.symbol}` });
        continue;
      }
      try {
        if (order.action === "close") {
          const result = await this.perps.closePosition(order.symbol, order.direction, order.size, price);
          results.push({ order, result });
        } else {
          const result = await this.perps.placeOrder([{
            symbol: order.symbol,
            direction: order.direction,
            orderType: "market",
            leverageType: "cross",
            size: order.size,
            leverage: 1,
          }]);
          results.push({ order, result });
        }
      } catch (e: any) {
        results.push({ order, error: e.message });
      }
    }
    return results;
  }

  /**
   * One-shot copy: calculate + execute mirror orders in one call.
   * Fetches current prices from Hyperliquid for execution.
   */
  async copyOnce(
    targetWallet: string,
    agentWallet: string,
    scaleFactor = 0.1,
  ): Promise<{ orders: CopyOrder[]; results: any[] }> {
    const { orders } = await this.calculateMirrorOrders(targetWallet, agentWallet, scaleFactor);
    if (orders.length === 0) return { orders, results: [] };

    // Fetch current prices for all symbols
    const pairs = await this.perps.getTradingPairs();
    const midPrices = await this.fetchMidPrices(orders.map(o => o.symbol), pairs.pairs);

    const results = await this.executeMirrorOrders(orders, midPrices);
    return { orders, results };
  }

  /** Fetch mid-market prices from Hyperliquid for given symbols */
  private async fetchMidPrices(symbols: string[], pairs: any[]): Promise<Record<string, number>> {
    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    if (!res.ok) throw new Error(`Failed to fetch mid prices: ${res.status}`);
    const mids: Record<string, string> = await res.json() as Record<string, string>;
    const prices: Record<string, number> = {};
    for (const sym of symbols) {
      if (mids[sym]) prices[sym] = parseFloat(mids[sym]);
    }
    return prices;
  }
}
