import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

// GET /api/trades/history — historique des trades complétés/annulés de l'utilisateur
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const offers = await db.tradeOffer.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["completed", "cancelled"] },
    },
    include: {
      items: {
        include: {
          card: { select: { name: true, setName: true, number: true, imageSmall: true } },
        },
      },
      matchesA: {
        include: {
          offerB: {
            include: {
              user: { select: { id: true, name: true, image: true } },
              items: {
                include: {
                  card: { select: { name: true, setName: true, number: true, imageSmall: true } },
                },
              },
            },
          },
        },
      },
      matchesB: {
        include: {
          offerA: {
            include: {
              user: { select: { id: true, name: true, image: true } },
              items: {
                include: {
                  card: { select: { name: true, setName: true, number: true, imageSmall: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const result = offers.map((offer) => {
    const matches = [
      ...offer.matchesA.map((m) => ({ partner: m.offerB.user, partnerItems: m.offerB.items, matchedAt: m.matchedAt })),
      ...offer.matchesB.map((m) => ({ partner: m.offerA.user, partnerItems: m.offerA.items, matchedAt: m.matchedAt })),
    ];

    return {
      id: offer.id,
      status: offer.status,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      myItems: offer.items,
      matches,
    };
  });

  return NextResponse.json({ history: result });
}
