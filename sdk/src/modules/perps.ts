import { ARENA_SOCIAL_API, HL_INFO } from "../constants.js";

export class PerpsModule {
  constructor(private arenaApiKey?: string) {}

  setArenaApiKey(key: string) { this.arenaApiKey = key; }

  private async arenaRequest(method: "GET" | "POST", path: string, body?: any, query?: Record<string, string>): Promise<any> {
    if (!this.arenaApiKey) throw new Error("Arena API key required for perps. Pass arenaApiKey in config.");
    let url = `${ARENA_SOCIAL_API}${path}`;
    if (query) { const params = new URLSearchParams(query); url += `?${params.toString()}`; }
    const headers: Record<string, string> = { "x-api-key": this.arenaApiKey, "Content-Type": "application/json" };
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data: any = await res.json();
    if (!res.ok) { throw new Error(data.message || data.error || `Arena perps error ${res.status}`); }
    return data;
  }

  private async hlPost(body: any): Promise<any> {
    const res = await fetch(HL_INFO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Hyperliquid API error ${res.status}`);
    return res.json();
  }

  // ── Setup (via Arena API) ──

  async register() { return this.arenaRequest("POST", "/agents/perp/register", { provider: "HYPERLIQUID" }); }
  async getRegistrationStatus() { return this.arenaRequest("GET", "/agents/perp/registration-status", undefined, { provider: "HYPERLIQUID" }); }
  async getWalletAddress() { return this.arenaRequest("GET", "/agents/perp/wallet-address", undefined, { provider: "HYPERLIQUID" }); }

  // ── Auth Flow (via Arena API — EIP-712 signing) ──

  async getAuthStatus() { return this.arenaRequest("POST", "/agents/perp/auth/status", { provider: "HYPERLIQUID" }); }

  async getAuthPayload(step: string, mainWalletAddress?: string) {
    const body: any = { provider: "HYPERLIQUID" };
    if (mainWalletAddress) body.mainWalletAddress = mainWalletAddress;
    return this.arenaRequest("POST", `/agents/perp/auth/${step}/payload`, body);
  }

  async submitAuthSignature(step: string, signature: string, mainWalletAddress?: string, metadata?: any) {
    return this.arenaRequest("POST", `/agents/perp/auth/${step}/submit`, { provider: "HYPERLIQUID", mainWalletAddress, signature, metadata });
  }

  async enableHip3() { return this.arenaRequest("POST", "/agents/perp/auth/enable-hip3", { provider: "HYPERLIQUID" }); }

  // ── Market Data (direct Hyperliquid) ──

  async getTradingPairs(): Promise<{ pairs: any[]; count: number }> {
    const raw = await this.hlPost({ type: "metaAndAssetCtxs" });
    const universe = raw[0].universe;
    const pairs = universe.map((m: any, i: number) => ({
      name: m.name, symbol: m.name, baseAssetId: i,
      sizePrecision: m.szDecimals, maxLeverage: m.maxLeverage,
      isDelisted: false, marginMode: m.onlyIsolated ? "isolated" : "cross",
    }));
    return { pairs, count: pairs.length };
  }

  // ── Trading (via Arena API — they hold the signing keys) ──

  async updateLeverage(symbol: string, leverage: number, leverageType: "cross" | "isolated" = "cross") {
    return this.arenaRequest("POST", "/agents/perp/leverage/update", { provider: "HYPERLIQUID", symbol, leverage, leverageType });
  }

  async placeOrder(orders: any[]) {
    return this.arenaRequest("POST", "/agents/perp/orders/place", { provider: "HYPERLIQUID", orders });
  }

  async cancelOrders(cancels: { assetIndex: number; oid: number }[]) {
    return this.arenaRequest("POST", "/agents/perp/orders/cancel", { provider: "HYPERLIQUID", cancels });
  }

  async closePosition(symbol: string, positionSide: "long" | "short", size: number, currentPrice: number, closePercent = 100) {
    return this.arenaRequest("POST", "/agents/perp/orders/close-position", { provider: "HYPERLIQUID", symbol, positionSide, size, currentPrice, closePercent });
  }

  async getOrders() { return this.arenaRequest("GET", "/agents/perp/orders", undefined, { provider: "HYPERLIQUID" }); }
  async getTradeExecutions() { return this.arenaRequest("GET", "/agents/perp/trade-executions", undefined, { provider: "HYPERLIQUID" }); }

  // ── Positions (direct Hyperliquid — read-only, no auth needed) ──

  async getPositions(wallet: string): Promise<any> {
    return this.hlPost({ type: "clearinghouseState", user: wallet });
  }

  async getOpenOrders(wallet: string): Promise<any> {
    return this.hlPost({ type: "openOrders", user: wallet });
  }
}
