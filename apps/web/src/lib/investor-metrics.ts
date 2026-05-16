/**
 * Calculs financiers pour le Mode Investisseur.
 *
 * Toutes les fonctions sont pures et testables sans toucher à la DB. Les
 * formules sont volontairement simples — ce n'est pas un terminal Bloomberg,
 * c'est un dashboard pour un collectionneur. Les hypothèses simplificatrices
 * sont documentées au-dessus de chaque fonction.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Nombre de jours dans une année — utilisé pour annualiser les rendements. */
const DAYS_PER_YEAR = 365;

export interface Position {
  /** Valeur unitaire d'achat (€). Si absente, la position est exclue des calculs. */
  purchasePrice: number;
  /** Valeur unitaire actuelle (€). */
  currentPrice: number;
  /** Quantité possédée. */
  quantity: number;
  /** Date d'acquisition. */
  acquiredAt: Date;
}

/**
 * Holding period en jours pour une position donnée (depuis l'acquisition à
 * aujourd'hui). Minimum 1 pour éviter les divisions par zéro sur annualisation.
 */
export function holdingDays(position: Position, now: Date = new Date()): number {
  const diff = (now.getTime() - position.acquiredAt.getTime()) / MS_PER_DAY;
  return Math.max(1, Math.round(diff));
}

/**
 * P&L absolu (€) sur une position.
 * = (prix actuel - prix d'achat) × quantité
 */
export function positionPnL(p: Position): number {
  return (p.currentPrice - p.purchasePrice) * p.quantity;
}

/**
 * ROI relatif (sans dimension, 1 = +100 %).
 * Retourne `null` si le coût d'acquisition est 0 (cadeau, trade) → un ROI infini
 * n'est pas une métrique utile.
 */
export function positionROI(p: Position): number | null {
  const cost = p.purchasePrice * p.quantity;
  if (cost <= 0) return null;
  return positionPnL(p) / cost;
}

/**
 * ROI annualisé via la formule du rendement composé :
 *   (1 + ROI)^(365/days) - 1
 *
 * Utile pour comparer une carte gardée 90j à un livret bancaire. Borné à ±10
 * pour éviter d'afficher "+5000 %/an" sur une carte revendue en 3 jours.
 */
export function positionAnnualizedROI(p: Position, now: Date = new Date()): number | null {
  const roi = positionROI(p);
  if (roi === null) return null;
  const days = holdingDays(p, now);
  const annualized = Math.pow(1 + roi, DAYS_PER_YEAR / days) - 1;
  return Math.max(-10, Math.min(10, annualized));
}

export interface PortfolioMetrics {
  /** Nombre de positions avec un purchasePrice connu (incluses dans les KPIs). */
  positionsTracked: number;
  /** Nombre de positions sans purchasePrice (exclues, juste comptées). */
  positionsUntracked: number;
  /** Coût total d'acquisition (€). */
  totalCost: number;
  /** Valeur de marché actuelle (€) — uniquement sur les positions tracked. */
  totalValue: number;
  /** P&L absolu (€). */
  totalPnL: number;
  /** ROI portfolio (sans dimension). */
  totalROI: number | null;
  /** Holding period moyen pondéré par le coût (jours). */
  avgHoldingDays: number;
  /** ROI annualisé portfolio. */
  annualizedROI: number | null;
  /** Top 3 positions par P&L absolu — pour la section "Meilleurs paris". */
  topGainers: Array<{ pnl: number; roi: number | null; index: number }>;
  /** Bottom 3 positions par P&L absolu — pour identifier les pires choix. */
  topLosers: Array<{ pnl: number; roi: number | null; index: number }>;
}

/**
 * Agrège les KPIs portfolio à partir d'une liste de positions.
 *
 * Hypothèses :
 *  - On ignore les positions sans purchasePrice (achat à prix inconnu, cadeau).
 *  - Les "valeurs actuelles" supposent une revente immédiate au prix marché.
 *  - Pas de prise en compte des frais Cardmarket / shipping (~10 % qu'on omet).
 *  - L'IRR n'est PAS calculé (nécessite un historique de cashflows par date,
 *    on ne l'a que partiellement). Le ROI annualisé est l'approximation utile.
 */
export function computePortfolioMetrics(
  positions: Position[],
  now: Date = new Date(),
): PortfolioMetrics {
  const tracked = positions.filter((p) => p.purchasePrice > 0);
  const untracked = positions.length - tracked.length;

  const totalCost = tracked.reduce((s, p) => s + p.purchasePrice * p.quantity, 0);
  const totalValue = tracked.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const totalPnL = totalValue - totalCost;
  const totalROI = totalCost > 0 ? totalPnL / totalCost : null;

  // Holding period pondéré par le coût (les grosses positions pèsent plus).
  const weightedHoldingSum = tracked.reduce(
    (s, p) => s + holdingDays(p, now) * (p.purchasePrice * p.quantity),
    0,
  );
  const avgHoldingDays = totalCost > 0 ? weightedHoldingSum / totalCost : 0;

  const annualizedROI =
    totalROI !== null && avgHoldingDays > 0
      ? Math.max(
          -10,
          Math.min(10, Math.pow(1 + totalROI, DAYS_PER_YEAR / avgHoldingDays) - 1),
        )
      : null;

  // Top movers : on indexe les positions originales pour que l'appelant
  // puisse récupérer les détails (nom, image) sans dupliquer la data ici.
  const ranked = tracked.map((p, originalIdx) => {
    const pnl = positionPnL(p);
    const roi = positionROI(p);
    return { pnl, roi, index: positions.indexOf(p) === -1 ? originalIdx : positions.indexOf(p) };
  });
  const gainers = [...ranked].sort((a, b) => b.pnl - a.pnl).slice(0, 3);
  const losers = [...ranked].sort((a, b) => a.pnl - b.pnl).slice(0, 3);

  return {
    positionsTracked: tracked.length,
    positionsUntracked: untracked,
    totalCost,
    totalValue,
    totalPnL,
    totalROI,
    avgHoldingDays,
    annualizedROI,
    topGainers: gainers,
    topLosers: losers,
  };
}
