"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePremium } from "@/lib/use-premium";

const features = [
  { name: "Cartes en collection", free: "500 max", premium: "Illimité" },
  { name: "Classeurs (Binders)", free: "2 max", premium: "Illimité" },
  { name: "Alertes de prix", free: "—", premium: "Jusqu'à 50" },
  { name: "Mode Investisseur (P&L, ROI)", free: "—", premium: "Inclus" },
  { name: "Export CSV", free: "—", premium: "Inclus" },
  { name: "Historique des prix", free: "30 jours", premium: "1 an" },
  { name: "Variantes de cartes", free: "Inclus", premium: "Inclus" },
  { name: "Suivi de prix live", free: "Inclus", premium: "Inclus" },
  { name: "Recherche & exploration", free: "Inclus", premium: "Inclus" },
];

export default function PremiumPage() {
  const { isPremium, loading } = usePremium();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Erreur");
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">PokeVault Premium</h1>
      <p className="text-[var(--muted)] mb-6">
        Débloquez tout le potentiel de votre collection.
      </p>

      {success && (
        <div className="mb-6 rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 p-4 text-center text-[var(--success)] font-semibold">
          Bienvenue dans Premium ! Rechargez la page si vos avantages ne s'affichent pas encore.
        </div>
      )}

      {canceled && (
        <div className="mb-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4 text-center text-[var(--danger)]">
          Paiement annulé. Vous pouvez réessayer quand vous voulez.
        </div>
      )}

      {/* Comparison table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="grid grid-cols-3 gap-0 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-bold">
          <span>Fonctionnalité</span>
          <span className="text-center">Gratuit</span>
          <span className="text-center text-[var(--primary)]">Premium</span>
        </div>
        {features.map((f) => (
          <div key={f.name} className="grid grid-cols-3 gap-0 border-b border-[var(--border)]/50 px-4 py-3 text-sm last:border-0">
            <span>{f.name}</span>
            <span className="text-center text-[var(--muted)]">{f.free}</span>
            <span className="text-center font-semibold text-[var(--primary)]">{f.premium}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        {loading ? (
          <div className="h-12 w-48 mx-auto rounded-xl animate-pulse" />
        ) : isPremium ? (
          <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 px-6 py-3 inline-block">
            <span className="font-bold text-[var(--success)]">Vous êtes Premium !</span>
          </div>
        ) : (
          <>
            <p className="mb-3 text-3xl font-black text-[var(--primary)]">
              3,99 € <span className="text-base font-normal text-[var(--muted)]">/ mois</span>
            </p>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="rounded-xl bg-[var(--primary)] px-8 py-3 text-base font-bold text-black transition-all hover:brightness-110 disabled:opacity-50"
            >
              {upgrading ? "Redirection…" : "Passer à Premium"}
            </button>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Annulable à tout moment. Paiement sécurisé par Stripe.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
