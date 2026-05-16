import { NextRequest, NextResponse } from "next/server";
import { db } from "@pokemon/db";

// GET /api/profile/[userId] — profil public d'un utilisateur
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
      publicProfile: true,
      reviewsReceived: {
        select: { score: true, comment: true, createdAt: true, reviewer: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      tradeOffers: {
        where: { status: "completed" },
        select: { id: true },
      },
      collections: {
        select: { quantity: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  if (!user.publicProfile) return NextResponse.json({ error: "Profil privé" }, { status: 403 });

  const totalCards = user.collections.reduce((s, c) => s + c.quantity, 0);
  const tradesCompleted = user.tradeOffers.length;
  const reviews = user.reviewsReceived;
  const avgScore = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
    : null;

  return NextResponse.json({
    id: user.id,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt,
    totalCards,
    tradesCompleted,
    avgScore,
    reviewCount: reviews.length,
    reviews,
  });
}
