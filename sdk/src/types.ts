// ── Shared ──

/** Unsigned transaction ready to be signed and broadcast */
export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gas?: string;
  gasLimit?: string;
  description?: string;
}

// ── Swap ──

export interface BalancesResponse {
  wallet: string;
  avax: string;
  arena: string;
  avaxFormatted: string;
  arenaFormatted: string;
}

export interface BuyQuoteResponse {
  avaxIn: string;
  arenaOut: string;
  arenaOutFormatted: string;
  rate: string;
  priceImpact: string;
}

export interface SellQuoteResponse {
  arenaIn: string;
  avaxOut: string;
  avaxOutFormatted: string;
  rate: string;
  priceImpact: string;
}

export interface SwapBuyResponse {
  transactions: UnsignedTx[];
  summary: string;
}

export interface SwapSellResponse {
  transactions: UnsignedTx[];
}

// ── Staking ──

export interface StakeInfoResponse {
  staked: string;
  stakedFormatted: string;
  rewards: string;
  rewardsFormatted: string;
  apy: string;
}

export interface StakeBuildResponse {
  transactions: UnsignedTx[];
}

// ── Launchpad ──

export interface TokenCreator {
  address: string;
  handle: string;
  photoUrl: string;
  twitterFollowers: number | null;
  totalTokensCreated: number | null;
}

export interface LaunchpadToken {
  tokenId: string;
  type: "AVAX-paired" | "ARENA-paired";
  name: string;
  symbol: string;
  tokenAddress: string;
  photoUrl: string;
  description: string | null;
  creator: TokenCreator;
  price: { eth: number; usd: number; avaxPrice: number };
  volume: { totalEth: number; totalUsd: number };
  holders: number;
  transactions: number;
  graduationProgress: string | null;
  graduated: boolean;
  supply: number;
  createdAt: string | null;
  whitelist: unknown;
  isOfficial: boolean;
  dexPoolId: string | null;
}

export interface LaunchpadListResponse {
  count: number;
  tokens: LaunchpadToken[];
}

export interface TokenStatsTimeframes {
  "5m": number;
  "1h": number;
  "4h": number;
  "12h": number;
  "24h": number;
}

export interface TokenDetailResponse extends LaunchpadToken {
  stats?: {
    buys: TokenStatsTimeframes;
    sells: TokenStatsTimeframes;
    uniqueBuyers: TokenStatsTimeframes;
    uniqueSellers: TokenStatsTimeframes;
    volume: TokenStatsTimeframes;
    priceChange: TokenStatsTimeframes;
  };
}

export interface LaunchpadQuoteResponse {
  tokensOut?: string;
  avaxCost?: string;
  avaxOut?: string;
  fees?: Record<string, string>;
}

export interface TradeEntry {
  type: "buy" | "sell";
  trader: {
    address: string;
    handle: string;
    name: string;
    photoUrl: string;
    twitterFollowers: number | null;
  };
  tokenAmount: number;
  costOrReward?: { eth: number; usd: number };
  value?: { eth: number; usd: number };
  priceEth: number;
  txHash: string;
  time: string | null;
}

export interface TokenActivityResponse {
  tokenId: string | null;
  tokenAddress: string;
  trades: TradeEntry[];
}

export interface HolderEntry {
  rank: number;
  address: string;
  handle: string;
  name: string;
  photoUrl: string;
  twitterFollowers: number | null;
  balance: number;
  unrealizedPnl: { eth: number; usd: number };
  realizedPnl: { eth: number; usd: number };
  buys: number;
  sells: number;
}

export interface TokenHoldersResponse {
  tokenAddress: string;
  holders: HolderEntry[];
}

export interface GlobalTradeEntry extends TradeEntry {
  token: {
    name: string;
    symbol: string;
    address: string;
    photoUrl: string;
    tokenId: string;
  };
}

export interface GlobalTradesResponse {
  count: number;
  offset: number;
  trades: GlobalTradeEntry[];
}

export interface LaunchpadBuyResponse {
  transactions?: UnsignedTx[];
  graduated?: boolean;
  summary?: string;
  note?: string;
}

export interface LaunchpadSellResponse {
  transactions: UnsignedTx[];
  graduated?: boolean;
  summary?: string;
  note?: string;
}

// ── DEX ──

export interface DexTokenEntry {
  symbol: string;
  address: string;
  decimals: number;
}

export interface DexTokensResponse {
  tokens: DexTokenEntry[];
  note: string;
}

export interface DexTokenInfoResponse {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface DexQuoteResponse {
  from: string;
  to: string;
  amountIn: string;
  amountOut: string;
  rate: string;
  priceImpact: string;
  path: string[];
}

export interface DexBalanceResponse {
  wallet: string;
  token: string;
  balance: string;
  formatted: string;
  symbol: string;
}

export interface DexSwapResponse {
  transactions: UnsignedTx[];
  summary: string;
}

// ── System ──

export interface RegisterResponse {
  apiKey: string;
  wallet: string;
  name: string;
}

export interface BroadcastResponse {
  txHash: string;
}

export interface HealthResponse {
  status: string;
  router: string;
  fee: string;
}
