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

interface Props {
  onClose: () => void;
  onAddToPortfolio?: (tcgId: string) => void;
}

export function ScanModal({ onClose, onAddToPortfolio }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [searchResults, setSearchResults] = useState<NormalizedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setScanResult(null);
    setSearchResults([]);
    setError(null);
    setAdded(null);
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
