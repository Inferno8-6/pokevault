"use client";

import { useEffect, useState, useCallback } from "react";
import { CardImage } from "@/components/card-image";
import { formatPrice } from "@pokemon/shared";

interface Mover {
  tcgId: string;
  name: string;
  setName: string;
  number: string;
  imageSmall: string | null;
  currentPrice: number;
  previousPrice: number;
  changePct: number;
  changeAbs: number;
}

interface MarketData {
  gainers: Mover[];
  losers: Mover[];
  total: number;
  period: string;
}

type Period = "24h" | "7d";

function MoverRow({ mover, rank }: { mover: Mover; rank: number }) {
  const isPos = mover.changePct >= 0;
  const color = isPos ? "var(--success)" : "var(--danger)";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 hover:border-[var(--primary)]/30 transition-all group">
      <span className="w-5 text-center text-xs font-bold text-[var(--muted)]">#{rank}</span>
      {mover.imageSmall ? (
        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded shadow">
          <CardImage src={mover.imageSmall} alt={mover.name} fill className="object-contain" sizes="36px" />
        </div>
      ) : (
        <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-[var(--card)] text-sm">🃏</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{mover.name}</p>
        <p className="truncate text-[11px] text-[var(--muted)]">{mover.setName} · #{mover.number}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums" style={{ color }}>
          {isPos ? "+" : ""}{mover.changePct.toFixed(2)}%
        </p>
        <p className="text-xs tabular-nums text-[var(--muted)]">{formatPrice(mover.currentPrice, "EUR")}</p>
      </div>
      <div
        className="shrink-0 w-16 text-right"
        title={`${isPos ? "+" : ""}${mover.changeAbs.toFixed(2)} € de variation absolue`}
      >
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{ background: `${color}18`, color }}
        >
          {isPos ? "+" : ""}{mover.changeAbs.toFixed(2)}€
        </span>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-3 animate-pulse">
          <div className="w-5 h-3 rounded bg-white/5" />
          <div className="h-12 w-9 rounded bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-white/5" />
            <div className="h-2 w-20 rounded bg-white/5" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-4 w-14 rounded bg-white/5" />
            <div className="h-3 w-10 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("24h");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/movers?limit=10&period=${period}`);
      if (res.ok) {
        setData(await res.json());
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isEmpty = data && data.gainers.length === 0 && data.losers.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Marché</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Top movers parmi toutes les cartes indexées
            {lastUpdated && (
              <span className="ml-2 text-[10px] text-[var(--muted)]/60">
                · Mis à jour {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
            {(["24h", "7d"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${period === p ? "bg-[var(--primary)] text-black shadow" : "text-[var(--muted)] hover:text-white"}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted)] transition-all hover:border-[var(--primary)]/40 hover:text-white disabled:opacity-50"
            title="Rafraîchir">
            {loading ? "⟳" : "↺"}
          </button>
        </div>
      </div>

      {/* Summary stat */}
      {data && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
          <p className="text-sm text-[var(--muted)]">
            <span className="font-bold text-white">{data.total}</span> carte{data.total !== 1 ? "s" : ""} avec variation détectée
            {" "}sur la période <span className="font-bold text-[var(--primary)]">{period}</span>.
            {data.total === 0 && " Les prix sont mis à jour toutes les heures — revenez plus tard."}
          </p>
        </div>
      )}

      {/* Main grid */}
      {isEmpty ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-16 text-center">
          <p className="text-5xl mb-3">📊</p>
          <p className="text-lg font-semibold">Pas encore de données de marché</p>
          <p className="mt-2 text-sm text-[var(--muted)] max-w-md mx-auto">
            Les variations de prix apparaissent dès que le cron de mise à jour a tourné au moins deux fois.
            Revenez dans une heure.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Gainers */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-lg">🚀</span>
              <h2 className="font-bold text-[var(--success)]">Top Gainers</h2>
              <span className="ml-auto text-xs text-[var(--muted)]">{period}</span>
            </div>
            {loading ? (
              <SkeletonRows />
            ) : data?.gainers.length ? (
              <div className="space-y-2">
                {data.gainers.map((m, i) => (
                  <MoverRow key={m.tcgId} mover={m} rank={i + 1} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--muted)]">Aucune hausse détectée</p>
            )}
          </div>

          {/* Losers */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-lg">📉</span>
              <h2 className="font-bold text-[var(--danger)]">Top Losers</h2>
              <span className="ml-auto text-xs text-[var(--muted)]">{period}</span>
            </div>
            {loading ? (
              <SkeletonRows />
            ) : data?.losers.length ? (
              <div className="space-y-2">
                {data.losers.map((m, i) => (
                  <MoverRow key={m.tcgId} mover={m} rank={i + 1} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--muted)]">Aucune baisse détectée</p>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-[var(--muted)] italic">
        Variations calculées à partir des prix Cardmarket / pokemontcg.io indexés dans PokeVault.
        Les cartes non encore indexées n&apos;apparaissent pas ici. Prix mis à jour toutes les heures.
      </p>
    </div>
  );
}
