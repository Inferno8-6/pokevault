"use client";

import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { CardImage } from "@/components/card-image";
import type { NormalizedCard } from "@/lib/tcgdex";

interface BinderInfo {
  id: string;
  name: string;
  description: string | null;
  layout: string;
  isPublic: boolean;
  coverColor: string;
  coverImage: string | null;
  slotsPerPage: number;
  totalSlots: number;
  totalPages: number;
  value: number;
  owner: { id: string; name: string | null; image: string | null };
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SlotCard {
  id: string;
  tcgId: string;
  name: string;
  setName: string;
  number: string;
  imageSmall: string | null;
  rarity: string | null;
  currentPrice: number | null;
}

interface Slot {
  id: string;
  position: number;
  pageIndex: number;
  slotIndex: number;
  condition: string | null;
  card: SlotCard | null;
}

export default function BinderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [binder, setBinder] = useState<BinderInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchBinder(); }, [id]);

  async function fetchBinder() {
    setLoading(true);
    const res = await fetch(`/api/binders/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBinder(data.binder);
      setSlots(data.slots ?? []);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur");
    }
    setLoading(false);
  }

  const [cols, rows] = useMemo(() => {
    if (!binder) return [3, 3];
    const [c, r] = binder.layout.split("x").map(Number);
    return [c || 3, r || 3];
  }, [binder]);

  const slotsPerPage = cols * rows;

  // Always show at least currentPage filled + 1 empty page for adding
  const visualTotalPages = Math.max(binder?.totalPages ?? 1, page + 1, 1);

  const currentPageSlots = useMemo(() => {
    const startPos = page * slotsPerPage;
    const result: (Slot | null)[] = Array(slotsPerPage).fill(null);
    for (const slot of slots) {
      if (slot.pageIndex === page) {
        result[slot.slotIndex] = slot;
      }
    }
    return { result, startPos };
  }, [slots, page, slotsPerPage]);

  async function handlePlaceCard(position: number, tcgId: string) {
    const res = await fetch(`/api/binders/${id}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, tcgId }),
    });
    if (res.ok) {
      setAddingAt(null);
      fetchBinder();
    }
  }

  async function handleRemoveCard(position: number) {
    if (!confirm("Retirer cette carte du classeur ?")) return;
    const res = await fetch(`/api/binders/${id}/slots`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, tcgId: null }),
    });
    if (res.ok) fetchBinder();
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded animate-pulse" />
            <div className="h-3 w-32 rounded animate-pulse" />
          </div>
        </div>
        <div className="aspect-[4/3] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !binder) {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-8 text-center">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="font-semibold">{error ?? "Classeur introuvable"}</p>
        <Link href="/binders" className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline">
          ← Retour à mes classeurs
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/binders"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold truncate">{binder.name}</h1>
            {binder.isPublic && (
              <span className="shrink-0 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
                🌐 Public
              </span>
            )}
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${binder.coverColor}25`, color: binder.coverColor }}>
              {binder.layout}
            </span>
          </div>
          {binder.description && (
            <p className="text-sm text-[var(--muted)]">{binder.description}</p>
          )}
        </div>
        {binder.value > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-black text-[var(--primary)]">{binder.value.toFixed(2)} €</p>
            <p className="text-[10px] text-[var(--muted)]">valeur totale</p>
          </div>
        )}
      </div>

      {/* Binder visual : double-page spread effect */}
      <div className="relative">
        <div
          className="relative overflow-hidden rounded-3xl border-2 p-5 shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${binder.coverColor}15, transparent 60%), var(--card)`,
            borderColor: `${binder.coverColor}30`,
          }}
        >
          {/* Spine */}
          <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
            style={{ background: `linear-gradient(to bottom, transparent, ${binder.coverColor}40, transparent)` }} />

          {/* Grille de slots */}
          <div
            className="grid gap-2 sm:gap-3"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {currentPageSlots.result.map((slot, idx) => {
              const position = currentPageSlots.startPos + idx;
              return (
                <BinderSlot
                  key={idx}
                  slot={slot}
                  position={position}
                  isOwner={binder.isOwner}
                  onAdd={() => setAddingAt(position)}
                  onRemove={() => handleRemoveCard(position)}
                />
              );
            })}
          </div>
        </div>

        {/* Page navigation */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ←
          </button>
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2">
            <span className="text-sm font-bold tabular-nums">{page + 1}</span>
            <span className="text-xs text-[var(--muted)]">/ {visualTotalPages}</span>
          </div>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!binder.isOwner && page >= binder.totalPages - 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>

        {/* Mini-map pages */}
        {visualTotalPages > 1 && visualTotalPages <= 20 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {Array.from({ length: visualTotalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-2 rounded-full transition-all ${
                  page === i ? "w-6 bg-[var(--primary)]" : "w-2 bg-[var(--border)] hover:bg-[var(--muted)]"
                }`}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Owner footer */}
      {!binder.isOwner && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          {binder.owner.image && (
            <Image src={binder.owner.image} alt={binder.owner.name ?? ""} width={32} height={32} className="rounded-full" />
          )}
          <div className="flex-1">
            <p className="text-sm">
              Classeur de <Link href={`/profile/${binder.owner.id}`} className="font-semibold text-[var(--primary)] hover:underline">{binder.owner.name ?? "Anonyme"}</Link>
            </p>
            <p className="text-xs text-[var(--muted)]">
              Mis à jour le {new Date(binder.updatedAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
      )}

      {addingAt !== null && (
        <AddCardToSlotModal
          position={addingAt}
          onClose={() => setAddingAt(null)}
          onAdded={(tcgId) => handlePlaceCard(addingAt, tcgId)}
        />
      )}
    </div>
  );
}

function BinderSlot({
  slot,
  position,
  isOwner,
  onAdd,
  onRemove,
}: {
  slot: Slot | null;
  position: number;
  isOwner: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (slot?.card) {
    return (
      <div className="group relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-[var(--border)] bg-[var(--background)] transition-all hover:border-[var(--primary)]/40">
        <CardImage
          src={slot.card.imageSmall}
          alt={slot.card.name}
          fill
          className="object-contain"
          sizes="200px"
        />
        {/* Hover overlay : info + remove */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="truncate text-[10px] font-semibold text-white">{slot.card.name}</p>
          {slot.card.currentPrice != null && (
            <p className="text-[10px] font-bold text-[var(--primary)]">{slot.card.currentPrice.toFixed(2)} €</p>
          )}
        </div>
        {isOwner && (
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[var(--danger)] transition-all text-xs"
            title="Retirer"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (!isOwner) {
    // Empty slot for non-owners
    return (
      <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-[var(--border)]/40 bg-[var(--background)]/40" />
    );
  }

  return (
    <button
      onClick={onAdd}
      className="group flex aspect-[3/4] items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--background)]/40 text-2xl text-[var(--border)] transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 hover:text-[var(--primary)] hover:scale-[1.02]"
      title={`Ajouter une carte à la position ${position + 1}`}
    >
      <span className="opacity-50 group-hover:opacity-100 transition-opacity">+</span>
    </button>
  );
}

/* ─── Types de résultats ─────────────────────────────────────────────────── */

interface CollectionCard {
  id: string;          // tcgId
  name: string;
  setName: string;
  number: string;
  rarity: string | null;
  imageSmall: string | null;
  currentPrice: number | null;
  inCollection: true;
  quantity: number;
}

/* ─── Modal amélioré ─────────────────────────────────────────────────────── */

function AddCardToSlotModal({
  position,
  onClose,
  onAdded,
}: {
  position: number;
  onClose: () => void;
  onAdded: (tcgId: string) => void;
}) {
  const [tab, setTab] = useState<"collection" | "all">("collection");
  const [query, setQuery] = useState("");
  const [collectionResults, setCollectionResults] = useState<CollectionCard[]>([]);
  const [allResults, setAllResults] = useState<NormalizedCard[]>([]);
  const [allPage, setAllPage] = useState(1);
  const [allTotal, setAllTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  /** Carte mise en surbrillance — pas encore validée. L'ajout réel ne se fait
   *  qu'après confirmation explicite via le bouton "Placer cette carte". */
  const [selected, setSelected] = useState<{ id: string; name: string; imageSmall: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const PAGE_SIZE = 36;

  /* ── Recherche auto dans la collection (debounce 250ms) ─────────────────── */
  useEffect(() => {
    if (tab !== "collection") return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const url = q
          ? `/api/portfolio/cards?q=${encodeURIComponent(q)}&limit=60`
          : `/api/portfolio/cards?limit=60`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          setCollectionResults(data.cards ?? []);
        }
      } catch { /* aborted */ }
      finally { setSearching(false); }
    }, 200);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, tab]);

  /* ── Recherche dans TCGdex (debounce 400ms) ─────────────────────────────── */
  useEffect(() => {
    if (tab !== "all") return;
    if (!query.trim()) { setAllResults([]); setAllTotal(0); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setAllPage(1);
      try {
        const res = await fetch(
          `/api/cards/search?q=${encodeURIComponent(query.trim())}&pageSize=${PAGE_SIZE}&page=1`,
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setAllResults(data.data ?? []);
          setAllTotal(data.totalCount ?? 0);
        }
      } catch { /* aborted */ }
      finally { setSearching(false); }
    }, 400);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, tab]);

  /* ── Charger plus de résultats TCGdex ───────────────────────────────────── */
  async function loadMore() {
    const nextPage = allPage + 1;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/cards/search?q=${encodeURIComponent(query.trim())}&pageSize=${PAGE_SIZE}&page=${nextPage}`
      );
      if (res.ok) {
        const data = await res.json();
        setAllResults((prev) => [...prev, ...(data.data ?? [])]);
        setAllPage(nextPage);
      }
    } finally { setSearching(false); }
  }

  /** Toggle sélection : reclic sur la même carte = désélection. */
  function togglePick(card: { id: string; name: string; imageSmall: string | null }) {
    if (submitting) return;
    setSelected((current) => (current?.id === card.id ? null : card));
  }

  /** Confirmation explicite : déclenche l'ajout réel via le parent. */
  async function confirmPick() {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      onAdded(selected.id);
    } finally {
      // onAdded ferme déjà le modal côté parent ; pas de reset nécessaire ici.
      setSubmitting(false);
    }
  }

  const showLoadMore = tab === "all" && allResults.length > 0 && allResults.length < allTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-bold">Ajouter une carte</h2>
            <p className="text-xs text-[var(--muted)]">Emplacement {position + 1}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] px-6">
          {([
            { key: "collection" as const, label: "Ma collection", icon: "🗃️" },
            { key: "all" as const, label: "Toutes les cartes", icon: "🔍" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setQuery(""); setAllResults([]); setCollectionResults([]); setSelected(null); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                tab === t.key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted)] hover:text-white"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Barre de recherche */}
        <div className="px-6 py-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === "collection"
                  ? "Nom, série, numéro… (vide = toute ta collection)"
                  : "Dracaufeu, Pikachu, Mewtwo…"
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] animate-pulse">
                ⏳
              </span>
            )}
          </div>
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {tab === "collection" ? (
            <>
              {collectionResults.length > 0 ? (
                <>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                    {collectionResults.length} carte{collectionResults.length > 1 ? "s" : ""} dans ta collection
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                    {collectionResults.map((card) => (
                      <CollectionCardTile
                        key={card.id}
                        card={card}
                        selectedId={selected?.id ?? null}
                        onPick={() => togglePick({ id: card.id, name: card.name, imageSmall: card.imageSmall })}
                      />
                    ))}
                  </div>
                </>
              ) : searching ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl animate-pulse bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="py-14 text-center">
                  <p className="text-4xl mb-3">🗃️</p>
                  <p className="font-semibold text-white">
                    {query ? "Aucune carte trouvée" : "Ta collection est vide"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {query
                      ? "Essaie un autre nom ou passe sur \"Toutes les cartes\""
                      : "Ajoute des cartes à ton portfolio, puis place-les ici"}
                  </p>
                  <button
                    onClick={() => setTab("all")}
                    className="mt-4 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
                  >
                    🔍 Chercher dans toutes les cartes
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {allResults.length > 0 ? (
                <>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                    {allResults.length} / {allTotal} résultat{allTotal > 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                    {allResults.map((card) => (
                      <TcgCardTile
                        key={card.id}
                        card={card}
                        selectedId={selected?.id ?? null}
                        onPick={() => togglePick({ id: card.id, name: card.name, imageSmall: card.images?.small ?? null })}
                      />
                    ))}
                  </div>
                  {showLoadMore && (
                    <button
                      onClick={loadMore}
                      disabled={searching}
                      className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 text-sm font-medium text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40 disabled:opacity-50 transition-colors"
                    >
                      {searching ? "Chargement…" : `Charger plus (${allTotal - allResults.length} restantes)`}
                    </button>
                  )}
                </>
              ) : searching ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl animate-pulse bg-white/5" />
                  ))}
                </div>
              ) : query ? (
                <div className="py-14 text-center">
                  <p className="text-3xl mb-3">😶</p>
                  <p className="font-semibold">Aucune carte trouvée</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Essaie "Dracaufeu" ou "Salamèche"</p>
                </div>
              ) : (
                <div className="py-14 text-center">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-semibold text-white">Tape un nom de carte</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Recherche parmi toutes les cartes TCG françaises</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Barre de confirmation — apparaît dès qu'une carte est mise en surbrillance.
            Évite l'ajout accidentel : clic sur une carte = sélection visuelle, pas
            d'insertion en DB tant que l'utilisateur n'a pas validé. */}
        {selected && (
          <div className="border-t border-[var(--border)] bg-[var(--card)] px-6 py-3 flex items-center gap-3">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md ring-2 ring-[var(--primary)]/60">
              {selected.imageSmall ? (
                <CardImage src={selected.imageSmall} alt={selected.name} fill className="object-contain" sizes="40px" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg">🃏</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-bold">Sélectionnée</p>
              <p className="truncate text-sm font-semibold">{selected.name}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              disabled={submitting}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:text-white hover:border-[var(--danger)]/40 disabled:opacity-50 transition-colors"
              title="Désélectionner"
            >
              Annuler
            </button>
            <button
              onClick={confirmPick}
              disabled={submitting}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {submitting ? "..." : "Placer ici"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tuiles de carte ─────────────────────────────────────────────────────── */

function CollectionCardTile({
  card,
  selectedId,
  onPick,
}: {
  card: CollectionCard;
  selectedId: string | null;
  onPick: () => void;
}) {
  const isSelected = selectedId === card.id;
  return (
    <button
      onClick={onPick}
      className={`group relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/40 scale-[1.04]"
          : "border-[var(--border)] hover:border-[var(--primary)]/60 hover:scale-[1.04]"
      }`}
    >
      {card.imageSmall ? (
        <CardImage src={card.imageSmall} alt={card.name} fill className="object-contain" sizes="120px" />
      ) : (
        <div className="flex h-full items-center justify-center text-[var(--muted)] text-2xl">🃏</div>
      )}
      {/* Pastille de sélection */}
      {isSelected && (
        <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-black text-black shadow-lg">
          ✓
        </span>
      )}
      {/* Badge quantité (à gauche pour éviter conflit avec ✓) */}
      {card.quantity > 1 && (
        <span className="absolute top-1 left-1 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-black text-black shadow">
          ×{card.quantity}
        </span>
      )}
      {/* Overlay info */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-1.5 transition-opacity ${
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}>
        <p className="truncate text-[10px] font-semibold text-white leading-tight">{card.name}</p>
        <p className="truncate text-[9px] text-[var(--muted)]">{card.setName} #{card.number}</p>
        {card.currentPrice != null && (
          <p className="text-[9px] font-bold text-[var(--primary)]">{card.currentPrice.toFixed(2)} €</p>
        )}
      </div>
    </button>
  );
}

function TcgCardTile({
  card,
  selectedId,
  onPick,
}: {
  card: NormalizedCard;
  selectedId: string | null;
  onPick: () => void;
}) {
  const isSelected = selectedId === card.id;
  return (
    <button
      onClick={onPick}
      className={`group relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/40 scale-[1.04]"
          : "border-[var(--border)] hover:border-[var(--primary)]/60 hover:scale-[1.04]"
      }`}
    >
      <CardImage src={card.images?.small} alt={card.name} fill className="object-contain" sizes="120px" />
      {isSelected && (
        <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-black text-black shadow-lg">
          ✓
        </span>
      )}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-1.5 transition-opacity ${
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}>
        <p className="truncate text-[10px] font-semibold text-white leading-tight">{card.name}</p>
        <p className="truncate text-[9px] text-[var(--muted)]">{card.set?.name} #{card.number}</p>
      </div>
    </button>
  );
}
