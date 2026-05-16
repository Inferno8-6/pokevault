"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { use } from "react";

interface Review {
  score: number;
  comment: string | null;
  createdAt: string;
  reviewer: { name: string | null; image: string | null };
}

interface PublicProfile {
  id: string;
  name: string | null;
  image: string | null;
  createdAt: string;
  totalCards: number;
  tradesCompleted: number;
  avgScore: number | null;
  reviewCount: number;
  reviews: Review[];
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "private" | "notfound">("loading");

  useEffect(() => {
    fetch(`/api/profile/${userId}`)
      .then(async (r) => {
        if (r.status === 403) { setStatus("private"); return; }
        if (r.status === 404) { setStatus("notfound"); return; }
        const data = await r.json();
        setProfile(data);
        setStatus("ok");
      });
  }, [userId]);

  if (status === "loading") return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  if (status === "private") return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-center">
      <div>
        <p className="text-5xl mb-4">🔒</p>
        <h1 className="text-2xl font-bold mb-2">Profil privé</h1>
        <p className="text-[var(--muted)]">Cet utilisateur n&apos;a pas rendu son profil public.</p>
      </div>
    </div>
  );

  if (status === "notfound" || !profile) return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-center">
      <div>
        <p className="text-5xl mb-4">❓</p>
        <h1 className="text-2xl font-bold mb-2">Profil introuvable</h1>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          {profile.image ? (
            <Image src={profile.image} alt={profile.name ?? ""} width={88} height={88} className="mx-auto mb-4 rounded-full" />
          ) : (
            <div className="mx-auto mb-4 flex h-22 w-22 items-center justify-center rounded-full bg-[var(--primary)]/20 text-4xl">👤</div>
          )}
          <h1 className="text-2xl font-bold">{profile.name ?? "Collectionneur"}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Membre depuis {new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>

          {/* Stars */}
          {profile.avgScore != null && (
            <div className="mt-3 flex items-center justify-center gap-1">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className={`text-xl ${s <= Math.round(profile.avgScore!) ? "text-[var(--primary)]" : "text-[var(--border)]"}`}>★</span>
              ))}
              <span className="ml-2 text-sm text-[var(--muted)]">{profile.avgScore.toFixed(1)}/5 ({profile.reviewCount} avis)</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <p className="text-3xl font-bold text-[var(--primary)]">{profile.totalCards}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Cartes en collection</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <p className="text-3xl font-bold text-[var(--primary)]">{profile.tradesCompleted}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Échanges complétés</p>
          </div>
        </div>

        {/* Avis */}
        {profile.reviews.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="mb-4 text-lg font-semibold">Avis ({profile.reviewCount})</h2>
            <div className="space-y-3">
              {profile.reviews.map((review, i) => (
                <div key={i} className="rounded-xl bg-[var(--background)] p-4">
                  <div className="mb-2 flex items-center gap-3">
                    {review.reviewer.image && (
                      <Image src={review.reviewer.image} alt="" width={28} height={28} className="rounded-full" />
                    )}
                    <span className="text-sm font-medium">{review.reviewer.name ?? "Anonyme"}</span>
                    <div className="ml-auto flex items-center gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <span key={s} className={`text-sm ${s <= review.score ? "text-[var(--primary)]" : "text-[var(--border)]"}`}>★</span>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[var(--muted)]">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          Profil PokeVault · <a href="/" className="hover:text-white underline">pokevault.app</a>
        </p>
      </div>
    </div>
  );
}
