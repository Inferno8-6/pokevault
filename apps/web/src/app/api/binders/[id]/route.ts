import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { BINDER_LAYOUTS, LIMITS, isOneOf } from "@pokemon/shared";

function slotsPerPage(layout: string): number {
  const [c, r] = layout.split("x").map(Number);
  return (c || 3) * (r || 3);
}

// GET /api/binders/[id] — détail d'un classeur + tous ses slots avec cartes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const binder = await db.binder.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      slots: {
        orderBy: { position: "asc" },
        include: {
          card: {
            include: { prices: { orderBy: { fetchedAt: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  if (!binder) return NextResponse.json({ error: "Classeur introuvable" }, { status: 404 });

  // Accès : propriétaire OU public
  const isOwner = session?.user?.id === binder.userId;
  if (!isOwner && !binder.isPublic)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const sp = slotsPerPage(binder.layout);
  const slots = binder.slots.map((s) => ({
    id: s.id,
    position: s.position,
    pageIndex: Math.floor(s.position / sp),
    slotIndex: s.position % sp,
    condition: s.condition,
    card: s.card
      ? {
          id: s.card.id,
          tcgId: s.card.tcgId,
          name: s.card.name,
          setName: s.card.setName,
          number: s.card.number,
          imageSmall: s.card.imageSmall,
          rarity: s.card.rarity,
          currentPrice: s.card.prices[0]?.price ?? null,
        }
      : null,
  }));

  const totalSlots = binder.slots.length;
  const totalPages = Math.max(1, Math.ceil(totalSlots / sp));
  const value = binder.slots.reduce(
    (sum, s) => sum + (s.card?.prices[0]?.price ?? 0),
    0
  );

  return NextResponse.json({
    binder: {
      id: binder.id,
      name: binder.name,
      description: binder.description,
      layout: binder.layout,
      isPublic: binder.isPublic,
      coverColor: binder.coverColor,
      coverImage: binder.coverImage,
      slotsPerPage: sp,
      totalSlots,
      totalPages,
      value,
      owner: binder.user,
      isOwner,
      createdAt: binder.createdAt,
      updatedAt: binder.updatedAt,
    },
    slots,
  });
}

// PATCH /api/binders/[id] — éditer métadonnées du classeur
// Body : { name?, description?, layout?, isPublic?, coverColor?, coverImage? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const binder = await db.binder.findUnique({ where: { id } });
  if (!binder || binder.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const body = await request.json();
  const data: {
    name?: string;
    description?: string | null;
    layout?: string;
    isPublic?: boolean;
    coverColor?: string;
    coverImage?: string | null;
  } = {};

  if (body.name != null) {
    const n = String(body.name).trim();
    if (!n) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    if (n.length > LIMITS.nameLength)
      return NextResponse.json({ error: "Nom trop long" }, { status: 400 });
    data.name = n;
  }
  if (body.description !== undefined)
    data.description = body.description ? String(body.description).slice(0, LIMITS.noteLength) : null;
  if (body.layout != null) {
    if (!isOneOf(body.layout, BINDER_LAYOUTS))
      return NextResponse.json({ error: "Layout invalide" }, { status: 400 });
    data.layout = body.layout;
  }
  if (body.isPublic != null) data.isPublic = Boolean(body.isPublic);
  if (body.coverColor != null) data.coverColor = String(body.coverColor).slice(0, 16);
  if (body.coverImage !== undefined) data.coverImage = body.coverImage || null;

  const updated = await db.binder.update({ where: { id }, data });
  return NextResponse.json({ success: true, id: updated.id });
}

// DELETE /api/binders/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const binder = await db.binder.findUnique({ where: { id } });
  if (!binder || binder.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await db.binder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
