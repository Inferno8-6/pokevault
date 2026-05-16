// Card conditions
export const CARD_CONDITIONS = [
  "mint",
  "near_mint",
  "excellent",
  "good",
  "played",
  "poor",
] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

// Trade status
export const TRADE_STATUSES = ["open", "matched", "completed", "cancelled"] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

// Alert conditions
export const ALERT_CONDITIONS = ["above", "below"] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

// Price sources
export const PRICE_SOURCES = ["cardmarket", "tcgplayer", "ebay"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

// Currencies
export const CURRENCIES = ["EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Format price for display
export function formatPrice(price: number, currency: Currency = "EUR"): string {
  return new Intl.NumberFormat(currency === "EUR" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
  }).format(price);
}

// Calculate percentage change
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Condition label mapping
export const CONDITION_LABELS: Record<CardCondition, string> = {
  mint: "Mint",
  near_mint: "Near Mint",
  excellent: "Excellent",
  good: "Good",
  played: "Played",
  poor: "Poor",
};

// Card variants (holo, reverse, etc.)
export const CARD_VARIANTS = [
  "normal",
  "holo",
  "reverseHolo",
  "firstEdition",
  "cosmos",
  "pokeball",
  "masterball",
] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export const VARIANT_LABELS: Record<CardVariant, string> = {
  normal: "Normale",
  holo: "Holographique",
  reverseHolo: "Reverse Holo",
  firstEdition: "1ère Édition",
  cosmos: "Cosmos",
  pokeball: "Poké Ball",
  masterball: "Master Ball",
};

export const PTCG_VARIANT_MAP: Record<string, CardVariant> = {
  normal: "normal",
  holofoil: "holo",
  reverseHolofoil: "reverseHolo",
  "1stEditionHolofoil": "firstEdition",
  "1stEditionNormal": "firstEdition",
  "1stEdition": "firstEdition",
};

// Sealed product types
export const SEALED_PRODUCT_TYPES = [
  "booster",
  "etb",
  "display",
  "bundle",
  "tin",
  "collection_box",
  "premium",
  "other",
] as const;
export type SealedProductType = (typeof SEALED_PRODUCT_TYPES)[number];

// Sealed conditions (état d'un produit scellé)
export const SEALED_CONDITIONS = ["sealed", "opened", "damaged"] as const;
export type SealedCondition = (typeof SEALED_CONDITIONS)[number];

// Binder layouts (disposition d'une page de classeur)
export const BINDER_LAYOUTS = ["3x3", "3x4", "4x3", "4x4"] as const;
export type BinderLayout = (typeof BINDER_LAYOUTS)[number];

/**
 * Type guard générique pour valider une string contre une liste readonly.
 * Permet d'éviter de dupliquer `if (!ALLOWED.includes(x))` partout.
 *
 * @example
 *   if (!isOneOf(body.condition, SEALED_CONDITIONS))
 *     return error("Condition invalide");
 */
export function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// Limites partagées (alignées sur le schema Prisma)
export const LIMITS = {
  /** Longueur max d'un commentaire / note utilisateur */
  noteLength: 500,
  /** Longueur max d'un nom de classeur / produit */
  nameLength: 80,
  /** Longueur max d'un message inter-utilisateurs */
  messageLength: 2000,
  /** Cap raisonnable sur une quantité d'unités (par carte ou produit) */
  maxQuantity: 999,
  /** Cap raisonnable sur un prix saisi à la main (EUR) */
  maxPriceEur: 100_000,
} as const;
