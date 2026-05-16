"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CardImage } from "@/components/card-image";

interface Binder {
  id: string;
  name: string;
  description: string | null;
  layout: string;
  isPublic: boolean;
  coverColor: string;
  coverImage: string | null;
  filledCount: number;
  slotsPerPage: number;
  createdAt: string;
  updatedAt: string;
}

const LAYOUTS = [
  { value: "3x3", label: "3×3", desc: "9 cartes/page" },
  { value: "3x4", label: "3×4", desc: "12 cartes/page" },
  { value: "4x3", label: "4×3", desc: "12 cartes/page" },
  { value: "4x4", label: "4×4", desc: "16 cartes/page" },
];

const COLORS = [
  "#f59e0b", "#ef4444", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#06b6d4", "#fbbf24",
];

export default function BindersPage() {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchBinders(); }, []);

  async function fetchBinders() {
    setLoading(true);
    const res = await fetch("/api/binders");
    if (res.ok) {
      const data = await res.json();
      setBinders(data.binders ?? []);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Mes classeurs</h1>
        <p className="text-[var(--muted)]">
          Organisez votre collection en classeurs visuels — partagez-les publiquement
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          {binders.length} classeur{binders.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/10"
        >
          + Nouveau classeur
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : binders.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-14 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-5"
            style={{ background: "radial-gradient(circle at center, var(--primary), transparent 70%)" }} />
          <p className="text-5xl mb-3">📚</p>
          <p className="font-semibold text-lg">Aucun classeur</p>
          <p className="mt-2 max-w-md mx-auto text-sm text-[var(--muted)]">
            Créez votre premier classeur pour organiser vos cartes visuellement. Choisissez entre 9, 12 ou 16 emplacements par page.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/20"
          >
            + Créer mon premier classeur
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {binders.map((b) => (
            <Link
              key={b.id}
              href={`/binders/${b.id}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all hover:scale-[1.02] hover:shadow-2xl"
              style={{ boxShadow: `0 0 0 1px ${b.coverColor}15` }}
            >
              {/* Background gradient using cover color */}
              <div className="absolute inset-0 opacity-30 transition-opacity group-hover:opacity-40"
                style={{ background: `linear-gradient(135deg, ${b.coverColor}, transparent 70%)` }} />

              {/* Cover preview */}
              {b.coverImage && (
                <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                  <CardImage src={b.coverImage} alt="" fill className="object-cover" sizes="400px" />
                </div>
              )}

              {/* Spine effect */}
              <div className="absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-2"
                style={{ background: b.coverColor }} />

              {/* Content */}
              <div className="relative flex h-full flex-col justify-between p-5">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: `${b.coverColor}30`, color: b.coverColor }}>
                      {b.layout}
                    </span>
                    {b.isPublic && (
                      <span className="rounded-full bg-[var(--success)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
                        🌐 Public
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold leading-tight line-clamp-2">{b.name}</p>
                  {b.description && (
                    <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{b.description}</p>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-white">{b.filledCount}</p>
                    <p className="text-[10px] text-[var(--muted)]">carte{b.filledCount !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-xs text-[var(--muted)] opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    Ouvrir →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateBinderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchBinders(); }}
        />
      )}
    </div>
  );
}

function CreateBinderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [layout, setLayout] = useState("3x3");
  const [isPublic, setIsPublic] = useState(false);
  const [coverColor, setCoverColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nom requis");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/binders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, layout, isPublic, coverColor }),
      });
      if (res.ok) {
        onCreated();
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
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Nouveau classeur</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nom *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              placeholder="Mes Dracaufeu, Set 151 complet…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Optionnel"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted)]">Disposition de la page</label>
            <div className="grid grid-cols-4 gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLayout(l.value)}
                  className={`rounded-xl border p-2.5 text-center transition-colors ${
                    layout === l.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40"
                  }`}
                >
                  <p className={`text-sm font-bold ${layout === l.value ? "text-[var(--primary)]" : "text-white"}`}>{l.label}</p>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted)]">Couleur de tranche</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCoverColor(c)}
                  className={`h-8 w-8 rounded-full transition-all ${
                    coverColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--background)] scale-110" : "hover:scale-105"
                  }`}
                  style={{ background: c }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Classeur public</p>
              <p className="text-xs text-[var(--muted)]">Visible par tous via un lien</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className={`h-7 w-12 shrink-0 rounded-full transition-colors ${isPublic ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform mx-1 ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </label>

          {error && (
            <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]">⚠️ {error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50">
              {saving ? "Création..." : "📚 Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
