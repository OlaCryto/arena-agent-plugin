import { LIFI_API } from "../constants.js";

export interface BridgeQuoteResponse {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  estimatedTime: number;
  tool: string;
  transaction?: { to: string; data: string; value: string; gasLimit?: string; chainId: number };
}

export interface BridgeStatusResponse {
  status: "NOT_FOUND" | "PENDING" | "DONE" | "FAILED";
  substatus?: string;
  receiving?: { txHash: string; amount: string; token: string; chainId: number };
}

export interface BridgeLiFiToken { address: string; symbol: string; decimals: number; name: string; priceUSD?: string; chainId: number; }
export interface BridgeLiFiChain { id: number; key: string; name: string; chainType: string; nativeToken?: { symbol: string; decimals: number; address: string }; }

export const BRIDGE_CHAINS = {
  ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, polygon: 137,
  bsc: 56, avalanche: 43114, fantom: 250, gnosis: 100, zksync: 324,
  linea: 59144, scroll: 534352, blast: 81457, mantle: 5000,
} as const;

export const USDC: Record<string, string> = {
  "1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "43114": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  "137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export class BridgeModule {
  async getChains(): Promise<{ chains: BridgeLiFiChain[]; count: number }> {
    const res = await fetch(`${LIFI_API}/chains`);
    if (!res.ok) throw new Error(`Li.Fi chains failed (${res.status})`);
    const data: any = await res.json();
    return { chains: data.chains, count: data.chains.length };
  }

  async getTokens(chains: string): Promise<{ tokens: Record<string, BridgeLiFiToken[]> }> {
    const res = await fetch(`${LIFI_API}/tokens?chains=${chains}`);
    if (!res.ok) throw new Error(`Li.Fi tokens failed (${res.status})`);
    const data: any = await res.json();
    return { tokens: data.tokens };
  }

  async getToken(chainId: number, address: string): Promise<BridgeLiFiToken> {
    const res = await fetch(`${LIFI_API}/token?chain=${chainId}&token=${address}`);
    if (!res.ok) throw new Error(`Li.Fi token failed (${res.status})`);
    return (await res.json()) as BridgeLiFiToken;
  }

  async getConnections(fromChainId: number, toChainId: number, fromToken?: string, toToken?: string): Promise<{ connections: any[] }> {
    const params = new URLSearchParams({ fromChain: fromChainId.toString(), toChain: toChainId.toString() });
    if (fromToken) params.set("fromToken", fromToken);
    if (toToken) params.set("toToken", toToken);
    const res = await fetch(`${LIFI_API}/connections?${params}`);
    if (!res.ok) throw new Error(`Li.Fi connections failed (${res.status})`);
    const data: any = await res.json();
    return { connections: data.connections };
  }

  async getQuote(
    fromChainId: number, toChainId: number, fromToken: string, toToken: string,
    fromAmount: string, fromAddress: string, toAddress?: string, slippage?: number, fromDecimals?: number,
  ): Promise<BridgeQuoteResponse> {
    const decimals = fromDecimals ?? 18;
    const amountWei = this.parseUnits(fromAmount, decimals);
    const params = new URLSearchParams({
      fromChain: fromChainId.toString(), toChain: toChainId.toString(),
      fromToken, toToken, fromAmount: amountWei, fromAddress,
      toAddress: toAddress ?? fromAddress, slippage: (slippage ?? 0.03).toString(),
      integrator: "logiqical",
    });
    const res = await fetch(`${LIFI_API}/quote?${params}`);
    if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`Li.Fi quote failed (${res.status}): ${body}`); }
    return this.parseQuote(await res.json());
  }

  async getRoutes(
    fromChainId: number, toChainId: number, fromToken: string, toToken: string,
    fromAmount: string, fromAddress: string, toAddress?: string, slippage?: number, fromDecimals?: number,
  ): Promise<{ routes: BridgeQuoteResponse[]; count: number }> {
    const decimals = fromDecimals ?? 18;
    const amountWei = this.parseUnits(fromAmount, decimals);
    const body = {
      fromChainId, toChainId, fromTokenAddress: fromToken, toTokenAddress: toToken,
      fromAmount: amountWei, fromAddress, toAddress: toAddress ?? fromAddress,
      options: { slippage: slippage ?? 0.03, integrator: "logiqical", order: "RECOMMENDED" },
    };
    const res = await fetch(`${LIFI_API}/advanced/routes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const b = await res.text().catch(() => ""); throw new Error(`Li.Fi routes failed (${res.status}): ${b}`); }
    const data: any = await res.json();
    const routes = (data.routes ?? []).map((r: any) => this.parseRoute(r));
    return { routes, count: routes.length };
  }

  async getStatus(txHash: string, fromChainId: number, toChainId: number, bridge?: string): Promise<BridgeStatusResponse> {
    const params = new URLSearchParams({ txHash, fromChain: fromChainId.toString(), toChain: toChainId.toString() });
    if (bridge) params.set("bridge", bridge);
    const res = await fetch(`${LIFI_API}/status?${params}`);
    if (!res.ok) throw new Error(`Li.Fi status failed (${res.status})`);
    return (await res.json()) as BridgeStatusResponse;
  }

  getInfo() {
    return { chains: BRIDGE_CHAINS, usdc: USDC, nativeToken: NATIVE_TOKEN, tip: "Use 0x0000...0000 for native tokens" };
  }

  private parseUnits(amount: string, decimals: number): string {
    const parts = amount.split(".");
    const whole = parts[0] || "0";
    const frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
    return (BigInt(whole) * (BigInt(10) ** BigInt(decimals)) + BigInt(frac)).toString();
  }

  private parseQuote(data: any): BridgeQuoteResponse {
    const action = data.action ?? {};
    const estimate = data.estimate ?? {};
    const txReq = data.transactionRequest;
    const quote: BridgeQuoteResponse = {
      id: data.id ?? data.tool ?? "unknown", fromChainId: action.fromChainId ?? 0, toChainId: action.toChainId ?? 0,
      fromToken: action.fromToken?.address ?? "", toToken: action.toToken?.address ?? "",
      fromAmount: action.fromAmount ?? "0", toAmount: estimate.toAmount ?? "0",
      estimatedGas: estimate.gasCosts?.[0]?.amountUSD ?? "0", estimatedTime: estimate.executionDuration ?? 0,
      tool: data.tool ?? "unknown",
    };
    if (txReq) {
      quote.transaction = { to: txReq.to, data: txReq.data, value: txReq.value ?? "0x0", gasLimit: txReq.gasLimit, chainId: txReq.chainId ?? action.fromChainId };
    }
    return quote;
  }

  private parseRoute(route: any): BridgeQuoteResponse {
    const steps = route.steps ?? [];
    const firstStep = steps[0] ?? {};
    const action = firstStep.action ?? {};
    const estimate = firstStep.estimate ?? {};
    return {
      id: route.id ?? "unknown", fromChainId: route.fromChainId ?? 0, toChainId: route.toChainId ?? 0,
      fromToken: route.fromToken?.address ?? "", toToken: route.toToken?.address ?? "",
      fromAmount: route.fromAmount ?? "0", toAmount: route.toAmount ?? "0",
      estimatedGas: route.gasCostUSD ?? "0",
      estimatedTime: steps.reduce((t: number, s: any) => t + (s.estimate?.executionDuration ?? 0), 0),
      tool: firstStep.tool ?? "unknown",
    };
  }
}
