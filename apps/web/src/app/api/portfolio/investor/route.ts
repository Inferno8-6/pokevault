import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { computePortfolioMetrics, type Position } from "@/lib/investor-metrics";
import { getUserLimits } from "@/lib/premium";

/**
 * GET /api/portfolio/investor
 *
 * Retourne les KPIs financiers du portfolio + le détail des top/bottom positions
 * pour le Mode Investisseur. Les positions sans `purchasePrice` sont comptées
 * mais exclues des calculs (impossible de calculer un ROI sans prix d'achat).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { isPremium } = await getUserLimits();
  if (!isPremium)
    return NextResponse.json(
      { error: "Le Mode Investisseur est réservé aux membres Premium.", premium: true },
      { status: 403 },
    );

  const items = await db.collection.findMany({
    where: { userId: session.user.id },
    include: {
      card: {
        select: {
          id: true,
          tcgId: true,
          name: true,
          setName: true,
          number: true,
          imageSmall: true,
          rarity: true,
          language: true,
          prices: { orderBy: { fetchedAt: "desc" }, take: 10 },
        },
      },
    },
  });

  // Transforme les rows DB en positions analysables, variant-aware.
  const positions: Position[] = items.map((item) => {
    const v = item.variant !== "normal" ? item.variant : null;
    const variantPrice = v
      ? item.card.prices.find((p) => p.variant === v)
      : null;
    const price = variantPrice?.price ?? item.card.prices[0]?.price ?? 0;
    return {
      purchasePrice: item.purchasePrice ?? 0,
      currentPrice: price,
      quantity: item.quantity,
      acquiredAt: item.addedAt,
    };
  });

  const metrics = computePortfolioMetrics(positions);

  /** Enrichit les top/bottom avec le détail de la carte pour l'UI. */
  function hydrate(refs: typeof metrics.topGainers) {
    return refs
      .map((ref) => {
        const item = items[ref.index];
        if (!item) return null;
        return {
          collectionId: item.id,
          tcgId: item.card.tcgId,
          name: item.card.name,
          setName: item.card.setName,
          number: item.card.number,
          imageSmall: item.card.imageSmall,
          language: item.card.language,
          variant: item.variant,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          currentPrice: item.card.prices[0]?.price ?? null,
          pnl: ref.pnl,
          roi: ref.roi,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  return NextResponse.json({
    summary: {
      positionsTracked: metrics.positionsTracked,
      positionsUntracked: metrics.positionsUntracked,
      totalCost: metrics.totalCost,
      totalValue: metrics.totalValue,
      totalPnL: metrics.totalPnL,
      totalROI: metrics.totalROI,
      avgHoldingDays: metrics.avgHoldingDays,
      annualizedROI: metrics.annualizedROI,
    },
    topGainers: hydrate(metrics.topGainers),
    topLosers: hydrate(metrics.topLosers),
  });
}
