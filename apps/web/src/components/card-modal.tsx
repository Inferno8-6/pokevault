"use client";

import { useState, useEffect } from "react";
import { CardImage } from "@/components/card-image";
import { formatPrice, CARD_CONDITIONS, CARD_VARIANTS, VARIANT_LABELS } from "@pokemon/shared";
import type { CardCondition, CardVariant } from "@pokemon/shared";
import type { NormalizedCard } from "@/lib/tcgdex";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

/** Une entrée Collection détenue par l'utilisateur (peut y en avoir plusieurs
 *  par carte si différentes conditions). */
export interface OwnedEntry {
  id: string;
  condition: string | null;
  variant: string | null;
  quantity: number;
}

interface CardModalProps {
  card: NormalizedCard | null;
  /** Langue de la carte affichée — détermine la langue stockée à l'ajout. */
  lang?: "fr" | "en" | "ja";
  /** Entrées Collection existantes pour cette carte. Vide si non-possédée. */
  ownedEntries?: OwnedEntry[];
  onClose: () => void;
  /** Notifié à chaque ajout OU retrait — le parent doit re-fetch sa donnée. */
  onPortfolioChanged?: () => void | Promise<void>;
}

const CONDITION_LABELS_FR: Record<string, string> = {
  mint: "Neuve",
  near_mint: "Quasi Neuve",
  excellent: "Excellente",
  good: "Bonne",
  played: "Jouée",
  poor: "Mauvaise",
};

export function CardModal({
  card,
  lang = "fr",
  ownedEntries = [],
  onClose,
  onPortfolioChanged,
}: CardModalProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [condition, setCondition] = useState<CardCondition>("near_mint");
  const [variant, setVariant] = useState<CardVariant>("normal");
  const [quantity, setQuantity] = useState(1);
  const [fullCard, setFullCard] = useState<NormalizedCard | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");
  const [priceHistory, setPriceHistory] = useState<{ date: string; label: string; price: number }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState<30 | 90>(30);

  // Charge les détails complets dès que la carte change
  useEffect(() => {
    if (!card) {
      setFullCard(null);
      return;
    }
    setFullCard(null);
    setLoadingDetail(true);
    fetch(`/api/cards/${card.id}`)
      .then((r) => r.json())
      .then((d) => setFullCard(d.data ?? null))
      .catch(() => setFullCard(card)) // fallback sur données partielles
      .finally(() => setLoadingDetail(false));
  }, [card?.id]);

  // Reset imgLoaded quand la carte change
  useEffect(() => { setImgLoaded(false); }, [card?.id]);

  // Reset tab quand la carte change
  useEffect(() => { setActiveTab("info"); setPriceHistory([]); }, [card?.id]);

  // Fetch price history quand l'onglet est actif
  useEffect(() => {
    if (activeTab !== "history" || !card?.id) return;
    setHistoryLoading(true);
    fetch(`/api/cards/${card.id}/history?days=${historyDays}`)
      .then((r) => r.ok ? r.json() : { history: [] })
      .then((d) => setPriceHistory(d.history ?? []))
      .catch(() => setPriceHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, card?.id, historyDays]);

  if (!card) return null;

  const display = fullCard ?? card;
  const mainPrice = display.cardmarket?.prices;

  async function handleAddToPortfolio() {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tcgId: display.id,
          quantity,
          condition,
          variant,
          purchasePrice: mainPrice?.averageSellPrice ?? mainPrice?.trendPrice ?? null,
          lang,
        }),
      });
      if (res.ok) {
        setAdded(true);
        await onPortfolioChanged?.();
        setTimeout(() => setAdded(false), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setAddError("Connectez-vous pour ajouter des cartes à votre collection.");
        } else {
          setAddError(data.error ?? `Erreur ${res.status}`);
        }
      }
    } catch (err) {
      console.error("Failed to add to portfolio:", err);
      setAddError("Erreur réseau — vérifiez votre connexion.");
    } finally {
      setAdding(false);
    }
  }

  /**
   * Retire `qty` exemplaires d'une entrée Collection. Si qty ≥ quantité totale,
   * l'API supprime carrément l'entrée. Notifie le parent pour qu'il refresh.
   */
  async function handleRemove(entryId: string, qty: number) {
    const url = `/api/portfolio?id=${entryId}&quantity=${qty}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) await onPortfolioChanged?.();
  }

  const totalOwned = ownedEntries.reduce((s, e) => s + e.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors z-10"
        >
          ✕
        </button>

        <div className="flex gap-6">
          {/* Image de la carte — fallback FR → EN automatique */}
          <div className="relative h-80 w-56 shrink-0 overflow-hidden rounded-xl shadow-lg bg-[var(--card)]">
            {/* Skeleton shimmer tant que l'image charge */}
            {!imgLoaded && display.images?.large && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--border)] via-[var(--card)] to-[var(--border)]" />
            )}

            <CardImage
              src={display.images?.large}
              alt={display.name}
              fill
              className={`object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              sizes="224px"
              priority
              onLoad={() => setImgLoaded(true)}
              onFinalError={() => setImgLoaded(true)}
            />

            {/* Placeholder si aucune image disponible */}
            {!display.images?.large && (
              <div className="flex h-full items-center justify-center text-[var(--muted)]">
                <div className="text-center">
                  <p className="text-4xl mb-2">🃏</p>
                  <p className="text-xs">Image non disponible</p>
                </div>
              </div>
            )}
          </div>

          {/* Détails en français */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Nom + tabs */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold leading-tight">{display.name}</h2>
              <div className="flex shrink-0 gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-0.5">
                {(["info", "history"] as const).map((t) => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${activeTab === t ? "bg-[var(--primary)] text-black" : "text-[var(--muted)] hover:text-white"}`}>
                    {t === "info" ? "Infos" : "📈 Historique"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TAB: HISTORIQUE ───────────────────────────────────────── */}
            {activeTab === "history" && (
              <div className="flex flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--muted)]">Évolution du prix marché</p>
                  <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--background)] p-0.5">
                    {([30, 90] as const).map((d) => (
                      <button key={d} onClick={() => setHistoryDays(d)}
                        className={`rounded-lg px-2.5 py-0.5 text-xs font-bold transition-all ${historyDays === d ? "bg-[var(--primary)] text-black" : "text-[var(--muted)] hover:text-white"}`}>
                        {d}j
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-44">
                  {historyLoading ? (
                    <div className="flex h-full items-end gap-0.5">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="flex-1 animate-pulse rounded-t bg-white/5" style={{ height: `${30 + Math.sin(i * 0.6) * 25 + 20}%` }} />
                      ))}
                    </div>
                  ) : priceHistory.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={priceHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" stroke="#525252" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis stroke="#525252" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} width={38} />
                        <Tooltip
                          contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "10px", fontSize: "12px" }}
                          formatter={(v: number) => [formatPrice(v, "EUR"), "Prix"]}
                          labelFormatter={(l) => String(l)}
                        />
                        <Area type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} fill="url(#cardGrad)" dot={false} activeDot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted)]">
                      <p className="text-3xl">📊</p>
                      <p className="text-sm font-medium text-white">Pas encore d&apos;historique</p>
                      <p className="text-xs text-center">Les prix sont mis à jour toutes les heures. Revenez dans quelques heures.</p>
                    </div>
                  )}
                </div>
                {priceHistory.length >= 2 && (() => {
                  const first = priceHistory[0].price;
                  const last = priceHistory[priceHistory.length - 1].price;
                  const pct = first > 0 ? ((last - first) / first) * 100 : 0;
                  const isPos = pct >= 0;
                  return (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--card)] px-4 py-2.5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Variation {historyDays}j</p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: isPos ? "var(--success)" : "var(--danger)" }}>
                          {isPos ? "+" : ""}{pct.toFixed(2)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Prix actuel</p>
                        <p className="text-lg font-bold text-[var(--primary)] tabular-nums">{formatPrice(last, "EUR")}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── TAB: INFO ─────────────────────────────────────────────── */}
            {activeTab === "info" && <>

            {/* Badges */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {display.rarity && (
                <span className="rounded-full bg-[var(--primary)]/10 px-3 py-0.5 text-xs font-medium text-[var(--primary)]">
                  {display.rarity}
                </span>
              )}
              {display.stage && (
                <span className="rounded-full bg-[var(--border)] px-3 py-0.5 text-xs text-[var(--muted)]">
                  {display.stage}
                </span>
              )}
              {display.types?.map((t) => (
                <span key={t} className="rounded-full bg-[var(--border)] px-3 py-0.5 text-xs text-[var(--muted)]">
                  {t}
                </span>
              ))}
              {display.hp && (
                <span className="rounded-full bg-[var(--border)] px-3 py-0.5 text-xs text-[var(--muted)]">
                  PV {display.hp}
                </span>
              )}
            </div>

            <p className="mb-3 text-sm text-[var(--muted)]">
              {display.set.name} · #{display.number}
            </p>

            {/* Description française */}
            {loadingDetail && (
              <p className="mb-3 text-xs text-[var(--muted)] italic">Chargement des détails...</p>
            )}
            {display.description && (
              <p className="mb-3 text-xs text-[var(--muted)] italic leading-relaxed border-l-2 border-[var(--border)] pl-3">
                {display.description}
              </p>
            )}

            {/* Attaques en français */}
            {display.attacks && display.attacks.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Attaques
                </h3>
                <div className="space-y-2">
                  {display.attacks.map((atk, i) => (
                    <div key={i} className="rounded-lg bg-[var(--card)] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{atk.name}</span>
                        {atk.damage !== undefined && atk.damage !== "" && (
                          <span className="text-sm font-bold text-[var(--primary)]">
                            {atk.damage}
                          </span>
                        )}
                      </div>
                      {atk.effect && (
                        <p className="mt-1 text-xs text-[var(--muted)]">{atk.effect}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prix Cardmarket en EUR */}
            {mainPrice && (
              <div className="mb-4 space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Prix Cardmarket
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {mainPrice.trendPrice != null && (
                    <div className="rounded-lg bg-[var(--card)] px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Tendance</span>
                      <span className="font-bold text-[var(--primary)]">
                        {formatPrice(mainPrice.trendPrice, "EUR")}
                      </span>
                    </div>
                  )}
                  {mainPrice.averageSellPrice != null && (
                    <div className="rounded-lg bg-[var(--card)] px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Moyenne</span>
                      <span className="font-bold text-[var(--primary)]">
                        {formatPrice(mainPrice.averageSellPrice, "EUR")}
                      </span>
                    </div>
                  )}
                  {mainPrice.lowPrice != null && (
                    <div className="rounded-lg bg-[var(--card)] px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Prix bas</span>
                      <span className="text-sm text-[var(--muted)]">
                        {formatPrice(mainPrice.lowPrice, "EUR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Saisie manuelle de prix — visible si aucune cotation auto. */}
            {!mainPrice && <ManualPriceEntry cardId={display.id} />}

            </>}

            {/* Possessions actuelles — toujours visible */}
            {totalOwned > 0 && (
              <div className="mb-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                    Dans ma collection
                  </h3>
                  <span className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                    ×{totalOwned}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {ownedEntries.map((entry) => (
                    <OwnedEntryRow
                      key={entry.id}
                      entry={entry}
                      onRemove={(qty) => handleRemove(entry.id, qty)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Formulaire ajout portfolio — toujours visible */}
            <div className="mt-auto space-y-3 rounded-xl bg-[var(--card)] p-4">
              <h3 className="text-sm font-semibold">
                {totalOwned > 0 ? "Ajouter d'autres exemplaires" : "Ajouter au portfolio"}
              </h3>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <label className="mb-1 block text-xs text-[var(--muted)]">État</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as CardCondition)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
                  >
                    {CARD_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {CONDITION_LABELS_FR[c] ?? c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="mb-1 block text-xs text-[var(--muted)]">Variante</label>
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value as CardVariant)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
                  >
                    {CARD_VARIANTS.map((v) => (
                      <option key={v} value={v}>
                        {VARIANT_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-xs text-[var(--muted)]">Qté</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              {addError && (
                <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                  {addError}
                </div>
              )}
              <button
                onClick={handleAddToPortfolio}
                disabled={adding}
                className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-sm font-semibold text-black transition-all hover:bg-[var(--primary-hover)] hover:shadow-lg hover:shadow-[var(--primary)]/20 disabled:opacity-50"
              >
                {added ? "✓ Ajouté !" : adding ? "Ajout en cours..." : "Ajouter au portfolio"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Ligne d'entrée Collection avec retrait ──────────────────────────────────
 * Une carte peut exister sous plusieurs conditions (NM, MINT…) — on affiche
 * chaque ligne séparément avec ses propres boutons -1 et tout-retirer.
 * L'état `pending` désactive les actions pendant la requête réseau pour éviter
 * les doubles clics qui retireraient deux fois la même quantité.
 */
function OwnedEntryRow({
  entry,
  onRemove,
}: {
  entry: OwnedEntry;
  onRemove: (qty: number) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const conditionLabel = entry.condition ? CONDITION_LABELS_FR[entry.condition] ?? entry.condition : "—";
  const variantLabel = entry.variant && entry.variant !== "normal"
    ? VARIANT_LABELS[entry.variant as CardVariant] ?? entry.variant
    : null;

  async function remove(qty: number) {
    if (pending) return;
    setPending(true);
    try {
      await onRemove(qty);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--background)] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="rounded-md bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
          ×{entry.quantity}
        </span>
        <span className="text-xs text-[var(--muted)] truncate">{conditionLabel}</span>
        {variantLabel && (
          <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            {variantLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => remove(1)}
          disabled={pending}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40 disabled:opacity-40 transition-colors"
          title="Retirer un exemplaire"
        >
          −
        </button>
        <button
          onClick={() => remove(entry.quantity)}
          disabled={pending}
          className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-2 py-1 text-[10px] font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-40 transition-colors"
          title="Tout retirer"
        >
          {pending ? "…" : "Tout retirer"}
        </button>
      </div>
    </div>
  );
}

/* ─── Saisie manuelle de prix ─────────────────────────────────────────────────
 * Pour les cartes que les sources auto (Cardmarket / pokemontcg.io) ne cotent
 * pas — typiquement les JP, les promos rares, les sets obscurs. La valeur entre
 * dans PriceHistory avec source="manual" et nourrit ensuite tout le système
 * (portfolio, alerts, P&L).
 */
function ManualPriceEntry({ cardId }: { cardId: string }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Prix invalide");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: n }),
      });
      if (res.ok) {
        setSaved(true);
        setValue("");
        setTimeout(() => setSaved(false), 2500);
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
    <div className="mb-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base">💰</span>
        <p className="text-xs font-semibold text-[var(--muted)]">
          Pas de cotation automatique — saisis le prix marché que tu connais
        </p>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ex: 12.50"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-3 pr-8 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">€</span>
        </div>
        <button
          onClick={submit}
          disabled={saving || !value}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] disabled:opacity-40 transition-colors"
        >
          {saved ? "✓" : saving ? "..." : "Enregistrer"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
