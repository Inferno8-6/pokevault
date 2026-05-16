export interface TCGCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  set: TCGSet;
  number: string;
  rarity?: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices: Record<string, TCGPrice>;
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
}

export interface TCGSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images: {
    symbol: string;
    logo: string;
  };
}

export interface TCGPrice {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
}

export interface TCGSearchParams {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
}

export interface TCGResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface NormalizedPrice {
  source: string;
  price: number;
  currency: string;
  low?: number;
  mid?: number;
  high?: number;
  trend?: number;
}
