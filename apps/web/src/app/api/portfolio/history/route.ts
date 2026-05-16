import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

/**
 * GET /api/portfolio/history
 * Retourne l'évolution de la valeur du portfolio sur les 30 derniers jours
 * à partir de l'historique des prix en base.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Collection de l'utilisateur
  const collection = await db.collection.findMany({
    where: { userId: session.user.id },
    select: { cardId: true, quantity: true },
  });

  if (collection.length === 0)
    return NextResponse.json({ history: [] });

  const cardIds = collection.map((c) => c.cardId);
  const quantityMap = new Map(collection.map((c) => [c.cardId, c.quantity]));

  // Historique de prix sur 30 jours
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const prices = await db.priceHistory.findMany({
    where: { cardId: { in: cardIds }, fetchedAt: { gte: since } },
    orderBy: { fetchedAt: "asc" },
    select: { cardId: true, price: true, fetchedAt: true },
  });

  if (prices.length === 0)
    return NextResponse.json({ history: [] });

  // Groupe par jour YYYY-MM-DD — dernier prix de la journée par carte
  const dayMap = new Map<string, Map<string, number>>();
  for (const p of prices) {
    const day = p.fetchedAt.toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, new Map());
    dayMap.get(day)!.set(p.cardId, p.price);
  }

  // Construction de l'historique : propagation du dernier prix connu
  const sortedDays = Array.from(dayMap.keys()).sort();
  const latestPrices = new Map<string, number>();

  const history = sortedDays.map((day) => {
    const dayPrices = dayMap.get(day)!;
    for (const [cardId, price] of dayPrices) latestPrices.set(cardId, price);

    let total = 0;
    for (const cardId of cardIds) {
      const price = latestPrices.get(cardId);
      if (price === undefined) continue; // ignorer les cartes sans historique de prix
      total += price * (quantityMap.get(cardId) ?? 1);
    }

    return {
      date: new Date(day).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      value: Math.round(total * 100) / 100,
    };
  });

  return NextResponse.json({ history });
}
