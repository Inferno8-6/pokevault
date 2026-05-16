import { NextResponse } from "next/server";
import { getSets, type TCGdexLanguage } from "@/lib/tcgdex";
import { refreshSetMetaBatch } from "@/lib/set-meta";

/**
 * GET /api/cron/set-meta — rafraîchit le cache `SetMeta` pour les trois langues.
 *
 * Idéal à programmer quotidiennement via Vercel Cron ou cron-job.org. Coûte
 * ~500 appels TCGdex (172 sets × 3 langues, batched) → ~2 min d'exécution.
 *
 * Sécurité : si CRON_SECRET est défini, exige `Authorization: Bearer <secret>`.
 *            En production sans secret configuré → blocage par défaut.
 */
const LANGUAGES: readonly TCGdexLanguage[] = ["fr", "en", "ja"] as const;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  } else if (isProd) {
    console.error("[Cron set-meta] CRON_SECRET non configuré en production !");
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const results: Record<string, { checked: number; withCards: number; empty: number; errors: number }> = {};

  for (const lang of LANGUAGES) {
    try {
      const sets = await getSets(lang);
      const codes = sets.map((s) => s.id);
      results[lang] = await refreshSetMetaBatch(codes, lang);
    } catch (err) {
      console.error(`[Cron set-meta] Échec pour ${lang}`, err);
      results[lang] = { checked: 0, withCards: 0, empty: 0, errors: 1 };
    }
  }

  return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
}
