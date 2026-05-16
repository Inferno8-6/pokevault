/**
 * Client TCGdex — API multilingue pour cartes Pokémon
 * https://api.tcgdex.net/v2/fr — retourne les vraies cartes françaises
 */

const TCGDEX_BASE = "https://api.tcgdex.net/v2/fr";
const TCGDEX_IMAGES = "https://assets.tcgdex.net/fr";
const TCGDEX_IMAGES_BY_LANG = {
  fr: "https://assets.tcgdex.net/fr",
  en: "https://assets.tcgdex.net/en",
  ja: "https://assets.tcgdex.net/ja",
} as const;

// ─── Helpers d'URL d'image ────────────────────────────────────────────────────

function buildImageBase(cardId: string, localId: string, lang: "fr" | "en" | "ja" = "fr"): string {
  const setId = cardId.slice(0, cardId.lastIndexOf("-"));
  const series = setId.match(/^([a-z]+)/)?.[1] ?? "base";
  return `${TCGDEX_IMAGES_BY_LANG[lang]}/${series}/${setId}/${localId}`;
}

// ─── Fallback pokemontcg.io pour sets sans images TCGdex ──────────────────────

const PTCG_CDN = "https://images.pokemontcg.io";

/**
 * Sets TCGdex connus sans images scannées → correspondance pokemontcg.io
 * numberPrefix : préfixe à ajouter au localId TCGdex pour obtenir le numéro ptcgio
 * ex: sma localId "3" → HIF "SV3"
 */
const PTCG_SET_MAP: Record<string, { ptcgId: string; numberPrefix?: string }> = {
  "sm3.5": { ptcgId: "sleg" },                     // Légendes Brillantes / Shining Legends
  "sm7.5": { ptcgId: "drm" },                      // Majesté des Dragons / Dragon Majesty
  "sma":   { ptcgId: "hif", numberPrefix: "SV" },  // Destinées Occultes Coffre / HF Shiny Vault
};

function getPtcgImageBase(setId: string, localId: string): string | null {
  const mapping = PTCG_SET_MAP[setId];
  if (!mapping) return null;
  const number = mapping.numberPrefix ? `${mapping.numberPrefix}${localId}` : localId;
  return `${PTCG_CDN}/${mapping.ptcgId}/${number}`;
}

/**
 * Résout les URLs d'image selon la priorité :
 * 1. TCGdex image fournie par l'API (champ `image` présent)
 * 2. pokemontcg.io CDN pour les sets connus sans images TCGdex
 * 3. URL TCGdex construite par défaut (peut être 404 pour certains sets)
 */
function resolveImageUrls(
  cardId: string,
  localId: string,
  tcgdexImage?: string,
  lang: "fr" | "en" | "ja" = "fr",
): { small: string; large: string } {
  const setId = cardId.slice(0, cardId.lastIndexOf("-"));

  if (tcgdexImage) {
    return {
      small: `${tcgdexImage}/low.webp`,
      large: `${tcgdexImage}/high.webp`,
    };
  }

  const ptcgBase = getPtcgImageBase(setId, localId);
  if (ptcgBase) {
    return {
      small: `${ptcgBase}.png`,
      large: `${ptcgBase}_hires.png`,
    };
  }

  const tcgdexBase = buildImageBase(cardId, localId, lang);
  return {
    small: `${tcgdexBase}/low.webp`,
    large: `${tcgdexBase}/high.webp`,
  };
}

export function buildSetLogoUrl(setId: string, lang: "fr" | "en" | "ja" = "fr"): string {
  const series = setId.match(/^([a-z]+)/)?.[1] ?? "base";
  return `${TCGDEX_IMAGES_BY_LANG[lang]}/${series}/${setId}/logo.webp`;
}

// ─── Interfaces TCGdex ────────────────────────────────────────────────────────

export interface TCGdexListCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  rarity?: string;
}

export interface TCGdexFullCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  rarity?: string;
  category?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  description?: string;
  attacks?: Array<{
    name: string;
    cost?: string[];
    damage?: number | string;
    effect?: string;
  }>;
  weaknesses?: Array<{ type: string; value: string }>;
  resistances?: Array<{ type: string; value: string }>;
  retreat?: number;
  set?: { id: string; name: string };
  pricing?: {
    cardmarket?: {
      updated: string;
      unit: string;
      avg?: number;
      low?: number;
      trend?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
}

export interface TCGdexSerie {
  id: string;
  name: string;
}

export interface TCGdexSet {
  id: string;
  name: string;
  cardCount: { total: number; official: number };
  releaseDate?: string;
  serie?: TCGdexSerie;
  logo?: string;
  symbol?: string;
}

export interface TCGdexSetFull extends TCGdexSet {
  cards: TCGdexListCard[];
}

// ─── NormalizedCard (format interne) ─────────────────────────────────────────

export interface NormalizedCard {
  id: string;
  name: string;
  supertype: string;
  hp?: string;
  types?: string[];
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    images: { symbol: string; logo: string };
  };
  number: string;
  rarity?: string;
  images: { small: string; large: string };
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
  stage?: string;
  description?: string;
  attacks?: TCGdexFullCard["attacks"];
  weaknesses?: TCGdexFullCard["weaknesses"];
}

// ─── Filtre Pocket Game ────────────────────────────────────────────────────────

export function isPocketGameSet(setId: string): boolean {
  const s = setId.toLowerCase();
  return /^a\d/.test(s) || s === "pa" || s === "p-a" || s.startsWith("promo-a");
}

// ─── Normaliseurs ─────────────────────────────────────────────────────────────

export function normalizeListCard(
  card: TCGdexListCard,
  setId?: string,
  setName?: string,
  lang: TCGdexLanguage = "fr",
): NormalizedCard {
  const resolvedSetId = setId ?? card.id.slice(0, card.id.lastIndexOf("-"));
  const series = resolvedSetId.match(/^([a-z]+)/)?.[1] ?? "base";
  const imagesBase = TCGDEX_IMAGES_BY_LANG[lang];

  return {
    id: card.id,
    name: card.name,
    supertype: "Pokémon",
    set: {
      id: resolvedSetId,
      name: setName ?? resolvedSetId.toUpperCase(),
      series,
      printedTotal: 0,
      total: 0,
      releaseDate: "",
      images: {
        symbol: `${imagesBase}/${series}/${resolvedSetId}/symbol.webp`,
        logo: buildSetLogoUrl(resolvedSetId, lang),
      },
    },
    number: card.localId,
    rarity: card.rarity,
    images: resolveImageUrls(card.id, card.localId, card.image, lang),
  };
}

export function normalizeFullCard(card: TCGdexFullCard, lang: TCGdexLanguage = "fr"): NormalizedCard {
  const setId = card.set?.id ?? card.id.slice(0, card.id.lastIndexOf("-"));
  const series = setId.match(/^([a-z]+)/)?.[1] ?? "base";

  return {
    id: card.id,
    name: card.name,
    supertype: card.category ?? "Pokémon",
    hp: card.hp?.toString(),
    types: card.types,
    set: {
      id: setId,
      name: card.set?.name ?? setId.toUpperCase(),
      series,
      printedTotal: 0,
      total: 0,
      releaseDate: "",
      images: { symbol: "", logo: "" },
    },
    number: card.localId,
    rarity: card.rarity,
    images: resolveImageUrls(card.id, card.localId, card.image, lang),
    cardmarket: card.pricing?.cardmarket
      ? {
          url: "",
          updatedAt: card.pricing.cardmarket.updated,
          prices: {
            averageSellPrice: card.pricing.cardmarket.avg,
            lowPrice: card.pricing.cardmarket.low,
            trendPrice: card.pricing.cardmarket.trend,
            avg1: card.pricing.cardmarket.avg1,
            avg7: card.pricing.cardmarket.avg7,
            avg30: card.pricing.cardmarket.avg30,
          },
        }
      : undefined,
    stage: card.stage,
    description: card.description,
    attacks: card.attacks,
    weaknesses: card.weaknesses,
  };
}

// ─── Fonctions de fetch ───────────────────────────────────────────────────────

/**
 * Langues supportées par TCGdex. "fr" reste le défaut historique (DB existante),
 * "en" et "ja" sont ajoutés pour permettre l'import explicite de sets non-FR.
 */
export type TCGdexLanguage = "fr" | "en" | "ja";

/** Base URL TCGdex pour la langue demandée. */
function baseFor(lang: TCGdexLanguage): string {
  return `https://api.tcgdex.net/v2/${lang}`;
}

export async function searchFrenchCards(name: string): Promise<TCGdexListCard[]> {
  const url = `${TCGDEX_BASE}/cards?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getFullCard(id: string, lang: TCGdexLanguage = "fr"): Promise<TCGdexFullCard | null> {
  const url = `${baseFor(lang)}/cards/${id}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

/** Liste toutes les séries/collections TCGdex pour une langue (sans Pocket Game). */
export async function getSets(lang: TCGdexLanguage = "fr"): Promise<TCGdexSet[]> {
  const url = `${baseFor(lang)}/sets`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return (data as TCGdexSet[]).filter((s) => !isPocketGameSet(s.id));
}

/** Récupère toutes les cartes d'un set pour une langue donnée. */
export async function getSetWithCards(setId: string, lang: TCGdexLanguage = "fr"): Promise<TCGdexSetFull | null> {
  const url = `${baseFor(lang)}/sets/${setId}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}
