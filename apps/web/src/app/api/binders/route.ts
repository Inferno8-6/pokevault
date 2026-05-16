import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { BINDER_LAYOUTS, LIMITS, isOneOf, type BinderLayout } from "@pokemon/shared";
import { getUserLimits } from "@/lib/premium";

const MAX_BINDERS_PER_USER = 50;
const DEFAULT_COVER_COLOR = "#f59e0b";

function slotsPerPage(layout: string): number {
  const [c, r] = layout.split("x").map(Number);
  return (c || 3) * (r || 3);
}

// GET /api/binders — liste des classeurs de l'utilisateur
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const binders = await db.binder.findMany({
    where: { userId: session.user.id },
    include: {
      slots: {
        where: { cardId: { not: null } },
        take: 1,
        orderBy: { position: "asc" },
        include: { card: { select: { imageSmall: true } } },
      },
      _count: { select: { slots: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = binders.map((b) => {
    const filled = b._count.slots; // total slots créés (vides ou non) — placeholder
    const previewImage = b.coverImage ?? b.slots[0]?.card?.imageSmall ?? null;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      layout: b.layout,
      isPublic: b.isPublic,
      coverColor: b.coverColor,
      coverImage: previewImage,
      filledCount: filled,
      slotsPerPage: slotsPerPage(b.layout),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });

  return NextResponse.json({ binders: result });
}

// POST /api/binders — créer un classeur
// Body : { name, description?, layout?, isPublic?, coverColor? }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const name: string = String(body.name ?? "").trim();
  if (!name)
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (name.length > LIMITS.nameLength)
    return NextResponse.json({ error: `Nom trop long (max ${LIMITS.nameLength})` }, { status: 400 });

  const layout: BinderLayout = isOneOf(body.layout, BINDER_LAYOUTS) ? body.layout : "3x3";
  const isPublic = Boolean(body.isPublic);
  const coverColor: string = String(body.coverColor ?? DEFAULT_COVER_COLOR).trim().slice(0, 16);
  const description: string | null = body.description
    ? String(body.description).slice(0, LIMITS.noteLength)
    : null;

  const { isPremium, limits } = await getUserLimits();
  const count = await db.binder.count({ where: { userId: session.user.id } });
  const max = isPremium ? MAX_BINDERS_PER_USER : limits.maxBinders;
  if (count >= max)
    return NextResponse.json(
      {
        error: isPremium
          ? `Limite atteinte (${MAX_BINDERS_PER_USER} classeurs max)`
          : `Limite de ${limits.maxBinders} classeurs en gratuit. Passez en Premium pour en créer plus.`,
        premium: !isPremium,
      },
      { status: isPremium ? 400 : 403 },
    );

  const binder = await db.binder.create({
    data: {
      userId: session.user.id,
      name,
      description,
      layout,
      isPublic,
      coverColor,
    },
  });

  return NextResponse.json({ success: true, id: binder.id });
}
