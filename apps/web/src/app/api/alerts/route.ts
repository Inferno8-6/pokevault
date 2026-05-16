import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";
import { getUserLimits } from "@/lib/premium";

// GET /api/alerts — liste des alertes de l'utilisateur
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const alerts = await db.priceAlert.findMany({
    where: { userId: session.user.id },
    include: {
      card: {
        include: {
          prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = alerts.map((a) => ({
    id: a.id,
    cardId: a.card.tcgId,
    cardName: a.card.name,
    setName: a.card.setName,
    number: a.card.number,
    imageSmall: a.card.imageSmall,
    condition: a.condition,   // "above" | "below"
    threshold: a.threshold,
    currency: a.currency,
    active: a.active,
    triggeredAt: a.triggeredAt,
    createdAt: a.createdAt,
    currentPrice: a.card.prices[0]?.price ?? null,
  }));

  return NextResponse.json({ alerts: result });
}

// POST /api/alerts — créer une alerte
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const { tcgId, condition, threshold } = body;

  if (!tcgId || !condition || threshold == null)
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  if (!["above", "below"].includes(condition))
    return NextResponse.json({ error: "Condition invalide" }, { status: 400 });

  const parsedThreshold = parseFloat(threshold);
  if (isNaN(parsedThreshold) || parsedThreshold <= 0)
    return NextResponse.json({ error: "Seuil invalide (doit être > 0)" }, { status: 400 });

  try {
    const { isPremium, limits } = await getUserLimits();
    const alertCount = await db.priceAlert.count({ where: { userId: session.user.id } });
    if (alertCount >= limits.maxAlerts) {
      return NextResponse.json(
        {
          error: isPremium
            ? `Limite de ${limits.maxAlerts} alertes atteinte`
            : "Les alertes de prix sont réservées aux membres Premium.",
          premium: !isPremium,
        },
        { status: isPremium ? 400 : 403 },
      );
    }

    const card = await upsertCardFromTCGdex(tcgId);

    const alert = await db.priceAlert.create({
      data: {
        userId: session.user.id,
        cardId: card.id,
        condition,
        threshold: parsedThreshold,
        currency: "EUR",
        active: true,
      },
    });

    return NextResponse.json({ success: true, alertId: alert.id });
  } catch (error) {
    console.error("Alert creation error:", error);
    return NextResponse.json({ error: "Échec création alerte" }, { status: 500 });
  }
}

// DELETE /api/alerts?id=xxx — supprimer une alerte
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const alert = await db.priceAlert.findUnique({ where: { id } });
  if (!alert || alert.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await db.priceAlert.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// PATCH /api/alerts?id=xxx
// - Sans body        → toggle actif/inactif
// - Avec body JSON   → édition du seuil et/ou de la condition
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const alert = await db.priceAlert.findUnique({ where: { id } });
  if (!alert || alert.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  // Tentative de lecture du body (mode édition)
  let body: { threshold?: number; condition?: string } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch { /* pas de body → mode toggle */ }

  // Mode édition : mise à jour du seuil et/ou de la condition
  if (body.threshold !== undefined || body.condition !== undefined) {
    if (body.condition && !["above", "below"].includes(body.condition))
      return NextResponse.json({ error: "Condition invalide" }, { status: 400 });

    const threshold = body.threshold !== undefined ? Number(body.threshold) : undefined;
    if (threshold !== undefined && (isNaN(threshold) || threshold <= 0))
      return NextResponse.json({ error: "Seuil invalide (doit être > 0)" }, { status: 400 });

    const updated = await db.priceAlert.update({
      where: { id },
      data: {
        ...(threshold !== undefined ? { threshold } : {}),
        ...(body.condition !== undefined ? { condition: body.condition } : {}),
        triggeredAt: null, // Réinitialise le déclenchement
        active: true,       // Réactive si précédemment désactivée
      },
    });
    return NextResponse.json({ success: true, alert: updated });
  }

  // Mode toggle : active ↔ désactive
  const updated = await db.priceAlert.update({
    where: { id },
    data: { active: !alert.active },
  });
  return NextResponse.json({ success: true, active: updated.active });
}
