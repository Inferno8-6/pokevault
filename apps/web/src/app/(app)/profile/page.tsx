"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { authedFetch } from "@/lib/fetch-helper";

interface Review {
  score: number;
  comment: string | null;
  createdAt: string;
  reviewer: { name: string | null; image: string | null };
}

interface ProfileData {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
  createdAt: string;
  publicProfile: boolean;
  emailNotifications: boolean;
  discordId: string | null;
  totalCards: number;
  tradesCompleted: number;
  avgScore: number | null;
  reviewCount: number;
  reviews: Review[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    authedFetch("/api/profile/me")
      .then(async (r) => (r ? r.json() : null))
      .then((data) => { if (data?.id) setProfile(data); })
      .finally(() => setLoading(false));
  }, []);

  async function toggleSetting(key: "publicProfile" | "emailNotifications") {
    if (!profile) return;
    setSaving(true);
    const newVal = !profile[key];
    const res = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newVal }),
    });
    if (res.ok) {
      setProfile((p) => p ? { ...p, [key]: newVal } : p);
      setToast("Paramètre enregistré ✓");
      setTimeout(() => setToast(null), 2500);
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-[72px] w-[72px] rounded-full animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/3 rounded animate-pulse" />
            <div className="h-3 w-1/4 rounded animate-pulse" />
            <div className="h-3 w-1/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" />)}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="h-5 w-1/4 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[0,1].map((i) => <div key={i} className="h-12 rounded-xl animate-pulse" />)}
        </div>
      </div>
    </div>
  );

  if (!profile) return null;

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/profile/${profile.id}`;

  return (
    <div className="max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className="toast fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl border border-[var(--success)]/40 bg-[var(--background)] px-5 py-3 text-sm font-medium text-[var(--success)] shadow-xl">
          <span>✓</span> {toast}
        </div>
      )}

      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Mon profil</h1>
        <p className="text-[var(--muted)]">Gérez vos informations et paramètres</p>
      </div>

      {/* Identité */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="pointer-events-none absolute inset-0 opacity-5"
          style={{ background: "radial-gradient(ellipse at top left, var(--primary), transparent 60%)" }} />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            {profile.image ? (
              <Image src={profile.image} alt={profile.name ?? ""} width={72} height={72}
                className="rounded-full border-2 border-[var(--primary)]/30 shadow-lg shadow-[var(--primary)]/10" />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[var(--primary)]/30 bg-[var(--primary)]/10 text-3xl">
                👤
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--card)] bg-[var(--success)]" />
          </div>
          <div>
            <p className="text-xl font-bold">{profile.name ?? "Utilisateur"}</p>
            <p className="text-sm text-[var(--muted)]">{profile.email}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Membre depuis {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            { value: profile.totalCards, label: "Cartes", icon: "🃏", color: "var(--primary)" },
            { value: profile.tradesCompleted, label: "Échanges", icon: "🤝", color: "var(--accent)" },
            { value: profile.avgScore != null ? `${profile.avgScore.toFixed(1)}/5` : "—", label: `${profile.reviewCount ?? 0} avis`, icon: "⭐", color: "var(--success)" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-xl bg-[var(--background)] p-3 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: `radial-gradient(circle at top, ${s.color}, transparent 70%)` }} />
              <p className="text-base mb-0.5">{s.icon}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Star rating */}
        {profile.avgScore != null && (
          <div className="relative mt-4 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-lg transition-colors ${star <= Math.round(profile.avgScore!) ? "text-[var(--primary)]" : "text-[var(--border)]"}`}>★</span>
            ))}
            <span className="ml-1 text-sm text-[var(--muted)]">{profile.reviewCount} avis</span>
          </div>
        )}
      </div>

      {/* Paramètres */}
      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Paramètres</h2>
        <div className="space-y-4">
          {/* Profil public */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Profil public</p>
              <p className="text-sm text-[var(--muted)]">
                Permet à d&apos;autres collectionneurs de voir votre profil et vos avis
              </p>
              {profile.publicProfile && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={profileUrl}
                    className="w-64 truncate rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--muted)]"
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(profileUrl); setToast("Lien copié !"); setTimeout(() => setToast(null), 2000); }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs hover:border-[var(--primary)]/40 transition-colors"
                  >
                    Copier
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => toggleSetting("publicProfile")}
              disabled={saving}
              className={`h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${profile.publicProfile ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform mx-1 ${profile.publicProfile ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Notifications email */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Notifications email</p>
              <p className="text-sm text-[var(--muted)]">
                Recevez des emails pour vos alertes de prix et nouveaux messages
              </p>
              {!profile.discordId && (
                <p className="mt-1 text-xs text-[var(--danger)]">
                  ⚠️ Aucun compte Discord lié — connectez-vous via Discord pour les notifications temps réel
                </p>
              )}
            </div>
            <button
              onClick={() => toggleSetting("emailNotifications")}
              disabled={saving}
              className={`h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${profile.emailNotifications ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform mx-1 ${profile.emailNotifications ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap d'activité — GitHub-style sur 12 mois */}
      <ActivityHeatmap days={365} />

      {/* Avis reçus */}
      {(profile.reviews ?? []).length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 text-lg font-semibold">Avis reçus</h2>
          <div className="space-y-3">
            {(profile.reviews ?? []).map((review, i) => (
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
    </div>
  );
}
