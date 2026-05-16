import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { LIMITS } from "@pokemon/shared";

/**
 * POST /api/cards/[id]/price — saisie manuelle d'un prix sur une carte.
 *
 * Utilisé pour les cartes sans cotation automatique (JP, promos rares, sets
 * obscurs). N'importe quel utilisateur authentifié peut contribuer une valeur
 * marché — pas de propriétaire individuel sur le prix, c'est une donnée publique.
 *
 * Le prix saisi entre dans PriceHistory avec source="manual" pour le distinguer
 * des prix automatiques Cardmarket / pokemontcg.io.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // id peut être soit un Card.id (cuid) soit un tcgId (string TCGdex).
  // On accepte les deux pour simplicité côté client.
  const card = await db.card.findFirst({
    where: { OR: [{ id }, { tcgId: id }] },
    select: { id: true },
  });
  if (!card) return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });

  const body = await request.json();
  const raw = body?.price;
  const price = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(price) || price <= 0 || price > LIMITS.maxPriceEur) {
    return NextResponse.json(
      { error: `Prix invalide (1 - ${LIMITS.maxPriceEur} €)` },
      { status: 400 }
    );
  }

  const rounded = Math.round(price * 100) / 100;
  const currency = body?.currency === "USD" ? "USD" : "EUR";

  // On retire le flag priceUnavailable pour que le cron n'écrase pas la donnée
  // saisie manuellement par un retry "indisponible" futur.
  await db.$transaction([
    db.priceHistory.create({
      data: { cardId: card.id, source: "manual", price: rounded, currency },
    }),
    db.card.update({
      where: { id: card.id },
      data: { lastPriceCheckAt: new Date(), priceUnavailable: false },
    }),
  ]);

  return NextResponse.json({ success: true, price: rounded, currency });
}
