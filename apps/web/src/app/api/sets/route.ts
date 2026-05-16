import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { getSets, type TCGdexLanguage } from "@/lib/tcgdex";
import { getSetMetaMap } from "@/lib/set-meta";

const SUPPORTED_LANGS: readonly TCGdexLanguage[] = ["fr", "en", "ja"] as const;

function parseLang(raw: string | null): TCGdexLanguage {
  return SUPPORTED_LANGS.includes(raw as TCGdexLanguage) ? (raw as TCGdexLanguage) : "fr";
}

/**
 * GET /api/sets?lang=fr|en|ja&includeEmpty=1
 *
 * Liste les séries TCGdex pour la langue demandée, annotées avec :
 *  - progression (cartes possédées par l'utilisateur),
 *  - statut TCGdex (`hasCards` depuis SetMeta : false = pas de visuels scannés).
 *
 * Par défaut on **filtre** les sets connus comme vides (SetMeta.hasCards=false)
 * pour ne pas faire perdre de temps à l'utilisateur. `includeEmpty=1` désactive
 * ce filtre — utile pour les complétistes qui veulent saisir manuellement.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const lang = parseLang(request.nextUrl.searchParams.get("lang"));
    const includeEmpty = request.nextUrl.searchParams.get("includeEmpty") === "1";

    const [sets, ownedCards] = await Promise.all([
      getSets(lang),
      session?.user?.id
        ? db.collection.findMany({
            where: { userId: session.user.id, card: { language: lang } },
            select: { card: { select: { setCode: true } } },
          })
        : Promise.resolve([]),
    ]);

    // Statut de couverture TCGdex pour chaque set (depuis le cache SetMeta)
    const setCodes = sets.map((s) => s.id);
    const metaMap = await getSetMetaMap(setCodes, lang);

    // Compter les cartes possédées par setCode
    const ownedBySet = new Map<string, number>();
    for (const item of ownedCards) {
      const code = item.card.setCode;
      ownedBySet.set(code, (ownedBySet.get(code) ?? 0) + 1);
    }

    // Liste plate avec progression + statut TCGdex
    const annotated = sets.map((set) => {
      const meta = metaMap.get(set.id);
      return {
        ...set,
        owned: ownedBySet.get(set.id) ?? 0,
        total: set.cardCount?.official ?? set.cardCount?.total ?? 0,
        /** `null` = jamais probé, on l'affiche par défaut.
         *  `true` = TCGdex a des cartes. `false` = liste vide → masqué sauf includeEmpty. */
        hasCards: meta?.hasCards ?? null,
        scannedCardCount: meta?.cardCount ?? null,
      };
    });

    const setsWithProgress = includeEmpty
      ? annotated
      : annotated.filter((s) => s.hasCards !== false);

    // Groupement par série (sur la liste filtrée)
    const grouped = new Map<string, { id: string; name: string; sets: typeof setsWithProgress }>();
    for (const set of setsWithProgress) {
      const serieId = set.serie?.id ?? "other";
      const serieName = set.serie?.name ?? "Autres";
      if (!grouped.has(serieId)) grouped.set(serieId, { id: serieId, name: serieName, sets: [] });
      grouped.get(serieId)!.sets.push(set);
    }
    const series = Array.from(grouped.values()).reverse();

    return NextResponse.json({
      sets: setsWithProgress,
      series,
      lang,
      totalAvailable: annotated.length,
      hiddenEmpty: includeEmpty ? 0 : annotated.length - setsWithProgress.length,
    });
  } catch (error) {
    console.error("Sets fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }
}
