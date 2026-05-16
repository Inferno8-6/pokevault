"use client";

import { useState, useEffect } from "react";
import { CardImage } from "@/components/card-image";
import type { NormalizedCard } from "@/lib/tcgdex";

interface WishlistItem {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  number: string;
  imageSmall: string | null;
  maxPrice: number | null;
  currentPrice: number | null;
  addedAt: string;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchWishlist(); }, []);

  async function fetchWishlist() {
    setLoading(true);
    const res = await fetch("/api/wishlist");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/wishlist?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const priceAlertCount = items.filter(
    (i) => i.maxPrice != null && i.currentPrice != null && i.currentPrice <= i.maxPrice
  ).length;
  const withTargetCount = items.filter((i) => i.maxPrice != null).length;
  const avgGap = items.reduce((acc, i) => {
    if (i.maxPrice != null && i.currentPrice != null) {
      return acc + ((i.currentPrice - i.maxPrice) / i.maxPrice) * 100;
    }
    return acc;
  }, 0) / (withTargetCount || 1);

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Wishlist</h1>
        <p className="text-[var(--muted)]">
          Les cartes que vous recherchez — alerté quand le prix descend sous votre cible
        </p>
      </div>

      {/* Stats header */}
      {!loading && items.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { value: items.length, label: "Cartes suivies", icon: "💫", color: "var(--accent)" },
            { value: withTargetCount, label: "Avec prix cible", icon: "🎯", color: "var(--primary)" },
            { value: priceAlertCount, label: "Sous la cible", icon: "🔥", color: "var(--success)" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: `radial-gradient(circle at top, ${s.color}, transparent 70%)` }} />
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {priceAlertCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-1 text-xs font-semibold text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              {priceAlertCount} sous la cible !
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/10"
        >
          + Ajouter une carte
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="h-16 w-11 shrink-0 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded animate-pulse" />
                <div className="h-3 w-1/4 rounded animate-pulse" />
                <div className="h-1.5 w-full rounded animate-pulse" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-5 w-16 rounded animate-pulse" />
                <div className="h-3 w-12 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-14 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-5"
            style={{ background: "radial-gradient(circle at center, var(--accent), transparent 70%)" }} />
          <p className="text-5xl mb-3">💫</p>
          <p className="font-semibold text-lg">Votre wishlist est vide</p>
          <p className="mt-2 max-w-sm mx-auto text-sm text-[var(--muted)]">
            Ajoutez les cartes que vous recherchez et définissez un prix cible pour être alerté dès qu&apos;elles baissent
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/20"
          >
            + Ajouter ma première carte
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const belowTarget = item.maxPrice != null && item.currentPrice != null && item.currentPrice <= item.maxPrice;
            const gapPct = (item.maxPrice != null && item.currentPrice != null)
              ? ((item.currentPrice - item.maxPrice) / item.maxPrice) * 100
              : null;

            return (
              <div
                key={item.id}
                className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-[var(--card)] p-4 transition-all ${
                  belowTarget
                    ? "border-[var(--success)]/40 shadow-lg shadow-[var(--success)]/5"
                    : "border-[var(--border)] hover:border-[var(--primary)]/20"
                }`}
              >
                {belowTarget && (
                  <div className="pointer-events-none absolute inset-0 opacity-5"
                    style={{ background: "radial-gradient(ellipse at left, var(--success), transparent 50%)" }} />
                )}

                {/* Card image */}
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg shadow-md">
                  {item.imageSmall ? (
                    <CardImage src={item.imageSmall} alt={item.cardName} fill className="object-contain" sizes="44px" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--background)] text-lg">🃏</div>
                  )}
                </div>

                {/* Infos */}
                <div className="relative flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="truncate font-semibold">{item.cardName}</p>
                    {belowTarget && (
                      <span className="shrink-0 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
                        🔥 Sous la cible !
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-2">{item.setName} · #{item.number}</p>

                  {/* Price gap bar */}
                  {item.maxPrice != null && item.currentPrice != null && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-[var(--background)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (item.maxPrice / item.currentPrice) * 100)}%`,
                            background: belowTarget ? "var(--success)" : "var(--primary)",
                          }}
                        />
                      </div>
                      {gapPct !== null && (
                        <span className={`shrink-0 text-[10px] font-bold tabular-nums ${belowTarget ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>
                          {gapPct > 0 ? "+" : ""}{gapPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Prix */}
                <div className="relative shrink-0 text-right">
                  {item.currentPrice != null && (
                    <p className="text-base font-black" style={{ color: belowTarget ? "var(--success)" : "var(--primary)" }}>
                      {item.currentPrice.toFixed(2)} €
                    </p>
                  )}
                  {item.maxPrice != null ? (
                    <p className="text-xs text-[var(--muted)]">cible ≤ {item.maxPrice.toFixed(2)} €</p>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">pas de cible</p>
                  )}
                </div>

                {/* Supprimer */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--border)] opacity-0 group-hover:opacity-100 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] transition-all"
                  title="Retirer de la wishlist"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AddToWishlistModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); fetchWishlist(); }}
        />
      )}
    </div>
  );
}

// ─── Modal ajout wishlist ─────────────────────────────────────────────────────

function AddToWishlistModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [step, setStep] = useState<"search" | "configure">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NormalizedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<NormalizedCard | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}&pageSize=20`);
      const data = await res.json();
      setSearchResults(data.data ?? []);
    } finally {
      setSearching(false);
    }
  }

  function selectCard(card: NormalizedCard) {
    setSelectedCard(card);
    const price = card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice;
    if (price) setMaxPrice(price.toFixed(2));
    setStep("configure");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tcgId: selectedCard.id,
          maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        }),
      });
      if (res.ok) {
        onAdded();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Ajouter à la wishlist</h2>
            <div className="mt-1.5 flex items-center gap-2">
              {["Choisir une carte", "Prix cible"].map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black transition-colors ${
                    (step === "search" && i === 0) || (step === "configure" && i === 1)
                      ? "bg-[var(--primary)] text-black"
                      : i === 0 && step === "configure"
                      ? "bg-[var(--success)] text-black"
                      : "bg-[var(--border)] text-[var(--muted)]"
                  }`}>
                    {i === 0 && step === "configure" ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs ${(step === "search" && i === 0) || (step === "configure" && i === 1) ? "text-white" : "text-[var(--muted)]"}`}>
                    {label}
                  </span>
                  {i < 1 && <span className="text-[var(--border)]">→</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors">✕</button>
        </div>

        {step === "search" && (
          <div>
            <form onSubmit={handleSearch} className="mb-4 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Dracaufeu, Mewtwo..."
                autoFocus
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
              />
              <button type="submit" disabled={searching}
                className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50 hover:bg-[var(--primary-hover)] transition-colors">
                {searching ? "..." : "Chercher"}
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {searchResults.map((card) => {
                  const price = card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice;
                  return (
                    <button key={card.id} onClick={() => selectCard(card)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:border-[var(--primary)]/50 hover:bg-[var(--card-hover)] transition-colors">
                      <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg">
                        <CardImage src={card.images?.small} alt={card.name} fill className="object-contain" sizes="36px" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{card.name}</p>
                        <p className="text-xs text-[var(--muted)]">{card.set.name} · #{card.number}</p>
                      </div>
                      {price != null && (
                        <p className="shrink-0 text-sm font-bold text-[var(--primary)]">{price.toFixed(2)} €</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--muted)]">Aucune carte trouvée</p>
            )}
          </div>
        )}

        {step === "configure" && selectedCard && (
          <form onSubmit={handleAdd}>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3">
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg shadow-md">
                <CardImage src={selectedCard.images?.small} alt={selectedCard.name} fill className="object-contain" sizes="44px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{selectedCard.name}</p>
                <p className="text-sm text-[var(--muted)]">{selectedCard.set.name} · #{selectedCard.number}</p>
              </div>
              <button type="button" onClick={() => { setStep("search"); setSelectedCard(null); }}
                className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-white transition-colors">
                Changer
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium">
                Prix cible max (€) <span className="text-[var(--muted)]">— optionnel</span>
              </label>
              <p className="mb-2 text-xs text-[var(--muted)]">
                Vous serez alerté via Discord quand le prix descend sous ce seuil
              </p>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Laisser vide pour suivre sans alerte prix"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-lg font-bold outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>

            {error && (
              <p className="mb-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2.5 text-sm text-[var(--danger)]">⚠️ {error}</p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50">
                {saving ? "Ajout..." : "💫 Ajouter à la wishlist"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
