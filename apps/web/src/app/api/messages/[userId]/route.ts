import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

// ─── GET /api/messages/[userId] — conversation complète ──────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { userId: partnerId } = await params;
  const myId = session.user.id;

  // Récupère la conversation + marque les messages comme lus
  const [messages] = await Promise.all([
    db.message.findMany({
      where: {
        OR: [
          { fromUserId: myId, toUserId: partnerId },
          { fromUserId: partnerId, toUserId: myId },
        ],
      },
      include: {
        from: { select: { id: true, name: true, image: true } },
        tradeOffer: {
          select: {
            id: true,
            status: true,
            items: {
              take: 4,
              where: { direction: "have" },
              include: {
                card: { select: { name: true, imageSmall: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Marque comme lus les messages reçus
    db.message.updateMany({
      where: { fromUserId: partnerId, toUserId: myId, read: false },
      data: { read: true },
    }),
  ]);

  // Infos du partenaire
  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      name: true,
      image: true,
      reviewsReceived: { select: { score: true } },
    },
  });

  const avgRep =
    partner && partner.reviewsReceived.length > 0
      ? partner.reviewsReceived.reduce((s, r) => s + r.score, 0) /
        partner.reviewsReceived.length
      : null;

  return NextResponse.json({
    messages,
    partner: partner
      ? {
          ...partner,
          reputation: avgRep,
          reviewCount: partner.reviewsReceived.length,
        }
      : null,
  });
}
