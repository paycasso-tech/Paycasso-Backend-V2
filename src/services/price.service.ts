import axios from "axios";
import NodeCache from "node-cache";

// Cache prices for 30 seconds
const priceCache = new NodeCache({ stdTTL: 30 });

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  lastUpdated: Date;
}

/**
 * Fetch live crypto prices from CoinGecko API
 */
export class PriceService {
  private baseUrl = "https://api.coingecko.com/api/v3";

  async getLivePrices(): Promise<PriceData[]> {
    const cached = priceCache.get<PriceData[]>("live-prices");
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/simple/price`, {
        params: {
          ids: "bitcoin,ethereum,binancecoin,solana,avalanche-2,usd-coin",
          vs_currencies: "usd",
          include_24hr_change: "true",
        },
      });

      const prices: PriceData[] = [
        {
          symbol: "BTC",
          name: "Bitcoin",
          price: response.data.bitcoin?.usd || 0,
          change24h: response.data.bitcoin?.usd_24h_change || 0,
          lastUpdated: new Date(),
        },
        {
          symbol: "ETH",
          name: "Ethereum",
          price: response.data.ethereum?.usd || 0,
          change24h: response.data.ethereum?.usd_24h_change || 0,
          lastUpdated: new Date(),
        },
        {
          symbol: "BNB",
          name: "BNB",
          price: response.data.binancecoin?.usd || 0,
          change24h: response.data.binancecoin?.usd_24h_change || 0,
          lastUpdated: new Date(),
        },
        {
          symbol: "SOL",
          name: "Solana",
          price: response.data.solana?.usd || 0,
          change24h: response.data.solana?.usd_24h_change || 0,
          lastUpdated: new Date(),
        },
        {
          symbol: "AVAX",
          name: "Avalanche",
          price: response.data["avalanche-2"]?.usd || 0,
          change24h: response.data["avalanche-2"]?.usd_24h_change || 0,
          lastUpdated: new Date(),
        },
        {
          symbol: "USDC",
          name: "USD Coin",
          price: response.data["usd-coin"]?.usd || 1,
          change24h: response.data["usd-coin"]?.usd_24h_change || 0,
          lastUpdated: new Date(),
        },
      ];

      priceCache.set("live-prices", prices);
      return prices;
    } catch (error) {
      console.error("[PriceService] Failed to fetch prices:", error);
      // Return fallback prices
      return [
        {
          symbol: "BTC",
          name: "Bitcoin",
          price: 45000,
          change24h: 2.5,
          lastUpdated: new Date(),
        },
        {
          symbol: "ETH",
          name: "Ethereum",
          price: 2500,
          change24h: 1.8,
          lastUpdated: new Date(),
        },
        {
          symbol: "USDC",
          name: "USD Coin",
          price: 1,
          change24h: 0,
          lastUpdated: new Date(),
        },
      ];
    }
  }

  async getUSDCPrice(): Promise<number> {
    return 1; // USDC is always $1
  }
}
