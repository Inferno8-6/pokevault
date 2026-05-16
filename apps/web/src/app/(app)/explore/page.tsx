"use client";

import { useState, useMemo } from "react";
import { SearchBar } from "@/components/search-bar";
import { CardGrid } from "@/components/card-grid";
import { CardModal } from "@/components/card-modal";
import type { NormalizedCard } from "@/lib/tcgdex";

const pageSizeOptions = [50, 100, 150, 200];

type SortKey = "name" | "price_asc" | "price_desc" | "number";

export default function ExplorePage() {
  const [allCards, setAllCards] = useState<NormalizedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [searched, setSearched] = useState(false);
  const [selectedCard, setSelectedCard] = useState<NormalizedCard | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);

  // Filtres avancés
  const [showFilters, setShowFilters] = useState(false);
  const [filterRarity, setFilterRarity] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterSet, setFilterSet] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  // Calcul des raretés et séries disponibles dans les résultats
  const availableRarities = useMemo(() => {
    const set = new Set(allCards.map((c) => c.rarity).filter(Boolean));
    return [...set].sort() as string[];
  }, [allCards]);

  const availableSets = useMemo(() => {
    const map = new Map<string, string>();
    allCards.forEach((c) => map.set(c.set.id, c.set.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allCards]);

  // Filtrage + tri client-side
  const filteredCards = useMemo(() => {
    let cards = [...allCards];
    if (filterRarity) cards = cards.filter((c) => c.rarity === filterRarity);
    if (filterSet) cards = cards.filter((c) => c.set.id === filterSet);
    const min = parseFloat(filterMinPrice);
    const max = parseFloat(filterMaxPrice);
    if (!isNaN(min)) {
      cards = cards.filter((c) => {
        const p = c.cardmarket?.prices?.trendPrice ?? c.cardmarket?.prices?.averageSellPrice;
        return p != null && p >= min;
      });
    }
    if (!isNaN(max)) {
      cards = cards.filter((c) => {
        const p = c.cardmarket?.prices?.trendPrice ?? c.cardmarket?.prices?.averageSellPrice;
        return p != null && p <= max;
      });
    }
    // Tri
    cards.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "number") return (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
      const pa = a.cardmarket?.prices?.trendPrice ?? a.cardmarket?.prices?.averageSellPrice ?? 0;
      const pb = b.cardmarket?.prices?.trendPrice ?? b.cardmarket?.prices?.averageSellPrice ?? 0;
      return sortKey === "price_asc" ? pa - pb : pb - pa;
    });
    return cards;
  }, [allCards, filterRarity, filterSet, filterMinPrice, filterMaxPrice, sortKey]);

  const totalPages = Math.ceil(filteredCards.length / pageSize);
  const pageCards = filteredCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = [filterRarity, filterSet, filterMinPrice, filterMaxPrice].filter(Boolean).length;

  async function fetchCards(query: string, page: number, size = pageSize) {
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/cards/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${size}`
      );
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setAllCards(data.data || []);
      setTotalCount(data.totalCount || 0);
      setCurrentPage(1);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchError("Impossible de charger les résultats. Vérifie ta connexion et réessaie.");
      setAllCards([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(query: string) {
    setCurrentQuery(query);
    setFilterRarity("");
    setFilterSet("");
    setFilterMinPrice("");
    setFilterMaxPrice("");
    fetchCards(query, 1);
  }

  function goToPage(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearFilters() {
    setFilterRarity("");
    setFilterSet("");
    setFilterMinPrice("");
    setFilterMaxPrice("");
    setSortKey("name");
  }

  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Explorer les cartes</h1>
        <p className="mb-6 text-[var(--muted)]">
          Parcourez toute la base de données Pokémon TCG. Trouvez les prix, les séries et plus encore.
        </p>
        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          placeholder="Rechercher un Pokémon : Salamèche, Dracaufeu, Pikachu..."
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      )}

      {!loading && searchError && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-5 py-4 text-sm text-[var(--danger)]">
          <span className="text-xl">⚠️</span>
          <span>{searchError}</span>
        </div>
      )}

      {!loading && searched && !searchError && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {filteredCards.length !== totalCount ? (
                <><strong className="text-white">{filteredCards.length}</strong> / {totalCount} résultats (filtrés)</>
              ) : (
                <><strong className="text-white">{totalCount}</strong> résultat{totalCount !== 1 ? "s" : ""} · Page {currentPage}/{totalPages}</>
              )}
            </p>

            <div className="flex items-center gap-2">
              {/* Bouton filtres */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  showFilters || activeFilters > 0
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                🎚️ Filtres {activeFilters > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-black">{activeFilters}</span>}
              </button>

              {/* Tri */}
              <select
                value={sortKey}
                onChange={(e) => { setSortKey(e.target.value as SortKey); setCurrentPage(1); }}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm transition-colors hover:border-[var(--primary)] focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="name">Nom A→Z</option>
                <option value="number">N° de carte</option>
                <option value="price_asc">Prix ↑</option>
                <option value="price_desc">Prix ↓</option>
              </select>

              {/* Cartes par page */}
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm transition-colors hover:border-[var(--primary)] focus:border-[var(--primary)] focus:outline-none"
              >
                {pageSizeOptions.map((s) => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>
          </div>

          {/* Panneau filtres avancés */}
          {showFilters && (
            <div className="mb-6 rounded-2xl border border-[var(--primary)]/20 bg-[var(--card)] p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* Rareté */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Rareté</label>
                  <select
                    value={filterRarity}
                    onChange={(e) => { setFilterRarity(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="">Toutes</option>
                    {availableRarities.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Série */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Série</label>
                  <select
                    value={filterSet}
                    onChange={(e) => { setFilterSet(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                  >
                    <option value="">Toutes</option>
                    {availableSets.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>

                {/* Prix min */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Prix min (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={filterMinPrice}
                    onChange={(e) => { setFilterMinPrice(e.target.value); setCurrentPage(1); }}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                  />
                </div>

                {/* Prix max */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Prix max (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={filterMaxPrice}
                    onChange={(e) => { setFilterMaxPrice(e.target.value); setCurrentPage(1); }}
                    placeholder="∞"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                  />
                </div>
              </div>

              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-xs text-[var(--muted)] underline hover:text-[var(--danger)] transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}

          <CardGrid cards={pageCards} onCardClick={setSelectedCard} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition-colors hover:border-[var(--primary)] disabled:opacity-30">
                ← Précédent
              </button>
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`dots-${idx}`} className="px-2 text-[var(--muted)]">...</span>
                ) : (
                  <button key={page} onClick={() => goToPage(page)}
                    className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page ? "bg-[var(--primary)] text-black" : "border border-[var(--border)] hover:border-[var(--primary)]"
                    }`}>{page}</button>
                )
              )}
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition-colors hover:border-[var(--primary)] disabled:opacity-30">
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !searched && (
        <div className="py-16 text-center text-[var(--muted)]">
          <p className="text-6xl mb-5">🃏</p>
          <p className="text-lg font-medium text-white">Recherchez une carte pour commencer</p>
          <p className="text-sm mt-2 mb-6">Toutes les cartes françaises TCGdex — visuels haute résolution</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {["Dracaufeu", "Mewtwo", "Pikachu", "Florges", "Rayquaza", "Lugia", "Feunard", "Absol"].map((name) => (
              <button key={name} onClick={() => handleSearch(name)}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-[var(--muted)] transition-colors hover:border-[var(--primary)]/50 hover:text-white">
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );
}
