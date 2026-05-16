"use client";

import Link from "next/link";

export function PremiumBanner({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--primary)]/30 bg-gradient-to-r from-[var(--primary)]/5 to-[var(--primary)]/10 p-5 text-center">
      <p className="text-2xl mb-2">&#x1F451;</p>
      <p className="font-semibold">{message ?? "Cette fonctionnalité est réservée aux membres Premium."}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Suivi illimité, alertes de prix, mode investisseur, export CSV et bien plus.
      </p>
      <Link
        href="/premium"
        className="mt-4 inline-block rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-black transition-colors hover:brightness-110"
      >
        Découvrir Premium
      </Link>
    </div>
  );
}
