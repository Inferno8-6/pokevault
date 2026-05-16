import { NextRequest, NextResponse } from "next/server";
import { db } from "@pokemon/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLimits } from "@/lib/premium";

/**
 * GET /api/cards/[id]/history?days=30&variant=normal
 * Historique des prix d'une carte spécifique.
 * Free: 30 jours — Premium: 365 jours.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  let maxDays = 30;
  if (session?.user?.id) {
    try {
      const { limits } = await getUserLimits();
      maxDays = limits.priceHistoryDays;
    } catch { /* keep default */ }
  }

  const requestedDays = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10) || 30,
    maxDays,
  );
  const variant = request.nextUrl.searchParams.get("variant") ?? null;

  const card = await db.card.findUnique({
    where: { tcgId: id },
    select: { id: true, name: true, setName: true, number: true },
  });
  if (!card) return NextResponse.json({ history: [], maxDays });

  const since = new Date(Date.now() - requestedDays * 24 * 3600 * 1000);

  const prices = await db.priceHistory.findMany({
    where: {
      cardId: card.id,
      fetchedAt: { gte: since },
      ...(variant ? { variant } : {}),
    },
    orderBy: { fetchedAt: "asc" },
    select: { price: true, fetchedAt: true, source: true },
  });

  // Group by day: keep latest price per day
  const dayMap = new Map<string, { price: number; source: string }>();
  for (const p of prices) {
    const day = p.fetchedAt.toISOString().slice(0, 10);
    dayMap.set(day, { price: p.price, source: p.source ?? "unknown" });
  }

  const history = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { price, source }]) => ({
      date,
      label: new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      price,
      source,
    }));

  // Compute overall change
  const first = history[0]?.price ?? null;
  const last = history[history.length - 1]?.price ?? null;
  const changePct = first && last && first > 0
    ? Math.round(((last - first) / first) * 10000) / 100
    : null;

  return NextResponse.json({
    history,
    maxDays,
    cardName: card.name,
    setName: card.setName,
    changePct,
  });
}
