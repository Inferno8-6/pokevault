/**
 * Évaluation d'équité d'une offre de trade.
 *
 * Logique : on additionne la valeur marché de chaque côté ("have" vs "want")
 * et on calcule le ratio. Les seuils d'acceptation sont volontairement larges
 * (±15 %) car le marché Pokémon est bruité : un même Dracaufeu peut osciller
 * de 20 % sur une semaine selon la condition, l'édition, la langue, le timing.
 *
 * Le résultat est destiné à informer l'utilisateur, pas à bloquer l'échange —
 * un trade entre amis ou avec une carte sentimentale peut être "déséquilibré"
 * et parfaitement légitime.
 */

/** Marge de tolérance autour du ratio 1.0 considérée comme équitable. */
export const FAIR_TOLERANCE = 0.15;

/** Sous ce ratio, l'offre est considérée comme une offre douteuse / vide. */
export const MIN_VALUE_FOR_VERDICT = 0.5; // €

export type FairnessVerdict = "fair" | "favors_taker" | "favors_offerer" | "unknown";

export interface FairnessResult {
  haveValue: number;
  wantValue: number;
  /** Ratio = wantValue / haveValue, depuis l'angle du **offerer** :
   *  > 1 → offerer veut plus que ce qu'il donne (mauvais pour la cible)
   *  < 1 → offerer offre plus que ce qu'il demande (bon pour la cible) */
  ratio: number | null;
  /** Différence absolue (€) — utile pour le messaging. */
  delta: number;
  /** Verdict orienté **utilisateur cible** ("dois-je accepter ?"). */
  verdict: FairnessVerdict;
  /** Nombre d'items dont le prix marché est manquant (saisie manuelle requise). */
  missingPriceCount: number;
}

interface ItemWithPrice {
  /** Prix marché unitaire si connu, sinon null (carte JP non cotée, etc.). */
  currentPrice: number | null;
}

/**
 * Calcule le verdict d'équité à partir de deux listes d'items.
 *
 * @param have items que le créateur de l'offre propose
 * @param want items que le créateur de l'offre demande en échange
 */
export function computeFairness(
  have: readonly ItemWithPrice[],
  want: readonly ItemWithPrice[],
): FairnessResult {
  const haveValue = sumPrice(have);
  const wantValue = sumPrice(want);
  const missingPriceCount =
    have.filter((i) => i.currentPrice == null).length +
    want.filter((i) => i.currentPrice == null).length;

  // Pas assez de signal pour trancher — verdict inconnu, on affiche les chiffres
  // bruts mais sans label trompeur.
  if (haveValue < MIN_VALUE_FOR_VERDICT && wantValue < MIN_VALUE_FOR_VERDICT) {
    return { haveValue, wantValue, ratio: null, delta: 0, verdict: "unknown", missingPriceCount };
  }

  const ratio = haveValue > 0 ? wantValue / haveValue : Infinity;
  const delta = wantValue - haveValue;

  let verdict: FairnessVerdict;
  if (ratio > 1 + FAIR_TOLERANCE) {
    // l'offerer demande plus qu'il ne donne → désavantageux pour le taker
    verdict = "favors_offerer";
  } else if (ratio < 1 - FAIR_TOLERANCE) {
    verdict = "favors_taker";
  } else {
    verdict = "fair";
  }

  return { haveValue, wantValue, ratio, delta, verdict, missingPriceCount };
}

function sumPrice(items: readonly ItemWithPrice[]): number {
  return items.reduce((sum, i) => sum + (i.currentPrice ?? 0), 0);
}

/** Métadonnées d'affichage par verdict — couleur, libellé, emoji. */
export const FAIRNESS_META: Record<FairnessVerdict, {
  label: string;
  short: string;
  color: string;
  emoji: string;
  description: string;
}> = {
  fair: {
    label: "Échange équitable",
    short: "Équitable",
    color: "var(--success)",
    emoji: "⚖️",
    description: "Les valeurs marché sont proches (±15 %).",
  },
  favors_taker: {
    label: "Favorable pour vous",
    short: "Bonne affaire",
    color: "var(--primary)",
    emoji: "💎",
    description: "L'offrant donne plus de valeur qu'il n'en demande.",
  },
  favors_offerer: {
    label: "Favorable au demandeur",
    short: "Déséquilibré",
    color: "var(--danger)",
    emoji: "⚠️",
    description: "L'offrant demande plus qu'il ne donne en échange.",
  },
  unknown: {
    label: "Évaluation impossible",
    short: "Sans prix",
    color: "var(--muted)",
    emoji: "❔",
    description: "Pas assez de prix marché disponibles pour évaluer.",
  },
};
