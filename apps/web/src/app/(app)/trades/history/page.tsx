"use client";

import { useState, useEffect } from "react";
import { CardImage } from "@/components/card-image";
import Link from "next/link";

interface TradeCard {
  name: string;
  setName: string;
  number: string;
  imageSmall: string | null;
}

interface TradeItem {
  id: string;
  direction: string;
  card: TradeCard;
}

interface Partner {
  id: string;
  name: string | null;
  image: string | null;
}

interface Match {
  partner: Partner;
  partnerItems: TradeItem[];
  matchedAt: string;
}

interface TradeHistory {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  myItems: TradeItem[];
  matches: Match[];
}

export default function TradeHistoryPage() {
  const [history, setHistory] = useState<TradeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, []);

  const completed = history.filter((h) => h.status === "completed");
  const cancelled = history.filter((h) => h.status === "cancelled");

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/trades"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Historique des échanges</h1>
          <p className="text-[var(--muted)]">Vos offres terminées et annulées</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Aucun historique</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Vos échanges terminés et annulés apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Complétés */}
          {completed.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success)]/20 text-sm text-[var(--success)]">✓</span>
                Échanges complétés
                <span className="rounded-full bg-[var(--success)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
                  {completed.length}
                </span>
              </h2>
              <div className="space-y-3">
                {completed.map((trade) => (
                  <TradeHistoryCard key={trade.id} trade={trade} />
                ))}
              </div>
            </section>
          )}

          {/* Annulés */}
          {cancelled.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--danger)]/20 text-sm text-[var(--danger)]">✕</span>
                Échanges annulés
                <span className="rounded-full bg-[var(--danger)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--danger)]">
                  {cancelled.length}
                </span>
              </h2>
              <div className="space-y-3">
                {cancelled.map((trade) => (
                  <TradeHistoryCard key={trade.id} trade={trade} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TradeHistoryCard({ trade }: { trade: TradeHistory }) {
  const myHaves = trade.myItems.filter((i) => i.direction === "have");
  const myWants = trade.myItems.filter((i) => i.direction === "want");
  const isCompleted = trade.status === "completed";

  return (
    <div className={`rounded-2xl border bg-[var(--card)] p-5 ${
      isCompleted ? "border-[var(--success)]/20" : "border-[var(--border)]"
    }`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isCompleted
              ? "bg-[var(--success)]/10 text-[var(--success)]"
              : "bg-[var(--danger)]/10 text-[var(--danger)]"
          }`}>
            {isCompleted ? "✓ Complété" : "✕ Annulé"}
          </span>
          {trade.matches.length > 0 && (
            <span className="text-sm text-[var(--muted)]">
              avec {trade.matches[0].partner.name ?? "Inconnu"}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {new Date(trade.updatedAt).toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric"
          })}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Mes cartes proposées */}
        {myHaves.length > 0 && (
          <div className="flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              J&apos;offrais
            </p>
            <div className="flex flex-wrap gap-2">
              {myHaves.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  {item.card.imageSmall && (
                    <div className="relative h-8 w-6 shrink-0 overflow-hidden rounded">
                      <CardImage src={item.card.imageSmall} alt={item.card.name} fill className="object-contain" sizes="24px" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium">{item.card.name}</p>
                    <p className="text-xs text-[var(--muted)]">#{item.card.number}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Je cherchais */}
        {myWants.length > 0 && (
          <div className="flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Je cherchais
            </p>
            <div className="flex flex-wrap gap-2">
              {myWants.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  {item.card.imageSmall && (
                    <div className="relative h-8 w-6 shrink-0 overflow-hidden rounded">
                      <CardImage src={item.card.imageSmall} alt={item.card.name} fill className="object-contain" sizes="24px" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium">{item.card.name}</p>
                    <p className="text-xs text-[var(--muted)]">#{item.card.number}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
