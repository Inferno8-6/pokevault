"use client";

import { useState, useCallback } from "react";
import { getSearchNames, getFrenchName } from "@pokemon/tcg-api";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export function SearchBar({
  onSearch,
  placeholder = "Rechercher une carte Pokemon...",
  loading = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");

  // Détecte si le nom saisi a une traduction connue
  const searchNames = query.trim() ? getSearchNames(query.trim()) : [];
  const hasTranslation = searchNames.length > 1;
  // Le nom "traduit" à afficher en badge (celui qui est différent du saisi)
  const translatedName = hasTranslation
    ? searchNames.find((n) => n.toLowerCase() !== query.trim().toLowerCase())
    : null;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
      }
    },
    [query, onSearch]
  );

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative w-full">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 pr-32 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--primary)]"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {loading ? "..." : "Rechercher"}
        </button>
      </form>

      {/* Badge : nom reconnu */}
      {hasTranslation && translatedName && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-1 text-[var(--primary)]">
            ✓ Pokémon reconnu — cartes françaises prioritaires
          </span>
        </div>
      )}
    </div>
  );
}
