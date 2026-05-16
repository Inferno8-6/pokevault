import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

// GET /api/portfolio/stats — résumé du portfolio
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const collection = await db.collection.findMany({
    where: { userId: session.user.id },
    include: {
      card: {
        include: {
          // Cohérent avec portfolio/route.ts — pas de filtre par source
          // Les 2 derniers prix (n'importe quelle source) pour calculer la variation
          prices: {
            orderBy: { fetchedAt: "desc" },
            take: 2,
          },
        },
      },
    },
  });

  let totalValue = 0;
  let totalCards = 0;
  let totalPreviousValue = 0;
  let topCardName = "-";
  let topCardValue = 0;

  for (const item of collection) {
    const currentPrice = item.card.prices[0]?.price ?? 0;
    // Si on n'a qu'un seul prix historique, pas de variation calculable → 0%
    const previousPrice = item.card.prices[1]?.price ?? currentPrice;
    const value = currentPrice * item.quantity;
    const prevValue = previousPrice * item.quantity;

    totalValue += value;
    totalPreviousValue += prevValue;
    totalCards += item.quantity;

    if (value > topCardValue) {
      topCardValue = value;
      topCardName = item.card.name;
    }
  }

  const change24h =
    totalPreviousValue > 0
      ? ((totalValue - totalPreviousValue) / totalPreviousValue) * 100
      : 0;

  return NextResponse.json({
    totalCards,
    totalValue,
    change24h,
    topCard: topCardName,
  });
}
