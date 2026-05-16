import { NextRequest, NextResponse } from "next/server";
import { db } from "@pokemon/db";

/**
 * GET /api/market/movers?limit=10&period=24h
 * Top gainers + losers parmi TOUTES les cartes de la DB (pas seulement la
 * collection de l'utilisateur). Public — pas d'auth requise.
 */
export async function GET(request: NextRequest) {
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10) || 10,
    20,
  );
  const period = request.nextUrl.searchParams.get("period") ?? "24h";

  // Pour "24h" : compare les 2 derniers prix de chaque carte
  // Pour "7d"  : compare dernier prix vs le plus ancien dans les 7 derniers jours
  const since = period === "7d"
    ? new Date(Date.now() - 7 * 24 * 3600 * 1000)
    : new Date(Date.now() - 48 * 3600 * 1000); // 48h window pour s'assurer d'avoir des données

  // Récupère les cartes avec au moins 2 entrées de prix récentes
  const cards = await db.card.findMany({
    where: {
      prices: { some: { fetchedAt: { gte: since } } },
    },
    include: {
      prices: {
        orderBy: { fetchedAt: "desc" },
        take: period === "7d" ? 200 : 3,
        select: { price: true, fetchedAt: true },
      },
    },
    take: 500,
  });

  type Mover = {
    tcgId: string;
    name: string;
    setName: string;
    number: string;
    imageSmall: string | null;
    currentPrice: number;
    previousPrice: number;
    changePct: number;
    changeAbs: number;
  };

  const movers: Mover[] = [];

  for (const card of cards) {
    if (card.prices.length < 2) continue;

    const current = card.prices[0].price;
    let previous: number;

    if (period === "7d") {
      // Plus ancien prix dans la fenêtre 7j
      const oldest = card.prices[card.prices.length - 1];
      const oldestDate = oldest.fetchedAt;
      if (oldestDate < since) continue; // pas de données dans la fenêtre
      previous = oldest.price;
    } else {
      previous = card.prices[1].price;
    }

    if (previous <= 0 || current <= 0) continue;
    const changePct = ((current - previous) / previous) * 100;
    if (Math.abs(changePct) < 0.1) continue; // filtre le bruit

    movers.push({
      tcgId: card.tcgId,
      name: card.name,
      setName: card.setName,
      number: card.number,
      imageSmall: card.imageSmall,
      currentPrice: current,
      previousPrice: previous,
      changePct: Math.round(changePct * 100) / 100,
      changeAbs: Math.round((current - previous) * 100) / 100,
    });
  }

  const gainers = [...movers]
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, limit);
  const losers = [...movers]
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, limit);

  return NextResponse.json({ gainers, losers, total: movers.length, period });
}
