import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

// GET /api/profile/me — mon profil + paramètres
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      image: true,
      email: true,
      createdAt: true,
      publicProfile: true,
      emailNotifications: true,
      discordId: true,
      reviewsReceived: {
        select: { score: true, comment: true, createdAt: true, reviewer: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      tradeOffers: { where: { status: "completed" }, select: { id: true } },
      collections: { select: { quantity: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const totalCards = user.collections.reduce((s, c) => s + c.quantity, 0);
  const tradesCompleted = user.tradeOffers.length;
  const reviews = user.reviewsReceived;
  const avgScore = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
    : null;

  return NextResponse.json({
    ...user,
    totalCards,
    tradesCompleted,
    avgScore,
    reviewCount: reviews.length,
    // Alias pour cohérence avec le client qui attend `reviews`.
    reviews,
  });
}

// PATCH /api/profile/me — mettre à jour les paramètres
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const { publicProfile, emailNotifications } = body;

  const data: { publicProfile?: boolean; emailNotifications?: boolean } = {};
  if (typeof publicProfile === "boolean") data.publicProfile = publicProfile;
  if (typeof emailNotifications === "boolean") data.emailNotifications = emailNotifications;

  const updated = await db.user.update({
    where: { id: session.user.id },
    data,
    select: { publicProfile: true, emailNotifications: true },
  });

  return NextResponse.json({ success: true, ...updated });
}
