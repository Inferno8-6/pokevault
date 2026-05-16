/**
 * Traductions françaises pour les métadonnées des cartes Pokemon TCG
 */

export const RARETE_FR: Record<string, string> = {
  // Raretés de base
  "Common": "Commune",
  "Uncommon": "Peu commune",
  "Rare": "Rare",
  "Promo": "Promo",

  // Holo
  "Rare Holo": "Rare Holo",
  "Rare Holo EX": "Rare Holo EX",
  "Rare Holo GX": "Rare Holo GX",
  "Rare Holo LV.X": "Rare Holo LV.X",
  "Rare Holo Star": "Rare Holo Étoile",
  "Rare Holo V": "Rare Holo V",
  "Rare Holo VMAX": "Rare Holo VMAX",
  "Rare Holo VSTAR": "Rare Holo VSTAR",
  "Rare Holo ex": "Rare Holo ex",

  // Ultra Rare
  "Rare Ultra": "Ultra Rare",
  "Ultra Rare": "Ultra Rare",
  "Rare BREAK": "Rare BREAK",
  "Rare Prime": "Rare Prime",
  "Rare ACE": "Rare AS",
  "Rare Secret": "Rare Secrète",

  // Spéciales
  "Amazing Rare": "Rare Extraordinaire",
  "Rare Rainbow": "Rare Arc-en-ciel",
  "Rare Shining": "Rare Brillante",
  "Rare Shiny": "Rare Shiny",
  "Rare Shiny GX": "Rare Shiny GX",
  "Hyper Rare": "Hyper Rare",
  "Double Rare": "Double Rare",
  "Illustration Rare": "Rare Illustration",
  "Special Illustration Rare": "Rare Illustration Spéciale",
  "Trainer Gallery Rare Holo": "Rare Holo Galerie Dresseur",

  // Legend
  "LEGEND": "LÉGENDE",
};

export const TYPE_FR: Record<string, string> = {
  "Fire": "Feu",
  "Water": "Eau",
  "Grass": "Plante",
  "Lightning": "Électrik",
  "Psychic": "Psy",
  "Fighting": "Combat",
  "Darkness": "Obscurité",
  "Metal": "Métal",
  "Dragon": "Dragon",
  "Fairy": "Fée",
  "Colorless": "Incolore",
};

export const SUPERTYPE_FR: Record<string, string> = {
  "Pokémon": "Pokémon",
  "Trainer": "Dresseur",
  "Energy": "Énergie",
};

/**
 * Traduit une rareté en français
 */
export function getRareteFr(rarity: string | undefined): string | null {
  if (!rarity) return null;
  return RARETE_FR[rarity] ?? rarity;
}

/**
 * Traduit un type en français
 */
export function getTypeFr(type: string): string {
  return TYPE_FR[type] ?? type;
}

/**
 * Traduit le supertype en français
 */
export function getSupertypeFr(supertype: string): string {
  return SUPERTYPE_FR[supertype] ?? supertype;
}
