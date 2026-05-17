"use client";

import { useState, useRef } from "react";
import { CardImage } from "@/components/card-image";
import type { NormalizedCard } from "@/lib/tcgdex";

interface ScanResult {
  identified: boolean;
  name?: string;
  set?: string | null;
  number?: string | null;
  confidence?: string;
  message?: string;
}

interface GradeResult {
  graded: boolean;
  grade?: number;
  centering?: number;
  surface?: number;
  corners?: number;
  edges?: number;
  confidence?: string;
  details?: string;
  message?: string;
}

interface Props {
  onClose: () => void;
  onAddToPortfolio?: (tcgId: string) => void;
  isPremium?: boolean;
}

export function ScanModal({ onClose, onAddToPortfolio, isPremium }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [searchResults, setSearchResults] = useState<NormalizedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // Compresse une image dans le navigateur (max 1600px côté long, JPEG q=0.85).
  // Ramène les photos smartphone 5-10 Mo sous 1 Mo sans perte visible.
  async function compressImage(file: File): Promise<File> {
    if (file.size < 500 * 1024) return file; // déjà petit
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("Canvas unsupported")); }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error("Compression échouée"));
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
      img.src = url;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setScanResult(null);
    setSearchResults([]);
    setError(null);
    setAdded(null);
    setGradeResult(null);
    let file = raw;
    try {
      file = await compressImage(raw);
    } catch {
      setError("Impossible de traiter l'image (format non supporté)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError(`Image trop grande même après compression (${(file.size / 1024 / 1024).toFixed(1)} Mo). Réessayez avec une photo plus petite.`);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setLastFile(file);
    scanFile(file);
  }

  async function scanFile(file: File) {
    setScanning(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors du scan");
        return;
      }
      setScanResult(data);
      if (data.identified && data.name) {
        searchCards(data.name);
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setScanning(false);
    }
  }

  async function searchCards(name: string) {
    setSearching(true);
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(name)}&pageSize=8`);
      const data = await res.json();
      setSearchResults(data.data ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function estimateGrade() {
    if (!lastFile) return;
    setGrading(true);
    setGradeResult(null);
    try {
      const form = new FormData();
      form.append("image", lastFile);
      const res = await fetch("/api/scan/grade", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'estimation");
        return;
      }
      setGradeResult(data);
    } catch {
      setError("Erreur réseau");
    } finally {
      setGrading(false);
    }
  }

  async function addToPortfolio(card: NormalizedCard) {
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tcgId: card.id, quantity: 1 }),
    });
    if (res.ok) {
      setAdded(card.id);
      onAddToPortfolio?.(card.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">📷 Scanner une carte</h2>
            <p className="text-sm text-[var(--muted)]">Identifiez une carte par photo</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white">✕</button>
        </div>

        {/* Zone upload */}
        <div
          className="mb-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--card-hover)]"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Scan" className="max-h-48 rounded-xl object-contain" />
          ) : (
            <>
              <p className="text-4xl mb-3">📷</p>
              <p className="font-medium">Cliquez ou déposez une photo</p>
              <p className="mt-1 text-sm text-[var(--muted)]">JPG, PNG · max 4 Mo</p>
              <p className="mt-2 text-xs text-[var(--muted)]">Sur mobile, l&apos;appareil photo s&apos;ouvre directement</p>
            </>
          )}
        </div>

        {/* Statut */}
        {scanning && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            <p className="text-sm font-medium text-[var(--primary)]">Analyse de la carte en cours...</p>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3">
            <p className="text-sm text-[var(--danger)]">⚠️ {error}</p>
          </div>
        )}

        {scanResult && !scanning && (
          <div className="mb-5">
            {scanResult.identified ? (
              <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 px-4 py-3">
                <p className="font-semibold text-[var(--success)]">✓ Carte identifiée : {scanResult.name}</p>
                {scanResult.set && <p className="text-sm text-[var(--muted)]">Série : {scanResult.set}</p>}
                {scanResult.number && <p className="text-sm text-[var(--muted)]">Numéro : {scanResult.number}</p>}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Confiance : {scanResult.confidence === "high" ? "🟢 Haute" : scanResult.confidence === "medium" ? "🟡 Moyenne" : "🔴 Faible"}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <p className="text-sm text-[var(--muted)]">❓ {scanResult.message ?? "Carte non reconnue"}</p>
                <button onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs text-[var(--primary)] hover:underline">
                  Réessayer avec une autre photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bouton estimation PSA */}
        {scanResult?.identified && !grading && !gradeResult && lastFile && (
          <div className="mb-5">
            {isPremium ? (
              <button
                onClick={estimateGrade}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
              >
                🏆 Estimer le grade PSA
              </button>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
                <p className="text-sm font-medium text-amber-400">🏆 Estimation PSA — Premium uniquement</p>
                <a href="/premium" className="mt-1 inline-block text-xs text-[var(--primary)] hover:underline">
                  Passer en Premium →
                </a>
              </div>
            )}
          </div>
        )}

        {grading && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="text-sm font-medium text-amber-400">Analyse du grade PSA en cours...</p>
          </div>
        )}

        {gradeResult && !grading && (
          <div className="mb-5">
            {gradeResult.graded ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-amber-400">🏆 Estimation PSA</p>
                  <span className="text-xs text-[var(--muted)]">
                    Confiance : {gradeResult.confidence === "high" ? "🟢 Haute" : gradeResult.confidence === "medium" ? "🟡 Moyenne" : "🔴 Faible"}
                  </span>
                </div>
                <div className="mb-3 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-2xl font-black text-black">
                    {gradeResult.grade}
                  </div>
                  <span className="ml-3 text-sm text-[var(--muted)]">/ 10</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([["Centrage", gradeResult.centering], ["Surface", gradeResult.surface], ["Coins", gradeResult.corners], ["Bords", gradeResult.edges]] as const).map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-[var(--card)] px-3 py-2">
                      <span className="text-[var(--muted)]">{label}</span>
                      <span className="font-bold" style={{ color: (val ?? 0) >= 8 ? "#22c55e" : (val ?? 0) >= 5 ? "#f59e0b" : "#ef4444" }}>{val}/10</span>
                    </div>
                  ))}
                </div>
                {gradeResult.details && (
                  <p className="mt-3 text-xs italic text-[var(--muted)]">{gradeResult.details}</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <p className="text-sm text-[var(--muted)]">❓ {gradeResult.message ?? "Impossible d'estimer le grade"}</p>
              </div>
            )}
          </div>
        )}

        {/* Résultats de recherche */}
        {(searching || searchResults.length > 0) && (
          <div>
            <p className="mb-3 text-sm font-medium text-[var(--muted)]">
              {searching ? "Recherche des cartes correspondantes..." : `${searchResults.length} carte(s) trouvée(s) — cliquez pour ajouter`}
            </p>
            {searching ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {searchResults.map((card) => (
                  <div key={card.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg">
                      <CardImage src={card.images?.small} alt={card.name} fill className="object-contain" sizes="36px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      <p className="text-xs text-[var(--muted)]">{card.set.name} · #{card.number}</p>
                    </div>
                    <button
                      onClick={() => addToPortfolio(card)}
                      disabled={added === card.id}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        added === card.id
                          ? "bg-[var(--success)]/20 text-[var(--success)]"
                          : "bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)]"
                      }`}
                    >
                      {added === card.id ? "✓ Ajoutée" : "+ Portfolio"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
