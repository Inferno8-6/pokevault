"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { formatPrice } from "@pokemon/shared";
import { authedFetch } from "@/lib/fetch-helper";
import { PremiumBanner } from "@/components/premium-banner";

interface InvestorPosition {
  collectionId: string;
  tcgId: string;
  name: string;
  setName: string;
  number: string;
  imageSmall: string | null;
  language: string;
  quantity: number;
  purchasePrice: number | null;
  currentPrice: number | null;
  pnl: number;
  roi: number | null;
}

interface InvestorData {
  summary: {
    positionsTracked: number;
    positionsUntracked: number;
    totalCost: number;
    totalValue: number;
    totalPnL: number;
    totalROI: number | null;
    avgHoldingDays: number;
    annualizedROI: number | null;
  };
  topGainers: InvestorPosition[];
  topLosers: InvestorPosition[];
}

const LANG_FLAGS: Record<string, string> = { fr: "🇫🇷", en: "🇺🇸", ja: "🇯🇵" };

export default function InvestorPage() {
  const [data, setData] = useState<InvestorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPremium, setNeedsPremium] = useState(false);

  useEffect(() => {
    authedFetch("/api/portfolio/investor")
      .then(async (r) => {
        if (!r) return null;
        if (r.status === 403) { setNeedsPremium(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Mode Investisseur</h1>
            <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
              BETA
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            KPIs financiers sur les cartes avec un prix d&apos;achat saisi
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40 transition-colors"
        >
          ← Portfolio
        </Link>
      </div>

      {loading && <SkeletonState />}
      {!loading && needsPremium && (
        <PremiumBanner message="Le Mode Investisseur est réservé aux membres Premium." />
      )}
      {!loading && !needsPremium && !data && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-3xl mb-2">⚠️</p>
          <p className="font-semibold">Données indisponibles</p>
        </div>
      )}
      {!loading && data && <InvestorDashboard data={data} />}
    </div>
  );
}

function InvestorDashboard({ data }: { data: InvestorData }) {
  const { summary } = data;

  if (summary.positionsTracked === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
        <p className="text-5xl mb-3">💼</p>
        <p className="font-semibold text-lg">Aucune position trackée</p>
        <p className="mt-2 max-w-md mx-auto text-sm text-[var(--muted)]">
          Saisis un <strong>prix d&apos;achat</strong> sur tes cartes pour
          activer le suivi P&L, ROI et le calcul du rendement annualisé.
          {summary.positionsUntracked > 0 && (
            <>
              {" "}Tu as actuellement <strong>{summary.positionsUntracked}</strong>{" "}
              ligne(s) sans prix d&apos;achat.
            </>
          )}
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-bold text-black hover:bg-[var(--primary-hover)] transition-colors"
        >
          Aller au portfolio
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* KPIs principaux */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Coût total"
          value={formatPrice(summary.totalCost, "EUR")}
          sub={`${summary.positionsTracked} position${summary.positionsTracked > 1 ? "s" : ""}`}
          icon="🧾"
          accent="var(--muted)"
        />
        <KpiCard
          label="Valeur actuelle"
          value={formatPrice(summary.totalValue, "EUR")}
          sub="Prix marché live"
          icon="💰"
          accent="var(--accent)"
        />
        <KpiCard
          label="P&L total"
          value={`${summary.totalPnL >= 0 ? "+" : ""}${formatPrice(summary.totalPnL, "EUR")}`}
          sub={summary.totalROI !== null ? `${(summary.totalROI * 100).toFixed(1)}% sur coût` : ""}
          icon="🎯"
          accent={summary.totalPnL >= 0 ? "var(--success)" : "var(--danger)"}
          positive={summary.totalPnL >= 0}
        />
        <KpiCard
          label="ROI annualisé"
          value={
            summary.annualizedROI !== null
              ? `${summary.annualizedROI >= 0 ? "+" : ""}${(summary.annualizedROI * 100).toFixed(1)}%`
              : "—"
          }
          sub={
            summary.avgHoldingDays > 0
              ? `Holding moyen ${Math.round(summary.avgHoldingDays)} j`
              : ""
          }
          icon="📈"
          accent={
            summary.annualizedROI !== null && summary.annualizedROI >= 0
              ? "var(--success)"
              : "var(--danger)"
          }
          positive={summary.annualizedROI !== null && summary.annualizedROI >= 0}
        />
      </div>

      {/* Hint sur les positions non-trackées */}
      {summary.positionsUntracked > 0 && (
        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm">
          ℹ️ <strong>{summary.positionsUntracked}</strong> ligne(s) sans prix
          d&apos;achat sont exclues des calculs. Renseigne-les depuis le
          portfolio pour qu&apos;elles apparaissent ici.
        </div>
      )}

      {/* Top movers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MoversPanel title="🏆 Meilleurs paris" positions={data.topGainers} colorPositive />
        <MoversPanel title="📉 Pires positions" positions={data.topLosers} colorPositive={false} />
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[var(--muted)] italic">
        Les valeurs supposent une revente immédiate au prix marché Cardmarket /
        pokemontcg.io. Frais de vente (~10%), shipping et fiscalité non inclus.
        ROI annualisé borné à ±1000 % pour les détentions très courtes.
      </p>
    </>
  );
}

function MoversPanel({
  title,
  positions,
  colorPositive,
}: {
  title: string;
  positions: InvestorPosition[];
  colorPositive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {positions.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted)]">Aucune position</p>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => {
            const isPositive = p.pnl >= 0;
            const color = isPositive ? "var(--success)" : "var(--danger)";
            return (
              <div
                key={p.collectionId}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
              >
                {p.imageSmall ? (
                  <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded">
                    <CardImage src={p.imageSmall} alt={p.name} fill className="object-contain" sizes="36px" />
                  </div>
                ) : (
                  <div className="h-12 w-9 shrink-0 rounded bg-[var(--card)] flex items-center justify-center text-xs text-[var(--muted)]">
                    🃏
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {p.name}
                    {p.language !== "fr" && (
                      <span className="ml-1.5 text-xs">{LANG_FLAGS[p.language] ?? ""}</span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {p.setName} · ×{p.quantity}
                    {p.purchasePrice != null && (
                      <span className="ml-1">· Achat {formatPrice(p.purchasePrice, "EUR")}</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums" style={{ color: colorPositive ? color : color }}>
                    {isPositive ? "+" : ""}
                    {formatPrice(p.pnl, "EUR")}
                  </p>
                  {p.roi !== null && (
                    <p className="text-[10px] tabular-nums" style={{ color }}>
                      {isPositive ? "+" : ""}
                      {(p.roi * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
  positive?: boolean;
}) {
  const valueColor =
    positive === true ? "var(--success)" : positive === false ? "var(--danger)" : "white";
  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-[var(--card)] p-5"
      style={{ borderColor: `${accent}28` }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at top right, ${accent}10, transparent 65%)` }}
      />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            {label}
          </p>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl text-lg"
            style={{ background: `${accent}15` }}
          >
            {icon}
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: valueColor }}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-2xl animate-pulse bg-white/5" />
        <div className="h-64 rounded-2xl animate-pulse bg-white/5" />
      </div>
    </div>
  );
}
