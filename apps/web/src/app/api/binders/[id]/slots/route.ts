import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";
import { CARD_CONDITIONS, isOneOf } from "@pokemon/shared";

// Un classeur 4x4 fait 16 slots/page → 200 pages × 16 = 3200 positions max.
// Largement suffisant pour les usages humains, évite les positions farfelues.
const MAX_BINDER_POSITION = 3200;

// PUT /api/binders/[id]/slots — place ou retire une carte à une position
// Body : { position: number, tcgId?: string | null, condition?: string | null }
// - tcgId fourni → ajoute/remplace la carte
// - tcgId null/absent → vide le slot (mais garde l'emplacement)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: binderId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const binder = await db.binder.findUnique({ where: { id: binderId } });
  if (!binder || binder.userId !== session.user.id)
    return NextResponse.json({ error: "Classeur non trouvé" }, { status: 404 });

  const body = await request.json();
  const position = Number(body.position);
  if (!Number.isInteger(position) || position < 0 || position > MAX_BINDER_POSITION)
    return NextResponse.json({ error: "Position invalide" }, { status: 400 });

  // Vider un slot
  if (!body.tcgId) {
    await db.binderSlot.deleteMany({
      where: { binderId, position },
    });
    return NextResponse.json({ success: true, cleared: true });
  }

  // Ajouter / remplacer
  try {
    const card = await upsertCardFromTCGdex(String(body.tcgId));
    // Condition optionnelle, validée contre la liste partagée (mint/near_mint/...)
    const condition = body.condition && isOneOf(body.condition, CARD_CONDITIONS)
      ? body.condition
      : null;

    const existing = await db.binderSlot.findUnique({
      where: { binderId_position: { binderId, position } },
    });

    let slot;
    if (existing) {
      slot = await db.binderSlot.update({
        where: { id: existing.id },
        data: { cardId: card.id, condition },
      });
    } else {
      slot = await db.binderSlot.create({
        data: { binderId, position, cardId: card.id, condition },
      });
    }

    // Touch updatedAt sur le classeur pour le tri "récent"
    await db.binder.update({ where: { id: binderId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true, id: slot.id });
  } catch (error) {
    console.error("Binder slot PUT error:", error);
    return NextResponse.json({ error: "Échec de l'ajout" }, { status: 500 });
  }
}

// POST /api/binders/[id]/slots — réorganise les slots
// Body : { swaps: Array<{ from: number, to: number }> }  OR  { moves: Array<{ position: number, slotId: string }> }
// Implémentation simple : swap deux positions.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: binderId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const binder = await db.binder.findUnique({ where: { id: binderId } });
  if (!binder || binder.userId !== session.user.id)
    return NextResponse.json({ error: "Classeur non trouvé" }, { status: 404 });

  const body = await request.json();
  const from = Number(body.from);
  const to = Number(body.to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0)
    return NextResponse.json({ error: "Positions invalides" }, { status: 400 });
  if (from === to)
    return NextResponse.json({ success: true });

  // Swap atomique via positions tampons : pos = -1 et -2 (impossibles en réel)
  const slotFrom = await db.binderSlot.findUnique({
    where: { binderId_position: { binderId, position: from } },
  });
  const slotTo = await db.binderSlot.findUnique({
    where: { binderId_position: { binderId, position: to } },
  });

  await db.$transaction(async (tx) => {
    if (slotFrom) await tx.binderSlot.update({ where: { id: slotFrom.id }, data: { position: -1 } });
    if (slotTo) await tx.binderSlot.update({ where: { id: slotTo.id }, data: { position: from } });
    if (slotFrom) await tx.binderSlot.update({ where: { id: slotFrom.id }, data: { position: to } });
  });

  await db.binder.update({ where: { id: binderId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ success: true });
}
