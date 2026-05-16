import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

/**
 * GET /api/portfolio/cards?q=xxx
 * Retourne les cartes uniques présentes dans la collection de l'utilisateur,
 * filtrées par nom ou set si q est fourni.
 * Utilisé par le modal "Ajouter au classeur" pour chercher dans sa propre collection.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "60"), 120);

  // Récupère les cartes uniques via les entrées de portfolio
  const items = await db.collection.findMany({
    where: {
      userId: session.user.id,
      card: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { setName: { contains: q, mode: "insensitive" } },
              { number: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
    },
    include: {
      card: {
        include: {
          prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { card: { name: "asc" } },
    take: limit,
  });

  // Déduplique par cardId (un utilisateur peut avoir plusieurs entrées avec conditions diff)
  const seen = new Set<string>();
  const cards = items
    .filter((item: typeof items[number]) => {
      if (seen.has(item.cardId)) return false;
      seen.add(item.cardId);
      return true;
    })
    .map((item: typeof items[number]) => ({
      id: item.card.tcgId,
      name: item.card.name,
      setName: item.card.setName,
      number: item.card.number,
      rarity: item.card.rarity,
      imageSmall: item.card.imageSmall,
      currentPrice: item.card.prices[0]?.price ?? null,
      inCollection: true,
      quantity: item.quantity,
    }));

  return NextResponse.json({ cards, total: cards.length });
}
