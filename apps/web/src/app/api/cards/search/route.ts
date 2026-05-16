import { NextRequest, NextResponse } from "next/server";
import { englishToFrench, frenchToEnglish } from "@pokemon/tcg-api";
import {
  searchFrenchCards,
  getFullCard,
  normalizeFullCard,
  type TCGdexListCard,
} from "@/lib/tcgdex";

/**
 * Sets à exclure : cartes du jeu mobile Pokémon TCG Pocket (pas des cartes physiques TCG)
 * Patterns : a1, a1a, a2, a2a, a2b, pa, p-a, promo-a
 */
function isPocketGameSet(setId: string): boolean {
  const s = setId.toLowerCase();
  return (
    /^a\d/.test(s) || // a1, a1a, a2, a2a, a2b...
    s === "pa" ||
    s === "p-a" ||
    s.startsWith("promo-a")
  );
}

function getSetId(cardId: string): string {
  return cardId.slice(0, cardId.lastIndexOf("-"));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const page = Number(request.nextUrl.searchParams.get("page") || "1");
  const pageSize = Math.min(
    Number(request.nextUrl.searchParams.get("pageSize") || "50"),
    250
  );

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const trimmed = query.trim();
  // Si l'utilisateur tape un nom anglais → traduit en FR pour l'API TCGdex
  const frName = englishToFrench(trimmed) ?? trimmed;

  try {
    // 1. Récupérer la liste des cartes françaises depuis TCGdex
    let cards: TCGdexListCard[] = await searchFrenchCards(frName);

    // 2ème tentative si traduction différente et 0 résultat
    if (cards.length === 0 && frName !== trimmed) {
      cards = await searchFrenchCards(trimmed);
    }

    // 3ème tentative : FR sans accents → EN → FR avec accents
    // ex: "salameche" → frenchToEnglish → "Charmander" → englishToFrench → "Salamèche"
    if (cards.length === 0) {
      const enName = frenchToEnglish(trimmed);
      if (enName) {
        const frAccented = englishToFrench(enName);
        if (frAccented && frAccented !== frName && frAccented !== trimmed) {
          cards = await searchFrenchCards(frAccented);
        }
      }
    }

    // 2. Filtrer les cartes Pocket Game (pas des cartes TCG physiques)
    const physicalCards = cards.filter(
      (c) => !isPocketGameSet(getSetId(c.id))
    );

    // 3. Paginer
    const totalCount = physicalCards.length;
    const start = (page - 1) * pageSize;
    const pageCards = physicalCards.slice(start, start + pageSize);

    // 4. Récupérer les détails complets en parallèle (pour avoir les vraies URLs d'image)
    //    Limite à 20 requêtes simultanées pour ne pas surcharger l'API
    const CHUNK = 20;
    const normalized = [];

    for (let i = 0; i < pageCards.length; i += CHUNK) {
      const chunk = pageCards.slice(i, i + CHUNK);
      const details = await Promise.all(
        chunk.map((c) =>
          getFullCard(c.id)
            .then((full) => (full ? normalizeFullCard(full) : null))
            .catch(() => null)
        )
      );
      normalized.push(...details.filter(Boolean));
    }

    return NextResponse.json({
      data: normalized,
      page,
      pageSize,
      count: normalized.length,
      totalCount,
    });
  } catch (error) {
    console.error("TCGdex search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
