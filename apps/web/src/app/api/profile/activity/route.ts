import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";

/**
 * GET /api/profile/activity?days=365
 *
 * Retourne une heatmap GitHub-style des actions de l'utilisateur sur la
 * période demandée. Une "action" = ajout de carte, création d'offre de trade,
 * complétion d'un trade, ajout de scellé, création de classeur.
 *
 * Format de retour : tableau de cellules `[{ date: "2026-05-16", count: 4 }, ...]`
 * où `date` est ISO YYYY-MM-DD (UTC) et `count` agrège toutes les sources.
 *
 * On retourne **tous les jours de la période**, y compris ceux à 0, pour
 * simplifier le rendu frontend (pas besoin de pré-remplir les trous).
 */

const DEFAULT_DAYS = 365;
const MAX_DAYS = 730;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Convertit une Date en clé "YYYY-MM-DD" basée sur UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = session.user.id;
  const days = Math.min(
    MAX_DAYS,
    Math.max(7, Number(request.nextUrl.searchParams.get("days") ?? DEFAULT_DAYS)),
  );

  const since = new Date(Date.now() - days * MS_PER_DAY);

  // Récupère uniquement les timestamps pertinents (pas besoin du reste).
  // Les trois requêtes sont indépendantes → on parallélise.
  const [collections, tradeOffers, sealedHoldings, binders] = await Promise.all([
    db.collection.findMany({
      where: { userId, addedAt: { gte: since } },
      select: { addedAt: true, quantity: true },
    }),
    db.tradeOffer.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.sealedHolding.findMany({
      where: { userId, addedAt: { gte: since } },
      select: { addedAt: true, quantity: true },
    }),
    db.binder.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  // Agrégation par jour. On compte chaque ligne ajoutée comme 1 action
  // (la quantité reflète plus le commerce que l'effort utilisateur).
  const counts = new Map<string, number>();
  function bump(date: Date) {
    const key = toDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const c of collections) bump(c.addedAt);
  for (const t of tradeOffers) bump(t.createdAt);
  for (const s of sealedHoldings) bump(s.addedAt);
  for (const b of binders) bump(b.createdAt);

  // Pré-remplit tous les jours pour simplifier l'affichage.
  // La heatmap s'attend à un calendrier dense, sans trou.
  const cells: { date: string; count: number }[] = [];
  const start = new Date(since);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + MS_PER_DAY)) {
    const key = toDateKey(d);
    cells.push({ date: key, count: counts.get(key) ?? 0 });
  }

  const total = cells.reduce((s, c) => s + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;
  const maxDay = cells.reduce((m, c) => (c.count > m ? c.count : m), 0);

  return NextResponse.json({
    days,
    cells,
    summary: { total, activeDays, maxDay },
  });
}
