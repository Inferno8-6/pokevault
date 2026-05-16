import { NextRequest, NextResponse } from "next/server";
import {
  getSetWithCards,
  normalizeListCard,
  isPocketGameSet,
  type TCGdexLanguage,
} from "@/lib/tcgdex";
import { db } from "@pokemon/db";

const SUPPORTED_LANGS: readonly TCGdexLanguage[] = ["fr", "en", "ja"] as const;

function parseLang(raw: string | null): TCGdexLanguage {
  return SUPPORTED_LANGS.includes(raw as TCGdexLanguage) ? (raw as TCGdexLanguage) : "fr";
}

// GET /api/sets/[id]?lang=fr|en|ja — retourne toutes les cartes d'une collection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lang = parseLang(request.nextUrl.searchParams.get("lang"));

  if (isPocketGameSet(id)) {
    return NextResponse.json(
      { error: "Pocket Game sets non supportés" },
      { status: 400 }
    );
  }

  try {
    const set = await getSetWithCards(id, lang);
    if (!set) {
      return NextResponse.json({ error: "Série non trouvée" }, { status: 404 });
    }

    const cards = (set.cards ?? []).map((card) =>
      normalizeListCard(card, set.id, set.name, lang)
    );

    // Update lazy de SetMeta : on profite du fetch détail pour caler le statut.
    // Non-bloquant — si ça échoue, on n'empêche pas la réponse.
    db.setMeta
      .upsert({
        where: { setCode_language: { setCode: set.id, language: lang } },
        create: {
          setCode: set.id,
          language: lang,
          hasCards: cards.length > 0,
          cardCount: cards.length,
        },
        update: {
          hasCards: cards.length > 0,
          cardCount: cards.length,
          lastCheckedAt: new Date(),
        },
      })
      .catch((err) =>
        console.warn("[Sets] SetMeta upsert failed", set.id, lang, err)
      );

    // Collecte les raretés uniques pour les filtres
    const rarities = [
      ...new Set(
        cards
          .map((c) => c.rarity)
          .filter((r): r is string => r != null && r !== "")
      ),
    ].sort();

    return NextResponse.json({
      set: {
        id: set.id,
        name: set.name,
        cardCount: set.cardCount,
        releaseDate: set.releaseDate,
        serie: set.serie,
      },
      lang,
      cards,
      rarities,
    });
  } catch (error) {
    console.error("Set cards fetch error:", error);
    return NextResponse.json(
      { error: "Échec chargement de la série" },
      { status: 500 }
    );
  }
}
