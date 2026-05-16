"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CardImage } from "@/components/card-image";
import { formatPrice, VARIANT_LABELS } from "@pokemon/shared";
import type { CardVariant } from "@pokemon/shared";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ImportSetModal } from "@/components/import-set-modal";
import { ScanModal } from "@/components/scan-modal";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface PortfolioItem {
  id: string; cardId: string; tcgId: string; name: string; setName: string;
  number: string; rarity: string | null; imageSmall: string | null;
  language: string;
  quantity: number; condition: string | null; variant: string | null;
  purchasePrice: number | null;
  currentPrice: number; previousPrice: number; changePct: number;
  change7d: number; sparkline: number[];
  totalValue: number; addedAt: string;
}

const LANG_FLAGS: Record<string, string> = { fr: "🇫🇷", en: "🇺🇸", ja: "🇯🇵" };

interface PortfolioStats {
  totalCards: number; totalValue: number; change24h: number; topCard: string;
}

interface Mover {
  id: string; name: string; setName: string; imageSmall: string | null;
  currentPrice: number; changePct: number; changeAbs: number; quantity: number; totalValue: number;
}

type SortKey = "value_desc" | "value_asc" | "name" | "pl" | "change" | "added";
type ChartPeriod = "7d" | "30d";
type CompositionBy = "set" | "rarity";

/* ─── Rareté couleurs ─────────────────────────────────────────────────────── */

const RARITY_COLORS: Record<string, string> = {
  "commune": "#6b7280", "peu commune": "#22c55e", "rare": "#3b82f6",
  "holo": "#8b5cf6", "ultra": "#f59e0b", "secrète": "#ef4444",
  "arc-en-ciel": "#ec4899", "promo": "#06b6d4",
};
const PALETTE = ["#f59e0b","#3b82f6","#22c55e","#8b5cf6","#ef4444","#06b6d4","#ec4899","#f97316","#84cc16","#a855f7"];

function rarityColor(r: string | null) {
  if (!r) return "#6b7280";
  const low = r.toLowerCase();
  for (const [k, v] of Object.entries(RARITY_COLORS)) if (low.includes(k)) return v;
  return "#6b7280";
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 items-center gap-4 rounded-xl px-3 py-3 animate-pulse">
      <div className="col-span-5 flex items-center gap-3">
        <div className="h-12 w-9 rounded bg-white/5" />
        <div className="space-y-2 flex-1"><div className="h-3 w-32 rounded bg-white/5" /><div className="h-2 w-20 rounded bg-white/5" /></div>
      </div>
      {[2,1,2,2].map((span, i) => (
        <div key={i} className={`col-span-${span} flex justify-end`}><div className="h-3 w-14 rounded bg-white/5" /></div>
      ))}
    </div>
  );
}

/* ─── Sparkline ───────────────────────────────────────────────────────────── */

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;
  const W = 52, H = 18, pad = 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (W - 2 * pad);
      const y = H - pad - ((v - min) / range) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "var(--success)" : "var(--danger)";
  return (
    <svg width={W} height={H} className="shrink-0 opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, icon, accent, positive, loading }: {
  label: string; value: string; sub?: string; icon: string;
  accent: string; positive?: boolean; loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-[var(--card)] p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
      style={{ borderColor: `${accent}28` }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at top right, ${accent}0d, transparent 65%)` }} />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-lg" style={{ background: `${accent}15` }}>{icon}</span>
        </div>
        {loading ? (
          <div className="space-y-2"><div className="h-7 w-28 animate-pulse rounded-lg bg-white/5" /><div className="h-3 w-20 animate-pulse rounded bg-white/5" /></div>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums" style={{ color: positive === true ? "var(--success)" : positive === false ? "var(--danger)" : "white" }}>{value}</p>
            {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Mover card ──────────────────────────────────────────────────────────── */

function MoverCard({ mover, type }: { mover: Mover; type: "gain" | "loss" }) {
  const color = type === "gain" ? "var(--success)" : "var(--danger)";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 hover:border-[var(--primary)]/30 transition-all">
      {mover.imageSmall ? (
        <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded shadow">
          <CardImage src={mover.imageSmall} alt={mover.name} fill className="object-contain" sizes="32px" />
        </div>
      ) : (
        <div className="h-10 w-8 shrink-0 rounded bg-[var(--card)] flex items-center justify-center text-xs text-[var(--muted)]">?</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{mover.name}</p>
        <p className="truncate text-xs text-[var(--muted)]">{mover.setName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums" style={{ color }}>
          {type === "gain" ? "+" : ""}{mover.changePct.toFixed(2)}%
        </p>
        <p className="text-xs tabular-nums text-[var(--muted)]">{formatPrice(mover.currentPrice, "EUR")}</p>
      </div>
    </div>
  );
}

/* ─── Donut tooltip ───────────────────────────────────────────────────────── */

function DonutTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pct: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{name}</p>
      <p className="text-[var(--muted)]">{formatPrice(value, "EUR")} · {p.pct.toFixed(1)}%</p>
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({ totalCards: 0, totalValue: 0, change24h: 0, topCard: "-" });
  const [chartHistory, setChartHistory] = useState<{ date: string; value: number }[]>([]);
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [sealedSummary, setSealedSummary] = useState<{ totalValue: number; totalQty: number; productCount: number; pnl: number | null } | null>(null);
  const [bindersCount, setBindersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string; quantity: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("value_desc");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30d");
  const [compositionBy, setCompositionBy] = useState<CompositionBy>("set");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"collection" | "composition" | "movers">("collection");

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [portfolioRes, statsRes, historyRes, moversRes, sealedRes, bindersRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/portfolio/stats"),
        fetch("/api/portfolio/history"),
        fetch("/api/portfolio/movers"),
        fetch("/api/sealed"),
        fetch("/api/binders"),
      ]);
      const [portfolio, statsData, historyData, moversData, sealedData, bindersData] = await Promise.all([
        portfolioRes.ok ? portfolioRes.json() : { items: [] },
        statsRes.ok ? statsRes.json() : null,
        historyRes.ok ? historyRes.json() : { history: [] },
        moversRes.ok ? moversRes.json() : { gainers: [], losers: [] },
        sealedRes.ok ? sealedRes.json() : { summary: null },
        bindersRes.ok ? bindersRes.json() : { binders: [] },
      ]);
      setItems(portfolio.items ?? []);
      if (statsData) setStats(statsData);
      setChartHistory(historyData.history ?? []);
      setGainers(moversData.gainers ?? []);
      setLosers(moversData.losers ?? []);
      setSealedSummary(sealedData.summary ?? null);
      setBindersCount(bindersData.binders?.length ?? 0);
    } catch {
      showToast("Erreur lors du chargement", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleRemove(collectionId: string, quantity?: number) {
    const url = quantity ? `/api/portfolio?id=${collectionId}&quantity=${quantity}` : `/api/portfolio?id=${collectionId}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) { showToast("Erreur lors de la suppression", "error"); setRemoveTarget(null); return; }
    const data = await res.json();
    if (data.deleted) setItems((p) => p.filter((i) => i.id !== collectionId));
    else setItems((p) => p.map((i) => i.id === collectionId ? { ...i, quantity: data.newQuantity } : i));
    const s = await fetch("/api/portfolio/stats");
    if (s.ok) setStats(await s.json());
    setRemoveTarget(null);
  }

  /* ─── Computed ────────────────────────────────────────────────────────── */

  const sortedItems = useMemo(() => [...items]
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.setName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "value_desc") return b.totalValue - a.totalValue;
      if (sortKey === "value_asc") return a.totalValue - b.totalValue;
      if (sortKey === "change") return b.changePct - a.changePct;
      if (sortKey === "added") return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sortKey === "pl") {
        const pa = a.purchasePrice ? (a.currentPrice - a.purchasePrice) * a.quantity : -Infinity;
        const pb = b.purchasePrice ? (b.currentPrice - b.purchasePrice) * b.quantity : -Infinity;
        return pb - pa;
      }
      return 0;
    }), [items, search, sortKey]);

  const compositionData = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = compositionBy === "set" ? item.setName : (item.rarity ?? "Inconnue");
      map.set(key, (map.get(key) ?? 0) + item.totalValue);
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, pct: total > 0 ? (value / total) * 100 : 0 }));
  }, [items, compositionBy]);

  const chartData = useMemo(() => {
    if (chartHistory.length < 2) {
      const v = items.reduce((s, i) => s + i.totalValue, 0);
      return items.length > 0 ? [{ date: "Début", value: v }, { date: "Auj.", value: v }] : null;
    }
    return chartPeriod === "7d" ? chartHistory.slice(-7) : chartHistory;
  }, [chartHistory, chartPeriod, items]);

  const totalPL = items.reduce((s, i) => i.purchasePrice ? s + (i.currentPrice - i.purchasePrice) * i.quantity : s, 0);
  const hasPL = items.some((i) => i.purchasePrice);
  const hasMovers = gainers.length > 0 || losers.length > 0;

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-sm transition-all ${toast.type === "success" ? "border-[var(--success)]/30 bg-[var(--background)]/90 text-[var(--success)]" : "border-[var(--danger)]/30 bg-[var(--background)]/90 text-[var(--danger)]"}`}>
          <span className="text-xl">{toast.type === "success" ? "✅" : "⚠️"}</span>
          <p className="text-sm font-medium">{toast.msg}</p>
          <button onClick={() => setToast(null)} className="ml-1 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {loading ? "Chargement…" : `${stats.totalCards} cartes · ${formatPrice(stats.totalValue, "EUR")} de valeur totale`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href="/investor"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--accent)] transition-all hover:bg-[var(--accent)]/20"
            title="Mode Investisseur — ROI, P&L, holding period">
            💼 Investisseur
          </a>
          <a href="/api/portfolio/export" download
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)] transition-all hover:border-[var(--primary)]/40 hover:text-white">
            ↓ CSV
          </a>
          <button onClick={() => setShowScan(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)] transition-all hover:border-[var(--primary)]/40 hover:text-white">
            📷 Scanner
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-all hover:bg-[var(--primary)]/20">
            + Importer une série
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={loading} label="Total cartes" value={String(stats.totalCards)} sub={`${items.length} ligne${items.length !== 1 ? "s" : ""}`} icon="🃏" accent="#f59e0b" />
        <StatCard loading={loading} label="Valeur portfolio" value={formatPrice(stats.totalValue, "EUR")} sub={stats.topCard !== "-" ? `Top: ${stats.topCard}` : "Aucune carte"} icon="💰" accent="#22c55e" />
        <StatCard loading={loading} label="Variation 24h" value={`${stats.change24h >= 0 ? "+" : ""}${stats.change24h.toFixed(2)}%`} sub={stats.change24h >= 0 ? "En hausse" : "En baisse"} icon={stats.change24h >= 0 ? "📈" : "📉"} accent={stats.change24h >= 0 ? "#22c55e" : "#ef4444"} positive={stats.change24h >= 0} />
        <StatCard loading={loading} label="P&L total" value={hasPL ? `${totalPL >= 0 ? "+" : ""}${formatPrice(totalPL, "EUR")}` : "—"} sub={!hasPL ? "Ajoutez un prix d'achat" : totalPL >= 0 ? "Bénéfice net" : "Perte nette"} icon="🎯" accent="#8b5cf6" positive={hasPL ? totalPL >= 0 : undefined} />
      </div>

      {/* ── Autres actifs : scellés + classeurs ── */}
      {!loading && ((sealedSummary && sealedSummary.productCount > 0) || bindersCount > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sealedSummary && sealedSummary.productCount > 0 && (
            <a href="/sealed" className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)]/30 hover:scale-[1.01]">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: "radial-gradient(ellipse at right, var(--primary), transparent 60%)" }} />
              <div className="relative flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-2xl">🎁</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Produits scellés</p>
                  <p className="text-xl font-black text-[var(--primary)] tabular-nums">{formatPrice(sealedSummary.totalValue, "EUR")}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {sealedSummary.totalQty} produit{sealedSummary.totalQty > 1 ? "s" : ""}
                    {sealedSummary.pnl != null && (
                      <span className={sealedSummary.pnl >= 0 ? " text-[var(--success)]" : " text-[var(--danger)]"}>
                        {" "}· {sealedSummary.pnl >= 0 ? "+" : ""}{formatPrice(sealedSummary.pnl, "EUR")} P&L
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-[var(--border)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all">→</span>
              </div>
            </a>
          )}
          {bindersCount > 0 && (
            <a href="/binders" className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--accent)]/30 hover:scale-[1.01]">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: "radial-gradient(ellipse at right, var(--accent), transparent 60%)" }} />
              <div className="relative flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-2xl">📚</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Classeurs</p>
                  <p className="text-xl font-black text-[var(--accent)] tabular-nums">{bindersCount}</p>
                  <p className="text-xs text-[var(--muted)]">classeur{bindersCount > 1 ? "s" : ""} cré&eacute;{bindersCount > 1 ? "s" : ""}</p>
                </div>
                <span className="text-[var(--border)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all">→</span>
              </div>
            </a>
          )}
        </div>
      )}

      {/* ── Graphique évolution ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Évolution de la valeur</h2>
          {chartHistory.length >= 2 && (
            <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
              {(["7d", "30d"] as ChartPeriod[]).map((p) => (
                <button key={p} onClick={() => setChartPeriod(p)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${chartPeriod === p ? "bg-[var(--primary)] text-black shadow" : "text-[var(--muted)] hover:text-white"}`}>
                  {p === "7d" ? "7 jours" : "30 jours"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-52">
          {loading ? (
            <div className="flex h-full items-end gap-0.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="flex-1 animate-pulse rounded-t bg-white/5" style={{ height: `${25 + Math.sin(i * 0.5) * 20 + 30}%` }} />
              ))}
            </div>
          ) : chartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "12px", fontSize: "13px" }} formatter={(v: number) => [formatPrice(v, "EUR"), "Valeur"]} />
                <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted)]">
              <p className="text-4xl">📊</p>
              <p className="font-semibold text-white">Ajoutez des cartes pour voir l&apos;évolution</p>
              <p className="text-xs">Graphique alimenté à chaque mise à jour des prix (toutes les heures)</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs : Collection / Composition / Movers ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--border)]">
          {([
            { key: "collection", label: "Collection", badge: items.length > 0 ? items.length : null },
            { key: "composition", label: "Composition", badge: null },
            { key: "movers", label: "Top Movers", badge: hasMovers ? gainers.length + losers.length : null },
          ] as { key: typeof activeTab; label: string; badge: number | null }[]).map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold transition-all border-b-2 ${activeTab === tab.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-white"}`}>
              {tab.label}
              {tab.badge != null && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeTab === tab.key ? "bg-[var(--primary)] text-black" : "bg-[var(--card-hover)] text-[var(--muted)]"}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ──── TAB: COLLECTION ──────────────────────────────────────── */}
          {activeTab === "collection" && (
            <>
              {items.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="Rechercher une carte…" value={search} onChange={(e) => setSearch(e.target.value)}
                      className="w-44 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm outline-none transition-all placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:w-56" />
                  </div>
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]">
                    <option value="value_desc">Valeur ↓</option>
                    <option value="value_asc">Valeur ↑</option>
                    <option value="change">Variation 24h ↓</option>
                    <option value="name">Nom A→Z</option>
                    <option value="pl">P&L ↓</option>
                    <option value="added">Plus récent</option>
                  </select>
                </div>
              )}

              {loading && <div className="space-y-1">{Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)}</div>}

              {!loading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="mb-3 text-5xl">📦</p>
                  <p className="mb-1 text-lg font-bold">Collection vide</p>
                  <p className="mb-5 text-sm text-[var(--muted)]">Explorez les cartes et ajoutez-les à votre portfolio</p>
                  <button onClick={() => setShowImport(true)}
                    className="rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-5 py-2 text-sm font-semibold text-[var(--primary)] transition-all hover:bg-[var(--primary)]/20">
                    + Importer une série entière
                  </button>
                </div>
              )}

              {!loading && sortedItems.length === 0 && items.length > 0 && (
                <div className="py-8 text-center text-sm text-[var(--muted)]">Aucune carte pour &quot;{search}&quot;</div>
              )}

              {!loading && sortedItems.length > 0 && (
                <>
                  <div className="mb-2 grid grid-cols-12 gap-3 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                    <div className="col-span-4">Carte</div>
                    <div className="col-span-2 text-right">Prix</div>
                    <div className="col-span-1 text-center">Qté</div>
                    <div className="col-span-2 text-right">Valeur</div>
                    <div className="col-span-1 text-center">7j</div>
                    <div className="col-span-2 text-right">24h / P&L</div>
                  </div>

                  <div className="space-y-0.5">
                    {sortedItems.map((item) => {
                      const pl = item.purchasePrice ? (item.currentPrice - item.purchasePrice) * item.quantity : null;
                      const rc = rarityColor(item.rarity);
                      const hasChange = item.changePct !== 0;
                      return (
                        <div key={item.id} className="group grid grid-cols-12 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--background)]">
                          <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="absolute -left-1 top-1 bottom-1 w-0.5 rounded-full opacity-80" style={{ background: rc }} />
                              {item.imageSmall ? (
                                <div className="relative h-11 w-8 overflow-hidden rounded shadow-sm">
                                  <CardImage src={item.imageSmall} alt={item.name} fill className="object-contain" sizes="32px" />
                                </div>
                              ) : (
                                <div className="h-11 w-8 rounded bg-[var(--background)] flex items-center justify-center text-xs text-[var(--muted)]">?</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold leading-tight">
                                {item.name}
                                {item.language !== "fr" && (
                                  <span className="ml-1.5 text-xs" title={`Langue : ${item.language.toUpperCase()}`}>
                                    {LANG_FLAGS[item.language] ?? "🌐"}
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-[11px] text-[var(--muted)]">
                                {item.setName} · #{item.number}
                                {item.rarity && <span className="ml-1.5 font-medium" style={{ color: rc }}>{item.rarity}</span>}
                                {item.variant && item.variant !== "normal" && (
                                  <span className="ml-1.5 rounded bg-[var(--accent)]/15 px-1 py-px text-[10px] font-medium text-[var(--accent)]">
                                    {VARIANT_LABELS[item.variant as CardVariant] ?? item.variant}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="col-span-2 text-right text-sm tabular-nums text-[var(--muted)]">
                            {formatPrice(item.currentPrice, "EUR")}
                          </div>

                          <div className="col-span-1 text-center">
                            <span className="rounded-md bg-[var(--background)] px-1.5 py-0.5 text-xs font-bold text-white group-hover:bg-[var(--card)]">×{item.quantity}</span>
                          </div>

                          <div className="col-span-2 text-right text-sm font-bold tabular-nums text-[var(--primary)]">
                            {formatPrice(item.totalValue, "EUR")}
                          </div>

                          <div className="col-span-1 flex items-center justify-center">
                            {item.sparkline.length >= 2 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <Sparkline data={item.sparkline} positive={item.change7d >= 0} />
                                {item.change7d !== 0 && (
                                  <span className={`text-[9px] font-bold tabular-nums ${item.change7d > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                                    {item.change7d > 0 ? "+" : ""}{item.change7d.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)]">—</span>
                            )}
                          </div>

                          <div className="col-span-2 flex items-center justify-end gap-1.5">
                            <div className="text-right">
                              {hasChange && (
                                <p className={`text-xs font-bold tabular-nums ${item.changePct > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                                  {item.changePct > 0 ? "▲" : "▼"} {Math.abs(item.changePct).toFixed(1)}%
                                </p>
                              )}
                              {pl !== null ? (
                                <p className={`text-[11px] tabular-nums ${pl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                                  {pl >= 0 ? "+" : ""}{formatPrice(pl, "EUR")}
                                </p>
                              ) : !hasChange ? (
                                <p className="text-xs text-[var(--muted)]">—</p>
                              ) : null}
                            </div>
                            <button
                              onClick={() => item.quantity > 1 ? setRemoveTarget({ id: item.id, name: item.name, quantity: item.quantity }) : handleRemove(item.id)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs text-[var(--muted)] opacity-0 transition-all hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] group-hover:opacity-100">
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm">
                    <span className="text-[var(--muted)]">{sortedItems.length} carte{sortedItems.length !== 1 ? "s" : ""}{search && ` sur ${items.length}`}</span>
                    <span className="font-bold text-[var(--primary)]">Total : {formatPrice(sortedItems.reduce((s, i) => s + i.totalValue, 0), "EUR")}</span>
                  </div>
                </>
              )}
            </>
          )}

          {/* ──── TAB: COMPOSITION ─────────────────────────────────────── */}
          {activeTab === "composition" && (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-[var(--muted)]">Répartition de la valeur du portfolio</p>
                <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
                  {(["set", "rarity"] as CompositionBy[]).map((k) => (
                    <button key={k} onClick={() => setCompositionBy(k)}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${compositionBy === k ? "bg-[var(--primary)] text-black" : "text-[var(--muted)] hover:text-white"}`}>
                      {k === "set" ? "Par série" : "Par rareté"}
                    </button>
                  ))}
                </div>
              </div>

              {loading || items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--muted)]">
                  <p className="text-4xl mb-3">🥧</p>
                  <p className="font-semibold text-white">Aucune donnée à afficher</p>
                  <p className="text-xs mt-1">Ajoutez des cartes à votre portfolio</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 lg:flex-row">
                  <div className="h-64 w-full max-w-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={compositionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                          {compositionData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="transparent" />)}
                        </Pie>
                        <Tooltip content={<DonutTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    {compositionData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-3">
                        <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{entry.name}</p>
                            <p className="shrink-0 text-xs font-bold text-[var(--primary)]">{formatPrice(entry.value, "EUR")}</p>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--background)]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${entry.pct}%`, background: PALETTE[i % PALETTE.length] }} />
                          </div>
                          <p className="mt-0.5 text-right text-[10px] text-[var(--muted)]">{entry.pct.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── TAB: TOP MOVERS ──────────────────────────────────────── */}
          {activeTab === "movers" && (
            <div>
              {loading || !hasMovers ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--muted)]">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="font-semibold text-white">Pas encore de variations disponibles</p>
                  <p className="text-xs mt-1">Les movers apparaissent dès que les prix sont mis à jour deux fois</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-base">📈</span>
                      <h3 className="text-sm font-bold text-[var(--success)]">Top Gainers</h3>
                    </div>
                    <div className="space-y-2">
                      {gainers.length > 0 ? gainers.map((m) => <MoverCard key={m.id} mover={m} type="gain" />) : (
                        <p className="text-sm text-[var(--muted)] py-4 text-center">Aucune hausse détectée</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-base">📉</span>
                      <h3 className="text-sm font-bold text-[var(--danger)]">Top Losers</h3>
                    </div>
                    <div className="space-y-2">
                      {losers.length > 0 ? losers.map((m) => <MoverCard key={m.id} mover={m} type="loss" />) : (
                        <p className="text-sm text-[var(--muted)] py-4 text-center">Aucune baisse détectée</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showImport && <ImportSetModal onClose={() => setShowImport(false)} onImported={(n) => { setShowImport(false); showToast(`${n} carte${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""} !`); fetchAll(); }} />}
      {showScan && <ScanModal onClose={() => setShowScan(false)} onAddToPortfolio={() => { fetchAll(); setShowScan(false); }} />}
      {removeTarget && <RemoveQtyModal item={removeTarget} onConfirm={(q) => handleRemove(removeTarget.id, q)} onClose={() => setRemoveTarget(null)} />}
    </div>
  );
}

/* ─── RemoveQtyModal ──────────────────────────────────────────────────────── */

function RemoveQtyModal({ item, onConfirm, onClose }: { item: { id: string; name: string; quantity: number }; onConfirm: (q: number) => void; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const clamp = (v: number) => Math.min(item.quantity, Math.max(1, v));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Retirer des exemplaires</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{item.name} · <strong className="text-white">{item.quantity}</strong> en collection</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white">✕</button>
        </div>
        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium">Quantité à retirer</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => clamp(q - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-xl font-bold transition-colors hover:border-[var(--primary)]/50">−</button>
            <input type="number" min={1} max={item.quantity} value={qty} onChange={(e) => setQty(clamp(parseInt(e.target.value) || 1))}
              className="w-20 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-center text-lg font-bold outline-none focus:border-[var(--primary)]" />
            <button onClick={() => setQty((q) => clamp(q + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-xl font-bold transition-colors hover:border-[var(--primary)]/50">+</button>
            <button onClick={() => setQty(item.quantity)} className="text-xs text-[var(--muted)] underline transition-colors hover:text-white">Tout ({item.quantity})</button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--primary)]/40">Annuler</button>
          <button onClick={() => onConfirm(qty)} className="flex-1 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 py-2.5 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/20">
            {qty >= item.quantity ? "Retirer tout" : `Retirer ×${qty}`}
          </button>
        </div>
      </div>
    </div>
  );
}
