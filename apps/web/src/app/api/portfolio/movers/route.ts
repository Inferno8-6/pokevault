import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

// GET /api/portfolio/movers — top 5 gainers et losers 24h de la collection
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const collection = await db.collection.findMany({
    where: { userId: session.user.id },
    include: {
      card: {
        include: {
          prices: { orderBy: { fetchedAt: "desc" }, take: 2 },
        },
      },
    },
  });

  const movers = collection
    .map((item) => {
      const current = item.card.prices[0]?.price ?? 0;
      const previous = item.card.prices[1]?.price ?? current;
      const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      const changeAbs = (current - previous) * item.quantity;
      return {
        id: item.id,
        name: item.card.name,
        setName: item.card.setName,
        imageSmall: item.card.imageSmall,
        currentPrice: current,
        previousPrice: previous,
        changePct: Math.round(changePct * 100) / 100,
        changeAbs: Math.round(changeAbs * 100) / 100,
        quantity: item.quantity,
        totalValue: current * item.quantity,
      };
    })
    .filter((m) => m.changePct !== 0);

  const gainers = [...movers].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...movers].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  return NextResponse.json({ gainers, losers });
}
