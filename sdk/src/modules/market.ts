const COINGECKO_API = "https://api.coingecko.com/api/v3";

export interface PriceData { [coinId: string]: { usd: number; usd_24h_change?: number; usd_market_cap?: number; usd_24h_vol?: number } }
export interface TrendingCoin { id: string; name: string; symbol: string; market_cap_rank: number; thumb: string; price_btc: number }
export interface MarketEntry { id: string; symbol: string; name: string; current_price: number; market_cap: number; price_change_percentage_24h: number; total_volume: number; market_cap_rank: number }

export class MarketModule {
  /** Get prices for one or more coins (by CoinGecko ID) */
  async price(ids: string | string[]): Promise<PriceData> {
    const idStr = Array.isArray(ids) ? ids.join(",") : ids;
    const res = await fetch(`${COINGECKO_API}/simple/price?ids=${idStr}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
    if (!res.ok) throw new Error(`CoinGecko price error ${res.status}`);
    return res.json() as Promise<PriceData>;
  }

  /** Get trending coins */
  async trending(): Promise<{ coins: TrendingCoin[] }> {
    const res = await fetch(`${COINGECKO_API}/search/trending`);
    if (!res.ok) throw new Error(`CoinGecko trending error ${res.status}`);
    const data: any = await res.json();
    const coins = (data.coins ?? []).map((c: any) => ({
      id: c.item.id, name: c.item.name, symbol: c.item.symbol,
      market_cap_rank: c.item.market_cap_rank, thumb: c.item.thumb, price_btc: c.item.price_btc,
    }));
    return { coins };
  }

  /** Get top coins by market cap */
  async markets(count = 20, page = 1): Promise<{ coins: MarketEntry[] }> {
    const res = await fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${count}&page=${page}&sparkline=false`);
    if (!res.ok) throw new Error(`CoinGecko markets error ${res.status}`);
    const data: any = await res.json();
    const coins = data.map((c: any) => ({
      id: c.id, symbol: c.symbol, name: c.name, current_price: c.current_price,
      market_cap: c.market_cap, price_change_percentage_24h: c.price_change_percentage_24h,
      total_volume: c.total_volume, market_cap_rank: c.market_cap_rank,
    }));
    return { coins };
  }

  /** Search for coins by query */
  async search(query: string): Promise<{ coins: Array<{ id: string; name: string; symbol: string; market_cap_rank: number }> }> {
    const res = await fetch(`${COINGECKO_API}/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`CoinGecko search error ${res.status}`);
    const data: any = await res.json();
    return { coins: (data.coins ?? []).map((c: any) => ({ id: c.id, name: c.name, symbol: c.symbol, market_cap_rank: c.market_cap_rank })) };
  }

  /** Get AVAX price specifically */
  async avaxPrice(): Promise<{ usd: number; change24h: number }> {
    const data = await this.price("avalanche-2");
    const avax = data["avalanche-2"];
    return { usd: avax?.usd ?? 0, change24h: avax?.usd_24h_change ?? 0 };
  }

  /** Get ARENA price specifically */
  async arenaPrice(): Promise<{ usd: number; change24h: number }> {
    const data = await this.price("arena-social");
    const arena = data["arena-social"];
    return { usd: arena?.usd ?? 0, change24h: arena?.usd_24h_change ?? 0 };
  }
}
