import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

// ─── GET /api/reputation?userId=xxx ──────────────────────────────────────────
// Accessible publiquement si la cible a `publicProfile = true`.
// Sinon, seul l'utilisateur concerné (ou un user authentifié) peut voir ses propres reviews.
// Limité aux 100 avis les plus récents pour éviter une fuite de données massive.

const REPUTATION_LIST_LIMIT = 100;

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "userId requis" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const isSelf = session?.user?.id === userId;

  // Vérifie l'existence + visibilité avant toute requête lourde
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { publicProfile: true },
  });
  if (!target)
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (!isSelf && !target.publicProfile)
    return NextResponse.json({ error: "Profil privé" }, { status: 403 });

  const reviews = await db.reputation.findMany({
    where: { userId },
    include: {
      reviewer: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
    take: REPUTATION_LIST_LIMIT,
  });

  const avgScore =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length
      : 0;

  return NextResponse.json({ reviews, avgScore, count: reviews.length });
}

// ─── POST /api/reputation — laisser un avis ──────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const { userId, score, comment } = body as {
    userId: string;
    score: number;
    comment?: string;
  };

  // Validation stricte : entier entre 1 et 5
  if (
    !userId ||
    score == null ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > 5
  ) {
    return NextResponse.json(
      { error: "Score invalide (entier entre 1 et 5 requis)" },
      { status: 400 }
    );
  }

  if (userId === session.user.id)
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous noter vous-même" },
      { status: 400 }
    );

  // Validation commentaire (facultatif, max 500 caractères)
  if (comment && comment.length > 500) {
    return NextResponse.json(
      { error: "Commentaire trop long (max 500 caractères)" },
      { status: 400 }
    );
  }

  // Vérification que l'utilisateur noté existe
  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser)
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Upsert : un seul avis par paire reviewer→user
  const rep = await db.reputation.upsert({
    where: {
      userId_reviewerId: {
        userId,
        reviewerId: session.user.id,
      },
    },
    create: {
      userId,
      reviewerId: session.user.id,
      score,
      comment: comment?.trim() ?? null,
    },
    update: {
      score,
      comment: comment?.trim() ?? null,
    },
  });

  return NextResponse.json({ success: true, reputation: rep });
}
