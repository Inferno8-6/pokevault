import type { TCGCard, TCGSet, TCGSearchParams, TCGResponse, NormalizedPrice } from "./types";

const BASE_URL = "https://api.pokemontcg.io/v2";

export class PokemonTCGClient {
  private apiKey?: string;
  private headers: Record<string, string>;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.POKEMON_TCG_API_KEY;
    this.headers = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
    };
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), { headers: this.headers });

    if (!response.ok) {
      throw new Error(`TCG API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // Search cards by name
  async searchCards(name: string, params?: TCGSearchParams): Promise<TCGResponse<TCGCard>> {
    const query = params?.q ? `name:"${name}" ${params.q}` : `name:"${name}"`;
    return this.fetch<TCGResponse<TCGCard>>("/cards", {
      q: query,
      page: String(params?.page || 1),
      pageSize: String(params?.pageSize || 20),
      ...(params?.orderBy ? { orderBy: params.orderBy } : {}),
    });
  }

  // Get a specific card by ID
  async getCard(id: string): Promise<{ data: TCGCard }> {
    return this.fetch<{ data: TCGCard }>(`/cards/${id}`);
  }

  // Search cards with raw query
  async queryCards(query: string, page = 1, pageSize = 20): Promise<TCGResponse<TCGCard>> {
    return this.fetch<TCGResponse<TCGCard>>("/cards", {
      q: query,
      page: String(page),
      pageSize: String(pageSize),
    });
  }

  // Get all sets
  async getSets(): Promise<TCGResponse<TCGSet>> {
    return this.fetch<TCGResponse<TCGSet>>("/sets", {
      orderBy: "-releaseDate",
    });
  }

  // Get a specific set
  async getSet(id: string): Promise<{ data: TCGSet }> {
    return this.fetch<{ data: TCGSet }>(`/sets/${id}`);
  }

  // Get cards from a specific set
  async getSetCards(setId: string, page = 1, pageSize = 50): Promise<TCGResponse<TCGCard>> {
    return this.fetch<TCGResponse<TCGCard>>("/cards", {
      q: `set.id:"${setId}"`,
      page: String(page),
      pageSize: String(pageSize),
      orderBy: "number",
    });
  }

  // Extract normalized prices from a card
  static getPrices(card: TCGCard): NormalizedPrice[] {
    const prices: NormalizedPrice[] = [];

    // Cardmarket prices (EUR)
    if (card.cardmarket?.prices) {
      const cm = card.cardmarket.prices;
      if (cm.averageSellPrice || cm.trendPrice) {
        prices.push({
          source: "cardmarket",
          price: cm.averageSellPrice || cm.trendPrice || 0,
          currency: "EUR",
          low: cm.lowPrice,
          mid: cm.averageSellPrice,
          trend: cm.trendPrice,
        });
      }
    }

    // TCGPlayer prices (USD)
    if (card.tcgplayer?.prices) {
      const variants = card.tcgplayer.prices;
      for (const [variant, priceData] of Object.entries(variants)) {
        if (priceData.market || priceData.mid) {
          prices.push({
            source: `tcgplayer_${variant}`,
            price: priceData.market || priceData.mid || 0,
            currency: "USD",
            low: priceData.low,
            mid: priceData.mid,
            high: priceData.high,
          });
        }
      }
    }

    return prices;
  }
}
