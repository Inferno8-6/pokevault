/**
 * Gestion du cache `SetMeta` — indique si TCGdex a scanné les cartes
 * d'un set donné pour une langue donnée.
 *
 * Permet de filtrer la liste des sets côté UI sans payer un appel détail
 * par set à chaque visite. Le cache est rafraîchi par un cron, et peut
 * aussi être mis à jour de façon lazy quand un user visite la page détail.
 */
import { db } from "@pokemon/db";
import { getSetWithCards, type TCGdexLanguage } from "@/lib/tcgdex";

/**
 * Durée de validité d'une entrée SetMeta avant refresh forcé.
 * TCGdex met à jour ses scans assez rarement → 7 jours suffisent.
 */
const META_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Pause entre lots d'appels TCGdex pour respecter le rate limit. */
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 600;

/**
 * Vérifie le statut d'un set précis et met à jour SetMeta.
 *
 * Retourne :
 *  - `true`  : TCGdex a répondu avec ≥1 carte scannée (cache mis à jour)
 *  - `false` : TCGdex a répondu mais `cards: []` (cache mis à jour, set vide)
 *  - `null`  : TCGdex injoignable / 404 → AUCUNE écriture cache (évite de polluer
 *              le cache avec des faux négatifs lors d'un blip réseau).
 *
 * Cette distinction est CRITIQUE : sans elle, un timeout sur les 172 sets JP
 * marquerait tout le catalogue comme vide d'un coup.
 */
export async function probeSet(setCode: string, language: TCGdexLanguage): Promise<boolean | null> {
  const existing = await db.setMeta.findUnique({
    where: { setCode_language: { setCode, language } },
  });

  // Cache encore valide → on évite l'appel réseau
  if (existing && Date.now() - existing.lastCheckedAt.getTime() < META_TTL_MS) {
    return existing.hasCards;
  }

  // Laisse remonter les exceptions réseau jusqu'à l'appelant.
  // Distingue ainsi 404/null (refuser d'écrire) de "succès avec cards=[]" (écrire false).
  let set;
  try {
    set = await getSetWithCards(setCode, language);
  } catch {
    return null; // erreur réseau / fetch failed → ne touche pas au cache
  }

  if (set === null) return null; // 404/5xx côté TCGdex → ne touche pas au cache

  const cardCount = set.cards?.length ?? 0;
  const hasCards = cardCount > 0;

  await db.setMeta.upsert({
    where: { setCode_language: { setCode, language } },
    create: { setCode, language, hasCards, cardCount, lastCheckedAt: new Date() },
    update: { hasCards, cardCount, lastCheckedAt: new Date() },
  });

  return hasCards;
}

/**
 * Rafraîchit en batch la couverture d'une liste de sets.
 * Utilisé par le cron `/api/cron/set-meta` pour pré-calculer le statut
 * de tous les sets d'une langue.
 *
 * Limite le parallélisme pour ne pas marteler TCGdex (rate limit non documenté).
 */
export async function refreshSetMetaBatch(
  setCodes: string[],
  language: TCGdexLanguage,
): Promise<{ checked: number; withCards: number; empty: number; errors: number }> {
  let checked = 0;
  let withCards = 0;
  let empty = 0;
  let errors = 0;

  for (let i = 0; i < setCodes.length; i += BATCH_SIZE) {
    const batch = setCodes.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (setCode) => {
        try {
          const has = await probeSet(setCode, language);
          if (has === null) {
            errors++; // TCGdex injoignable, cache non modifié
          } else {
            checked++;
            if (has) withCards++;
            else empty++;
          }
        } catch (err) {
          console.error(`[SetMeta] probeSet failed ${setCode}/${language}`, err);
          errors++;
        }
      }),
    );
    if (i + BATCH_SIZE < setCodes.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  return { checked, withCards, empty, errors };
}

/**
 * Charge en bloc le statut d'une liste de sets pour une langue donnée.
 * Utilisé par GET /api/sets pour annoter chaque set avec `hasCards`
 * sans faire N requêtes Prisma.
 *
 * Les sets sans entrée SetMeta sont considérés "inconnus" et retournés
 * comme `null` — l'appelant décide quoi faire (par défaut on les affiche
 * pour ne pas masquer du contenu pas encore probé).
 */
export async function getSetMetaMap(
  setCodes: string[],
  language: TCGdexLanguage,
): Promise<Map<string, { hasCards: boolean; cardCount: number; lastCheckedAt: Date }>> {
  try {
    const rows = await db.setMeta.findMany({
      where: { language, setCode: { in: setCodes } },
      select: { setCode: true, hasCards: true, cardCount: true, lastCheckedAt: true },
    });
    return new Map(
      rows.map((r) => [r.setCode, { hasCards: r.hasCards, cardCount: r.cardCount, lastCheckedAt: r.lastCheckedAt }]),
    );
  } catch (err) {
    // Si le client Prisma n'a pas le modèle SetMeta (regen manquante), on
    // retourne une map vide → tous les sets restent visibles (`hasCards=null`).
    // Évite d'avoir un /sets qui crash à 500 sur un détail de cache.
    console.warn("[SetMeta] getSetMetaMap fallback (client non régénéré ?)", err);
    return new Map();
  }
}
