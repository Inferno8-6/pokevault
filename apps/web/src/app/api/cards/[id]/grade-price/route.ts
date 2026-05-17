import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";
import { processCard, getLatestPrice } from "@/lib/price-engine";
import { estimatePsaPrice, getPsaMultiplier } from "@/lib/psa-pricing";

/**
 * GET /api/cards/[id]/grade-price?grade=N
 *
 * Returns the raw market price for a card plus the estimated PSA-graded
 * price at the requested grade (1-10). Accepts either a Card.id (cuid) or
 * a tcgId (TCGdex slug like "swsh4-25"). Will upsert the card and fetch
 * its current price on the fly if missing from DB.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const gradeParam = request.nextUrl.searchParams.get("grade");
  const grade = gradeParam ? parseFloat(gradeParam) : NaN;
  if (!Number.isFinite(grade) || grade < 1 || grade > 10)
    return NextResponse.json({ error: "Paramètre grade invalide (1-10)" }, { status: 400 });

  // Resolve to a Card row (upsert from TCGdex if needed)
  let card = await db.card.findFirst({
    where: { OR: [{ id }, { tcgId: id }] },
    select: { id: true, tcgId: true, name: true, language: true, priceUnavailable: true },
  });

  if (!card) {
    try {
      const upserted = await upsertCardFromTCGdex(id, "fr");
      card = {
        id: upserted.id,
        tcgId: upserted.tcgId,
        name: upserted.name,
        language: upserted.language,
        priceUnavailable: upserted.priceUnavailable,
      };
    } catch {
      return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    }
  }

  // Try DB price first
  let latest = await getLatestPrice(card.id);

  // If no price in DB and not marked unavailable, fetch live (one-shot)
  if (!latest && !card.priceUnavailable) {
    try {
      await processCard(card.id);
      latest = await getLatestPrice(card.id);
    } catch {
      // ignore — we'll just report no price
    }
  }

  if (!latest) {
    return NextResponse.json({
      hasPrice: false,
      grade,
      multiplier: getPsaMultiplier(grade),
      message: "Prix marché indisponible pour cette carte",
    });
  }

  const rawPrice = latest.price;
  const gradedPrice = estimatePsaPrice(rawPrice, grade);
  const multiplier = getPsaMultiplier(grade);

  return NextResponse.json({
    hasPrice: true,
    rawPrice,
    gradedPrice,
    grade,
    multiplier,
    currency: latest.currency ?? "EUR",
    source: latest.source,
  });
}
