import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { upsertCardFromTCGdex } from "@/lib/card-upsert";
import { getUserLimits } from "@/lib/premium";
import type { TCGdexLanguage } from "@/lib/tcgdex";

const SUPPORTED_LANGS: readonly TCGdexLanguage[] = ["fr", "en", "ja"] as const;

// POST /api/portfolio/bulk — ajouter plusieurs cartes d'un coup
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const {
    tcgIds,
    condition = "near_mint",
    variant = "normal",
    quantity = 1,
    lang = "fr",
  } = body as {
    tcgIds: string[];
    condition?: string;
    variant?: string;
    quantity?: number;
    lang?: string;
  };

  const resolvedLang: TCGdexLanguage = SUPPORTED_LANGS.includes(lang as TCGdexLanguage)
    ? (lang as TCGdexLanguage)
    : "fr";

  if (!Array.isArray(tcgIds) || tcgIds.length === 0)
    return NextResponse.json({ error: "tcgIds requis" }, { status: 400 });

  if (tcgIds.length > 500)
    return NextResponse.json(
      { error: "Maximum 500 cartes par import" },
      { status: 400 }
    );

  const { limits } = await getUserLimits();
  if (limits.maxCards !== Infinity) {
    const currentCount = await db.collection.aggregate({
      where: { userId: session.user.id },
      _sum: { quantity: true },
    });
    const total = (currentCount._sum.quantity ?? 0) + tcgIds.length * quantity;
    if (total > limits.maxCards) {
      return NextResponse.json(
        { error: `Limite de ${limits.maxCards} cartes atteinte. Passez en Premium pour un ajout illimité.`, premium: true },
        { status: 403 },
      );
    }
  }

  let added = 0;
  let updated = 0;
  let errors = 0;

  // Traitement en lots de 10 pour ne pas surcharger l'API
  const BATCH = 10;
  for (let i = 0; i < tcgIds.length; i += BATCH) {
    const batch = tcgIds.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (tcgId) => {
        try {
          const card = await upsertCardFromTCGdex(tcgId, resolvedLang);

          const existing = await db.collection.findUnique({
            where: {
              userId_cardId_condition_variant: {
                userId: session.user.id,
                cardId: card.id,
                condition,
                variant,
              },
            },
          });

          if (existing) {
            await db.collection.update({
              where: { id: existing.id },
              data: { quantity: { increment: quantity } },
            });
            updated++;
          } else {
            await db.collection.create({
              data: {
                userId: session.user.id,
                cardId: card.id,
                quantity,
                condition,
                variant,
              },
            });
            added++;
          }
        } catch (err) {
          console.error(`[BulkImport] Error for ${tcgId}:`, err);
          errors++;
        }
      })
    );

    // Pause légère entre les lots pour respecter le rate limit TCGdex
    if (i + BATCH < tcgIds.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return NextResponse.json({
    success: true,
    added,
    updated,
    errors,
    total: added + updated,
  });
}
