"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { CardModal } from "@/components/card-modal";
import type { NormalizedCard } from "@/lib/tcgdex";

interface SetInfo {
  id: string;
  name: string;
  cardCount: { total: number; official: number };
  releaseDate?: string;
  serie?: { id: string; name: string };
}

/** Entrée Collection brute renvoyée par /api/portfolio (un user peut avoir
 *  la même carte sous plusieurs conditions → plusieurs entrées par tcgId). */
export interface OwnedEntry {
  id: string;
  condition: string | null;
  variant: string | null;
  quantity: number;
}

type Lang = "fr" | "en" | "ja";
const LANG_FLAGS: Record<Lang, string> = { fr: "🇫🇷", en: "🇺🇸", ja: "🇯🇵" };

/** Construit la map tcgId → entrées à partir du retour de /api/portfolio. */
function buildOwnedEntriesMap(
  items: Array<{ id: string; tcgId: string; condition: string | null; variant: string | null; quantity: number }>,
): Map<string, OwnedEntry[]> {
  const out = new Map<string, OwnedEntry[]>();
  for (const item of items) {
    if (!item.tcgId) continue;
    const entry: OwnedEntry = { id: item.id, condition: item.condition, variant: item.variant ?? null, quantity: item.quantity };
    const list = out.get(item.tcgId);
    if (list) list.push(entry);
    else out.set(item.tcgId, [entry]);
  }
  return out;
}

export default function SetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const langParam = searchParams.get("lang");
  const lang: Lang = (langParam === "en" || langParam === "ja" || langParam === "fr")
    ? langParam
    : "fr";

  const [set, setSet] = useState<SetInfo | null>(null);
  const [cards, setCards] = useState<NormalizedCard[]>([]);
  /** Map tcgId → toutes les entrées Collection de l'utilisateur pour cette carte.
   *  Une même carte peut exister sous plusieurs conditions (NM, MINT…) — on les
   *  garde toutes pour permettre de retirer ligne par ligne dans le modal. */
  const [ownedEntries, setOwnedEntries] = useState<Map<string, OwnedEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<NormalizedCard | null>(null);
  const [showOnlyOwned, setShowOnlyOwned] = useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sets/${id}?lang=${lang}`).then((r) => r.json()),
      fetch("/api/portfolio").then((r) => r.json()),
    ]).then(([setData, portfolioData]) => {
      setSet(setData.set);
      setCards(setData.cards ?? []);
      setOwnedEntries(buildOwnedEntriesMap(portfolioData.items ?? []));
    }).finally(() => setLoading(false));
  }, [id, lang]);

  /** Total possédé pour une carte (toutes conditions confondues). */
  const ownedQty = useMemo(() => {
    const out = new Map<string, number>();
    for (const [tcgId, entries] of ownedEntries) {
      out.set(tcgId, entries.reduce((s, e) => s + e.quantity, 0));
    }
    return out;
  }, [ownedEntries]);

  /** Recharge la collection après ajout/retrait depuis le modal — source de
   *  vérité unique, évite les divergences entre l'UI optimiste et la DB. */
  async function refreshPortfolio() {
    const res = await fetch("/api/portfolio");
    if (!res.ok) return;
    const data = await res.json();
    setOwnedEntries(buildOwnedEntriesMap(data.items ?? []));
  }

  const total = set?.cardCount?.official ?? set?.cardCount?.total ?? cards.length;
  const owned = cards.filter((c) => (ownedQty.get(c.id) ?? 0) > 0).length;
  const pct = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;

  const displayed = cards.filter((c) => {
    const qty = ownedQty.get(c.id) ?? 0;
    if (showOnlyOwned) return qty > 0;
    if (showOnlyMissing) return qty === 0;
    return true;
  });

  return (
    <div>
      {/* Navigation */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={lang !== "fr" ? `/sets?lang=${lang}` : "/sets"}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors"
          title="Retour à la liste des séries"
        >
          ←
        </Link>
        {set && (
          <div>
            <p className="text-xs text-[var(--muted)]">{set.serie?.name}</p>
            <h1 className="text-xl font-bold">{set.name}</h1>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-5">
          {/* Header skeleton */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-1/3 rounded animate-pulse" />
                <div className="h-3 w-1/4 rounded animate-pulse" />
                <div className="h-2 w-full rounded animate-pulse" />
              </div>
            </div>
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] w-full rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Progression */}
          {(() => {
            const r = 36;
            const circ = 2 * Math.PI * r;
            const dash = (pct / 100) * circ;
            const color = pct === 100 ? "var(--success)" : "var(--primary)";
            return (
              <div className="mb-6 relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <div className="pointer-events-none absolute inset-0 opacity-5"
                  style={{ background: `radial-gradient(ellipse at right, ${color}, transparent 60%)` }} />
                <div className="flex items-center gap-5">
                  {/* Circular ring */}
                  <div className="relative shrink-0 flex items-center justify-center" style={{ width: 88, height: 88 }}>
                    <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--background)" strokeWidth="5" />
                      <circle
                        cx="44" cy="44" r={r} fill="none"
                        stroke={color} strokeWidth="5"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
                      />
                    </svg>
                    <span className="absolute text-lg font-black" style={{ color }}>{pct}%</span>
                  </div>
                  {/* Stats */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xl font-bold">{owned} / {total} cartes</p>
                      {pct === 100 && (
                        <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-xs font-bold text-[var(--success)]">✓ Complète !</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--muted)] mb-3">
                      {set?.serie?.name}{set?.releaseDate ? ` · ${set.releaseDate.slice(0, 4)}` : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[var(--background)] px-3 py-2 text-center">
                        <p className="text-base font-black text-[var(--primary)]">{owned}</p>
                        <p className="text-[10px] text-[var(--muted)]">Possédées</p>
                      </div>
                      <div className="rounded-xl bg-[var(--background)] px-3 py-2 text-center">
                        <p className="text-base font-black text-[var(--danger)]">{total - owned}</p>
                        <p className="text-[10px] text-[var(--muted)]">Manquantes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Filtres */}
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => { setShowOnlyOwned(false); setShowOnlyMissing(false); }}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                !showOnlyOwned && !showOnlyMissing
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
              }`}
            >
              Toutes ({cards.length})
            </button>
            <button
              onClick={() => { setShowOnlyOwned(true); setShowOnlyMissing(false); }}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                showOnlyOwned
                  ? "border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
              }`}
            >
              ✓ Possédées ({owned})
            </button>
            <button
              onClick={() => { setShowOnlyMissing(true); setShowOnlyOwned(false); }}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                showOnlyMissing
                  ? "border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
              }`}
            >
              ✕ Manquantes ({total - owned})
            </button>
          </div>

          {/* Empty state : TCGdex référence le set mais n'a pas scanné les cartes.
              Concerne surtout les vieux sets JP (PMCG*, certains SM) où la base
              de données externe est incomplète. */}
          {cards.length === 0 && total > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: "radial-gradient(circle at center, var(--primary), transparent 70%)" }} />
              <p className="text-5xl mb-3">🗂️</p>
              <p className="font-semibold text-lg">Cartes non disponibles dans TCGdex</p>
              <p className="mt-2 max-w-md mx-auto text-sm text-[var(--muted)]">
                Cette série existe ({total} cartes officielles) mais TCGdex
                n&apos;a pas encore scanné ses visuels. Tu peux toujours suivre
                tes prix manuellement en saisissant les cartes via la recherche
                globale.
              </p>
              <Link
                href="/explore"
                className="mt-4 inline-block rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-5 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
              >
                🔍 Aller à l&apos;explorateur
              </Link>
            </div>
          )}

          {/* Grille de cartes */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {displayed.map((card) => {
              const qty = ownedQty.get(card.id) ?? 0;
              const isOwned = qty > 0;

              return (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`group relative overflow-hidden rounded-xl border transition-all hover:scale-105 ${
                    isOwned
                      ? "border-[var(--primary)]/60 shadow-md shadow-[var(--primary)]/30 ring-1 ring-[var(--primary)]/30"
                      : "border-[var(--border)] opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
                  }`}
                >
                  <div className="relative aspect-[3/4] w-full">
                    <CardImage
                      src={card.images.small}
                      alt={card.name}
                      fill
                      className="object-contain"
                      sizes="100px"
                    />
                    {/* Overlay doré pour les cartes possédées */}
                    {isOwned && (
                      <div className="absolute inset-0 rounded-t-xl bg-gradient-to-t from-[var(--primary)]/20 to-transparent pointer-events-none" />
                    )}
                  </div>

                  {/* Badge quantité (si > 1) */}
                  {qty > 1 && (
                    <div className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-black shadow">
                      ×{qty}
                    </div>
                  )}

                  {/* Badge possédée (si exactement 1) */}
                  {qty === 1 && (
                    <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-black shadow">
                      ✓
                    </div>
                  )}

                  <div className={`px-1 py-0.5 text-center ${isOwned ? "bg-[var(--primary)]/10" : "bg-[var(--card)]"}`}>
                    <p className={`truncate text-[10px] ${isOwned ? "text-[var(--primary)] font-semibold" : "text-[var(--muted)]"}`}>
                      #{card.number}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <CardModal
        card={selectedCard}
        lang={lang}
        ownedEntries={selectedCard ? ownedEntries.get(selectedCard.id) ?? [] : []}
        onClose={() => setSelectedCard(null)}
        onPortfolioChanged={refreshPortfolio}
      />
    </div>
  );
}
