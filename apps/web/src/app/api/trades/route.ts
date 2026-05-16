import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";
import { findAndSaveMatches } from "@/lib/trade-matcher";
import { computeFairness } from "@/lib/trade-fairness";

const TRADES_PAGE_SIZE = 50;
const TRADES_MAX_PAGE_SIZE = 100;

// ─── GET /api/trades ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mine = searchParams.get("mine") === "1";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    TRADES_MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize") ?? TRADES_PAGE_SIZE))
  );

  const session = await getServerSession(authOptions);
  const myId = session?.user?.id;

  const where = mine
    ? { userId: myId ?? "", status: { not: "cancelled" } }
    : { status: "open" };

  const [offers, totalCount] = await Promise.all([
    db.tradeOffer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            discordId: true,
            reviewsReceived: {
              select: { score: true },
            },
          },
        },
        items: {
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
                prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
              },
            },
          },
        },
        matchesA: mine ? { select: { id: true } } : false,
        matchesB: mine ? { select: { id: true } } : false,
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    db.tradeOffer.count({ where }),
  ]);

  // Sets O(1) des cartes du user courant — sert à détecter les matches potentiels
  // dans la vue marché sans faire un .includes() linéaire pour chaque offre.
  let myHaveCardIds = new Set<string>();
  let myWantCardIds = new Set<string>();

  if (myId && !mine) {
    const myOffers = await db.tradeOffer.findMany({
      where: { userId: myId, status: "open" },
      select: { items: { select: { cardId: true, direction: true } } },
    });
    for (const o of myOffers) {
      for (const i of o.items) {
        if (i.direction === "have") myHaveCardIds.add(i.cardId);
        else if (i.direction === "want") myWantCardIds.add(i.cardId);
      }
    }
  }

  const result = offers.map((offer) => {
    // Une seule passe sur items au lieu de deux filter() séparés
    const haveItems: typeof offer.items = [];
    const wantItems: typeof offer.items = [];
    let hasHaveMatch = false;
    let hasWantMatch = false;
    for (const i of offer.items) {
      if (i.direction === "have") {
        haveItems.push(i);
        if (myWantCardIds.has(i.cardId)) hasHaveMatch = true;
      } else if (i.direction === "want") {
        wantItems.push(i);
        if (myHaveCardIds.has(i.cardId)) hasWantMatch = true;
      }
    }

    const reviews = offer.user.reviewsReceived ?? [];
    const avgRep =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
        : null;

    const isMatch = Boolean(myId && offer.user.id !== myId && hasHaveMatch && hasWantMatch);
    const matchCount = mine
      ? (offer.matchesA?.length ?? 0) + (offer.matchesB?.length ?? 0)
      : 0;

    // Évaluation d'équité — calculée serveur-side pour que le client n'ait
    // pas à reconnaître la structure des prix Cardmarket.
    const fairness = computeFairness(
      haveItems.map((i) => ({ currentPrice: i.card.prices[0]?.price ?? null })),
      wantItems.map((i) => ({ currentPrice: i.card.prices[0]?.price ?? null })),
    );

    return {
      id: offer.id,
      status: offer.status,
      createdAt: offer.createdAt,
      user: {
        id: offer.user.id,
        name: offer.user.name,
        image: offer.user.image,
        discordId: offer.user.discordId,
        reputation: avgRep,
        reviewCount: reviews.length,
      },
      have: haveItems.map(mapItem),
      want: wantItems.map(mapItem),
      isMatch,
      matchCount,
      fairness,
    };
  });

  return NextResponse.json({
    offers: result,
    page,
    pageSize,
    totalCount,
    hasMore: page * pageSize < totalCount,
  });
}

/** Sérialise un item de trade vers le format attendu côté client. */
function mapItem(i: {
  id: string;
  card: {
    tcgId: string;
    name: string;
    setName: string;
    number: string;
    imageSmall: string | null;
    rarity: string | null;
    prices: { price: number }[];
  };
}) {
  return {
    id: i.id,
    cardId: i.card.tcgId,
    name: i.card.name,
    setName: i.card.setName,
    number: i.card.number,
    imageSmall: i.card.imageSmall,
    rarity: i.card.rarity,
    currentPrice: i.card.prices[0]?.price ?? null,
  };
}

// ─── POST /api/trades — créer une offre et déclencher le matching ─────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const { have, want } = body as { have: unknown; want: unknown };

  const haveArr = Array.isArray(have) ? have.filter((x): x is string => typeof x === "string") : [];
  const wantArr = Array.isArray(want) ? want.filter((x): x is string => typeof x === "string") : [];

  if (!haveArr.length && !wantArr.length)
    return NextResponse.json(
      { error: "L'offre doit contenir au moins une carte" },
      { status: 400 }
    );

  // Anti-abus : une offre raisonnable ne dépasse pas 50 cartes par direction.
  const MAX_ITEMS_PER_DIRECTION = 50;
  if (haveArr.length > MAX_ITEMS_PER_DIRECTION || wantArr.length > MAX_ITEMS_PER_DIRECTION)
    return NextResponse.json(
      { error: `Trop de cartes (max ${MAX_ITEMS_PER_DIRECTION} par direction)` },
      { status: 400 }
    );

  try {
    const allTcgIds = [...new Set([...haveArr, ...wantArr])];
    const cardMap = new Map<string, string>();

    // Upsert TCGdex en parallèle AVANT la transaction DB pour ne pas tenir
    // une transaction ouverte pendant les appels réseau externes.
    await Promise.all(
      allTcgIds.map(async (tcgId) => {
        const card = await upsertCardFromTCGdex(tcgId);
        cardMap.set(tcgId, card.id);
      })
    );

    const offer = await db.tradeOffer.create({
      data: {
        userId: session.user.id,
        status: "open",
        items: {
          create: [
            ...haveArr.map((tcgId) => ({ cardId: cardMap.get(tcgId)!, direction: "have" })),
            ...wantArr.map((tcgId) => ({ cardId: cardMap.get(tcgId)!, direction: "want" })),
          ],
        },
      },
    });

    // Matching asynchrone (ne bloque pas la réponse)
    const matchCount = await findAndSaveMatches(offer.id);

    return NextResponse.json({ success: true, offerId: offer.id, matchCount });
  } catch (error) {
    console.error("Trade creation error:", error);
    return NextResponse.json(
      { error: "Échec création de l'offre" },
      { status: 500 }
    );
  }
}
