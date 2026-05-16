/**
 * Client minimal pour pokemontcg.io — utilisé en fallback quand TCGdex
 * n'a pas de prix Cardmarket pour une carte (typiquement les sets EN récents
 * ou les promos).
 *
 * Pas de clé API requise pour les endpoints lecture publique, mais on
 * peut passer une clé via env `POKEMONTCG_API_KEY` pour augmenter le rate
 * limit (passe de 30 req/min anonyme à 20 000/jour authentifié).
 *
 * Docs : https://docs.pokemontcg.io
 */

import type { CardVariant } from "@pokemon/shared";
import { PTCG_VARIANT_MAP } from "@pokemon/shared";

const PTCG_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;
const HEADERS: Record<string, string> = API_KEY ? { "X-Api-Key": API_KEY } : {};

export interface VariantPrice {
  variant: CardVariant;
  price: number;
  source: "cardmarket" | "tcgplayer";
}

interface PtcgCard {
  id: string;
  name: string;
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<
      string,
      { low?: number; mid?: number; market?: number; directLow?: number }
    >;
  };
}

interface PtcgSearchResponse {
  data: PtcgCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

/**
 * Convertit un tcgId TCGdex (ex: "sv03-006") en query pokemontcg.io
 * (set "sv3", number "6"). Pas de mapping universel : on tente le plus
 * probable et on laisse l'appelant gérer le miss.
 *
 * Heuristique : enlever le zéro-padding du number, et garder le setCode
 * tel quel (la plupart des sets EN ont le même code chez les deux).
 */
function tcgdexToPtcgQuery(tcgId: string): { set: string; number: string } | null {
  const lastDash = tcgId.lastIndexOf("-");
  if (lastDash <= 0) return null;
  const set = tcgId.slice(0, lastDash);
  const number = tcgId.slice(lastDash + 1).replace(/^0+/, "") || "0";
  return { set, number };
}

/**
 * Récupère TOUS les prix par variante depuis pokemontcg.io.
 * Cardmarket donne un prix générique (pas de variante), TCGplayer donne
 * un prix par finish (holofoil, reverseHolofoil, normal, etc.).
 */
export async function fetchPokemonTcgPrices(tcgId: string): Promise<VariantPrice[]> {
  const q = tcgdexToPtcgQuery(tcgId);
  if (!q) return [];

  try {
    const url = `${PTCG_BASE}/cards?q=set.id:${encodeURIComponent(q.set)}%20number:${encodeURIComponent(q.number)}&pageSize=1`;
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as PtcgSearchResponse;
    const card = json.data?.[0];
    if (!card) return [];

    const results: VariantPrice[] = [];

    // Cardmarket : prix générique (pas de variante)
    const cm = card.cardmarket?.prices;
    const cmPrice = cm?.trendPrice ?? cm?.averageSellPrice ?? cm?.avg7 ?? cm?.lowPrice;
    if (cmPrice != null && cmPrice > 0) {
      results.push({ variant: "normal", price: cmPrice, source: "cardmarket" });
    }

    // TCGplayer : prix par variante (holofoil, reverseHolofoil, etc.)
    const tp = card.tcgplayer?.prices;
    if (tp) {
      for (const [key, priceData] of Object.entries(tp)) {
        const price = priceData.market ?? priceData.mid;
        if (price == null || price <= 0) continue;
        const mapped = PTCG_VARIANT_MAP[key];
        if (mapped) {
          results.push({ variant: mapped, price, source: "tcgplayer" });
        } else {
          results.push({ variant: "normal", price, source: "tcgplayer" });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/** Compat wrapper — retourne le premier prix trouvé (comportement d'avant). */
export async function fetchPokemonTcgPrice(tcgId: string): Promise<{
  price: number;
  source: "cardmarket" | "tcgplayer";
} | null> {
  const prices = await fetchPokemonTcgPrices(tcgId);
  return prices[0] ?? null;
}
