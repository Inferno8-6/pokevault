import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";
import { CARD_CONDITIONS, CARD_VARIANTS, isOneOf } from "@pokemon/shared";
import type { TCGdexLanguage } from "@/lib/tcgdex";
import { getUserLimits } from "@/lib/premium";

const SUPPORTED_LANGS: readonly TCGdexLanguage[] = ["fr", "en", "ja"] as const;

// GET /api/portfolio — liste la collection avec les prix live
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
          prices: {
            orderBy: { fetchedAt: "desc" },
            take: 20,
          },
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  // Batch query: oldest price in last 7 days per card (for 7d trend)
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const cardIds = collection.map((c) => c.cardId);
  const oldest7dPrices = cardIds.length > 0
    ? await db.priceHistory.findMany({
        where: { cardId: { in: cardIds }, fetchedAt: { gte: since7d } },
        orderBy: { fetchedAt: "asc" },
        distinct: ["cardId"],
        select: { cardId: true, price: true },
      })
    : [];
  const oldest7dMap = new Map(oldest7dPrices.map((p) => [p.cardId, p.price]));

  const items = collection.map((item) => {
    const v = item.variant !== "normal" ? item.variant : null;
    const variantPrices = v
      ? item.card.prices.filter((p) => p.variant === v)
      : [];
    const fallbackPrices = item.card.prices;
    const prices = variantPrices.length > 0 ? variantPrices : fallbackPrices;
    const currentPrice = prices[0]?.price ?? 0;
    const previousPrice = prices[1]?.price ?? currentPrice;
    const changePct = previousPrice > 0
      ? Math.round(((currentPrice - previousPrice) / previousPrice) * 10000) / 100
      : 0;

    // Sparkline: last 8 price readings, oldest→newest
    const sparkline = [...prices].slice(0, 8).reverse().map((p) => p.price);

    // 7-day change using batch-fetched oldest price in window
    const price7dAgo = oldest7dMap.get(item.cardId) ?? currentPrice;
    const change7d = price7dAgo > 0
      ? Math.round(((currentPrice - price7dAgo) / price7dAgo) * 10000) / 100
      : 0;

    return {
      id: item.id,
      cardId: item.cardId,
      tcgId: item.card.tcgId,
      name: item.card.name,
      setName: item.card.setName,
      number: item.card.number,
      rarity: item.card.rarity,
      imageSmall: item.card.imageSmall,
      language: item.card.language,
      quantity: item.quantity,
      condition: item.condition,
      variant: item.variant,
      purchasePrice: item.purchasePrice,
      currentPrice,
      previousPrice,
      changePct,
      change7d,
      sparkline,
      totalValue: currentPrice * item.quantity,
      addedAt: item.addedAt,
    };
  });

  const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);
  const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);

  return NextResponse.json({ items, totalValue, totalCards });
}

// POST /api/portfolio — ajouter une carte à la collection
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { tcgId, quantity = 1, condition = "near_mint", variant = "normal", purchasePrice, lang = "fr" } = body;

  if (!tcgId) {
    return NextResponse.json({ error: "tcgId requis" }, { status: 400 });
  }

  const { limits } = await getUserLimits();
  if (limits.maxCards !== Infinity) {
    const cardCount = await db.collection.aggregate({
      where: { userId: session.user.id },
      _sum: { quantity: true },
    });
    if ((cardCount._sum.quantity ?? 0) >= limits.maxCards) {
      return NextResponse.json(
        { error: `Limite de ${limits.maxCards} cartes atteinte. Passez en Premium pour un ajout illimité.`, premium: true },
        { status: 403 },
      );
    }
  }

  // Validation de la quantité
  const qty = parseInt(String(quantity), 10);
  if (isNaN(qty) || qty < 1 || qty > 999) {
    return NextResponse.json(
      { error: "Quantité invalide (1-999)" },
      { status: 400 }
    );
  }

  if (!isOneOf(condition, CARD_CONDITIONS)) {
    return NextResponse.json({ error: "État invalide" }, { status: 400 });
  }

  if (!isOneOf(variant, CARD_VARIANTS)) {
    return NextResponse.json({ error: "Variante invalide" }, { status: 400 });
  }

  const resolvedLang: TCGdexLanguage = SUPPORTED_LANGS.includes(lang as TCGdexLanguage)
    ? (lang as TCGdexLanguage)
    : "fr";

  try {
    const card = await upsertCardFromTCGdex(tcgId, resolvedLang);

    // Upsert dans la collection
    const collection = await db.collection.upsert({
      where: {
        userId_cardId_condition_variant: {
          userId: session.user.id,
          cardId: card.id,
          condition,
          variant,
        },
      },
      update: {
        quantity: { increment: qty },
      },
      create: {
        userId: session.user.id,
        cardId: card.id,
        quantity: qty,
        condition,
        variant,
        purchasePrice: purchasePrice ?? null,
      },
    });

    return NextResponse.json({ success: true, collection });
  } catch (error) {
    console.error("Portfolio add error:", { tcgId, condition, variant, error });
    const msg = error instanceof Error ? error.message : "Échec ajout de la carte";
    return NextResponse.json(
      { error: msg.includes("not found") ? `Carte ${tcgId} introuvable sur TCGdex` : "Échec ajout de la carte" },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolio — retirer une carte de la collection
// ?id=xxx           → suppression complète
// ?id=xxx&quantity=2 → retire 2 exemplaires (si < quantité totale, décrémente ; sinon supprime)
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const collectionId = searchParams.get("id");
  const qtyParam = searchParams.get("quantity");

  if (!collectionId) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  // Vérification propriété
  const item = await db.collection.findUnique({ where: { id: collectionId } });
  if (!item || item.userId !== session.user.id) {
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  }

  const removeQty = qtyParam ? Math.max(1, parseInt(qtyParam, 10)) : null;

  // Suppression partielle si une quantité est spécifiée et inférieure à la quantité actuelle
  if (removeQty && removeQty < item.quantity) {
    const updated = await db.collection.update({
      where: { id: collectionId },
      data: { quantity: { decrement: removeQty } },
    });
    return NextResponse.json({ success: true, deleted: false, newQuantity: updated.quantity });
  }

  // Suppression complète
  await db.collection.delete({ where: { id: collectionId } });
  return NextResponse.json({ success: true, deleted: true });
}
