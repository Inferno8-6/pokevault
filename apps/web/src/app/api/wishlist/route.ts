import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";

// GET /api/wishlist
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const items = await db.wishlist.findMany({
    where: { userId: session.user.id },
    include: {
      card: {
        include: { prices: { orderBy: { fetchedAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  const result = items.map((item) => ({
    id: item.id,
    cardId: item.card.tcgId,
    cardDbId: item.card.id,
    cardName: item.card.name,
    setName: item.card.setName,
    number: item.card.number,
    imageSmall: item.card.imageSmall,
    maxPrice: item.maxPrice,
    currentPrice: item.card.prices[0]?.price ?? null,
    addedAt: item.addedAt,
  }));

  return NextResponse.json({ items: result });
}

// POST /api/wishlist
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { tcgId, maxPrice } = await request.json();
  if (!tcgId)
    return NextResponse.json({ error: "tcgId requis" }, { status: 400 });

  let parsedMaxPrice: number | null = null;
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== "") {
    parsedMaxPrice = parseFloat(String(maxPrice));
    if (isNaN(parsedMaxPrice) || parsedMaxPrice <= 0)
      return NextResponse.json({ error: "Prix cible invalide (doit être > 0)" }, { status: 400 });
  }

  try {
    const card = await upsertCardFromTCGdex(tcgId);

    const item = await db.wishlist.upsert({
      where: { userId_cardId: { userId: session.user.id, cardId: card.id } },
      update: { maxPrice: parsedMaxPrice },
      create: {
        userId: session.user.id,
        cardId: card.id,
        maxPrice: parsedMaxPrice,
      },
    });

    return NextResponse.json({ success: true, id: item.id });
  } catch (error) {
    console.error("Wishlist add error:", error);
    return NextResponse.json({ error: "Échec ajout" }, { status: 500 });
  }
}

// DELETE /api/wishlist?id=xxx
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const item = await db.wishlist.findUnique({ where: { id } });
  if (!item || item.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await db.wishlist.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
