import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

const VALID_STATUSES = ["open", "completed", "cancelled"] as const;
type TradeStatus = (typeof VALID_STATUSES)[number];

const VALID_TRANSITIONS: Record<string, TradeStatus[]> = {
  open: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// ─── DELETE /api/trades/[id] — annuler une offre ────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const offer = await db.tradeOffer.findUnique({ where: { id } });
  if (!offer || offer.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await db.tradeOffer.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ success: true });
}

// ─── PATCH /api/trades/[id] — changer statut ────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status: string };

  // Validation du statut — seules les valeurs du schéma sont acceptées
  if (!VALID_STATUSES.includes(status as TradeStatus)) {
    return NextResponse.json(
      { error: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const offer = await db.tradeOffer.findUnique({ where: { id } });
  if (!offer || offer.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[offer.status] ?? [];
  if (!allowed.includes(status as TradeStatus)) {
    return NextResponse.json(
      { error: `Transition invalide : ${offer.status} → ${status}` },
      { status: 400 }
    );
  }

  const updated = await db.tradeOffer.update({
    where: { id },
    data: { status: status as TradeStatus },
  });

  return NextResponse.json({ success: true, status: updated.status });
}
