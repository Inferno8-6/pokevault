"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface SealedItem {
  id: string;
  productId: string;
  name: string;
  type: string;
  setName: string | null;
  setCode: string | null;
  language: string;
  imageUrl: string | null;
  quantity: number;
  condition: string;
  purchasePrice: number | null;
  currentPrice: number | null;
  currency: string;
  value: number;
  cost: number;
  pnl: number | null;
  pnlPct: number | null;
  notes: string | null;
  addedAt: string;
}

interface Summary {
  totalValue: number;
  totalCost: number;
  totalQty: number;
  productCount: number;
  pnl: number | null;
  pnlPct: number | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  booster: { label: "Booster", icon: "📦", color: "var(--primary)" },
  etb: { label: "ETB", icon: "🎁", color: "var(--accent)" },
  display: { label: "Display", icon: "🗃️", color: "#8b5cf6" },
  bundle: { label: "Bundle", icon: "🎒", color: "#ec4899" },
  tin: { label: "Tin", icon: "🥫", color: "#06b6d4" },
  collection_box: { label: "Coffret", icon: "💎", color: "#22c55e" },
  premium: { label: "Premium", icon: "👑", color: "#fbbf24" },
  other: { label: "Autre", icon: "📋", color: "var(--muted)" },
};

export default function SealedPage() {
  const [items, setItems] = useState<SealedItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => { fetchSealed(); }, []);

  async function fetchSealed() {
    setLoading(true);
    const res = await fetch("/api/sealed");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
      setSummary(data.summary ?? null);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    await fetch(`/api/sealed?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleQtyChange(id: string, delta: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) return handleDelete(id);
    const res = await fetch(`/api/sealed?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: newQty, value: (i.currentPrice ?? 0) * newQty, cost: (i.purchasePrice ?? 0) * newQty } : i));
    }
  }

  const filtered = filterType === "all" ? items : items.filter((i) => i.type === filterType);
  const typeCounts = items.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + i.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Produits scellés</h1>
        <p className="text-[var(--muted)]">
          Boosters, ETB, displays — suivez la valeur de vos produits non-ouverts
        </p>
      </div>

      {/* Summary stats */}
      {!loading && summary && summary.productCount > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { value: summary.totalQty, label: "Produits", icon: "📦", color: "var(--primary)", suffix: "" },
            { value: summary.totalValue.toFixed(2), label: "Valeur totale", icon: "💰", color: "var(--success)", suffix: " €" },
            { value: summary.totalCost > 0 ? summary.totalCost.toFixed(2) : "—", label: "Coût total", icon: "🧾", color: "var(--accent)", suffix: summary.totalCost > 0 ? " €" : "" },
            {
              value: summary.pnl != null ? (summary.pnl >= 0 ? "+" : "") + summary.pnl.toFixed(2) : "—",
              label: summary.pnlPct != null ? `P&L (${summary.pnlPct >= 0 ? "+" : ""}${summary.pnlPct.toFixed(1)}%)` : "P&L",
              icon: summary.pnl != null && summary.pnl >= 0 ? "📈" : summary.pnl != null ? "📉" : "📊",
              color: summary.pnl != null ? (summary.pnl >= 0 ? "var(--success)" : "var(--danger)") : "var(--muted)",
              suffix: summary.pnl != null ? " €" : "",
            },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: `radial-gradient(circle at top, ${s.color}, transparent 70%)` }} />
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}{s.suffix}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres + bouton ajout */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
          <button
            onClick={() => setFilterType("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === "all"
                ? "bg-[var(--primary)] text-black"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            Tous ({items.length})
          </button>
          {Object.entries(typeCounts).map(([type, count]) => {
            const meta = TYPE_LABELS[type] ?? TYPE_LABELS.other;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterType === type
                    ? "bg-[var(--primary)] text-black"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {meta.icon} {meta.label} ({count})
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/10"
        >
          + Ajouter un produit
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="h-32 rounded-xl animate-pulse mb-3" />
              <div className="h-4 w-2/3 rounded animate-pulse mb-2" />
              <div className="h-3 w-1/3 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-14 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-5"
            style={{ background: "radial-gradient(circle at center, var(--primary), transparent 70%)" }} />
          <p className="text-5xl mb-3">📦</p>
          <p className="font-semibold text-lg">{items.length === 0 ? "Aucun produit scellé" : "Aucun produit dans cette catégorie"}</p>
          <p className="mt-2 max-w-md mx-auto text-sm text-[var(--muted)]">
            {items.length === 0
              ? "Ajoutez vos boosters, ETB, displays et autres produits scellés pour suivre leur valeur"
              : "Changez de filtre pour voir d'autres types de produits"}
          </p>
          {items.length === 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-6 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors"
            >
              + Ajouter mon premier produit
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const meta = TYPE_LABELS[item.type] ?? TYPE_LABELS.other;
            const pnlPositive = item.pnl != null && item.pnl > 0;
            const pnlNegative = item.pnl != null && item.pnl < 0;
            return (
              <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]/30 transition-all">
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `radial-gradient(ellipse at top, ${meta.color}10, transparent 50%)` }} />

                {/* Header : badge type + delete */}
                <div className="relative mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: `${meta.color}20`, color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                      {item.language}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--border)] opacity-0 group-hover:opacity-100 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] transition-all"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Image produit */}
                <div className="relative mb-3 flex h-32 items-center justify-center rounded-xl bg-[var(--background)] overflow-hidden">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={120}
                      height={120}
                      className="h-full w-auto object-contain p-2"
                      unoptimized
                    />
                  ) : (
                    <span className="text-5xl opacity-30">{meta.icon}</span>
                  )}
                  {item.quantity > 1 && (
                    <span className="absolute top-1 right-1 rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-black text-black shadow-lg">
                      ×{item.quantity}
                    </span>
                  )}
                </div>

                {/* Nom + set */}
                <div className="relative mb-2">
                  <p className="font-semibold leading-tight line-clamp-2">{item.name}</p>
                  {item.setName && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{item.setName}</p>
                  )}
                </div>

                {/* Prix */}
                <div className="relative flex items-end justify-between">
                  <div>
                    <p className="text-lg font-black text-[var(--primary)]">
                      {item.value.toFixed(2)} €
                    </p>
                    {item.currentPrice != null && item.quantity > 1 && (
                      <p className="text-[10px] text-[var(--muted)]">
                        {item.currentPrice.toFixed(2)} € l&apos;unité
                      </p>
                    )}
                    {item.pnl != null && (
                      <p className={`text-xs font-semibold ${pnlPositive ? "text-[var(--success)]" : pnlNegative ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                        {pnlPositive ? "▲ +" : pnlNegative ? "▼ " : ""}{item.pnl.toFixed(2)} €
                        {item.pnlPct != null && ` (${item.pnlPct >= 0 ? "+" : ""}${item.pnlPct.toFixed(1)}%)`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQtyChange(item.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40 transition-colors"
                    >
                      −
                    </button>
                    <span className="min-w-[24px] text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddSealedModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchSealed(); }}
        />
      )}
    </div>
  );
}

// ─── Modal d'ajout ───────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  productType: string;
  setName: string | null;
  setCode: string | null;
  language: string;
  imageUrl: string | null;
  currentPrice: number | null;
}

function AddSealedModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [showManual, setShowManual] = useState(false);

  // Formulaire
  const [name, setName] = useState("");
  const [productType, setProductType] = useState("booster");
  const [productSetName, setProductSetName] = useState("");
  const [language, setLanguage] = useState("FR");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("sealed");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/sealed/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  function pickResult(r: SearchResult) {
    setSelected(r);
    setName(r.name);
    setProductType(r.productType);
    setProductSetName(r.setName ?? "");
    setLanguage(r.language);
    if (r.currentPrice != null) setCurrentPrice(String(r.currentPrice));
    setShowManual(true);
  }

  function startManual() {
    setSelected(null);
    setName(query);
    setShowManual(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        quantity: parseInt(quantity, 10) || 1,
        condition,
      };
      if (selected) {
        body.productId = selected.id;
      } else {
        if (!name.trim()) {
          setError("Nom du produit requis");
          setSaving(false);
          return;
        }
        body.name = name.trim();
        body.productType = productType;
        body.setName = productSetName.trim() || null;
        body.language = language;
        if (currentPrice) body.currentPrice = parseFloat(currentPrice);
      }
      if (purchasePrice) body.purchasePrice = parseFloat(purchasePrice);

      const res = await fetch("/api/sealed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Ajouter un produit scellé</h2>
            <p className="text-xs text-[var(--muted)]">Booster, ETB, display, coffret…</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors">✕</button>
        </div>

        {!showManual && (
          <>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">Rechercher un produit existant</label>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Booster Flammes Obsidiennes, ETB 151…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>

            {results.length > 0 && (
              <div className="mb-4 max-h-60 space-y-1.5 overflow-y-auto">
                {results.map((r) => {
                  const meta = TYPE_LABELS[r.productType] ?? TYPE_LABELS.other;
                  return (
                    <button
                      key={r.id}
                      onClick={() => pickResult(r)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:border-[var(--primary)]/50 transition-colors"
                    >
                      <span className="text-xl">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-[var(--muted)]">{r.setName ?? meta.label}</p>
                      </div>
                      {r.currentPrice != null && (
                        <p className="shrink-0 text-sm font-bold text-[var(--primary)]">{r.currentPrice.toFixed(2)} €</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={startManual}
              className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] py-3 text-sm font-medium text-[var(--muted)] hover:border-[var(--primary)]/40 hover:text-white transition-colors"
            >
              {query ? `+ Créer "${query}"` : "+ Saisir manuellement"}
            </button>
          </>
        )}

        {showManual && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {selected && (
              <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{selected.name}</p>
                  <p className="text-xs text-[var(--muted)]">{selected.setName ?? "—"}</p>
                </div>
                <button type="button" onClick={() => { setSelected(null); setShowManual(false); setName(""); }} className="text-xs text-[var(--muted)] hover:text-white">Changer</button>
              </div>
            )}

            {!selected && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nom du produit *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Booster Flammes Obsidiennes"
                    required
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Type</label>
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                    >
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Langue</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                    >
                      <option value="FR">🇫🇷 Français</option>
                      <option value="EN">🇬🇧 Anglais</option>
                      <option value="JP">🇯🇵 Japonais</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Set / Extension</label>
                  <input
                    type="text"
                    value={productSetName}
                    onChange={(e) => setProductSetName(e.target.value)}
                    placeholder="151, Flammes Obsidiennes…"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Prix actuel unitaire (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    placeholder="4.50"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Quantité</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">État</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="sealed">🔒 Scellé</option>
                  <option value="opened">📂 Ouvert</option>
                  <option value="damaged">💔 Endommagé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Prix d&apos;achat unitaire (€) — optionnel</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Pour calculer le P&L"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]">⚠️ {error}</p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50">
                {saving ? "Ajout..." : "📦 Ajouter"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
