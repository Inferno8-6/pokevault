"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { NormalizedCard, TCGdexSet } from "@/lib/tcgdex";
import { CardImage } from "@/components/card-image";
import { VARIANT_LABELS } from "@pokemon/shared";

// ─── Groupes de raretés / variantes ──────────────────────────────────────────
//     Chaque groupe définit un onglet affiché uniquement si le set contient
//     au moins une carte correspondante.

const RARITY_GROUPS: Array<{
  id: string;
  label: string;
  emoji: string;
  match: (rarity: string | undefined) => boolean;
}> = [
  {
    id: "all",
    label: "Toutes",
    emoji: "🃏",
    match: () => true,
  },
  {
    id: "normal",
    label: "Normales",
    emoji: "⬜",
    match: (r) =>
      !r ||
      ["Commune", "Peu commune", "Rare", "Common", "Uncommon"].includes(r),
  },
  {
    id: "holo",
    label: "Holographique",
    emoji: "✨",
    match: (r) =>
      !!r &&
      (r.includes("Holo") || r.includes("holo")) &&
      !r.toLowerCase().includes("reverse") &&
      !r.toLowerCase().includes("cosmos") &&
      !r.toLowerCase().includes("ultra") &&
      !r.toLowerCase().includes("secret") &&
      !r.toLowerCase().includes("shiny"),
  },
  {
    id: "cosmos",
    label: "Cosmos",
    emoji: "🌌",
    match: (r) => !!r && r.toLowerCase().includes("cosmos"),
  },
  {
    id: "reverse",
    label: "Reverse",
    emoji: "🔄",
    match: (r) => !!r && r.toLowerCase().includes("reverse"),
  },
  {
    id: "pokeball",
    label: "Poké Ball",
    emoji: "⚪",
    match: (r) =>
      !!r &&
      (r.toLowerCase().includes("pokeball") ||
        r.toLowerCase().includes("poké ball") ||
        r.toLowerCase().includes("poke ball")),
  },
  {
    id: "masterball",
    label: "Master Ball",
    emoji: "🟣",
    match: (r) =>
      !!r &&
      (r.toLowerCase().includes("masterball") ||
        r.toLowerCase().includes("master ball")),
  },
  {
    id: "special",
    label: "Spéciales",
    emoji: "⭐",
    match: (r) =>
      !!r &&
      (r.toLowerCase().includes("ultra") ||
        r.toLowerCase().includes("secret") ||
        r.toLowerCase().includes("secrète") ||
        r.toLowerCase().includes("illustration") ||
        r.toLowerCase().includes("hyperrare") ||
        r.toLowerCase().includes("shiny")),
  },
  {
    id: "promo",
    label: "Promos",
    emoji: "🎁",
    match: (r) => !!r && r.toLowerCase().includes("promo"),
  },
];

/** Retourne le groupe auquel appartient une carte (premier match non-"all") */
function getCardGroup(rarity: string | undefined): string {
  for (const g of RARITY_GROUPS) {
    if (g.id === "all") continue;
    if (g.match(rarity)) return g.id;
  }
  return "other";
}

// ─── Types internes ───────────────────────────────────────────────────────────

interface SerieGroup {
  id: string;
  name: string;
  sets: TCGdexSet[];
}

interface SetData {
  set: TCGdexSet & { serie?: { id: string; name: string } };
  cards: NormalizedCard[];
  rarities: string[];
}

type Mode = "series" | "search";

const CONDITION_LABELS: Record<string, string> = {
  mint: "Neuve",
  near_mint: "Quasi Neuve",
  excellent: "Excellente",
  good: "Bonne",
  played: "Jouée",
};

// ─── Composant TabBar ─────────────────────────────────────────────────────────

function TabBar({
  cards,
  activeTab,
  onTabChange,
}: {
  cards: NormalizedCard[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  // Ne garde que les onglets qui ont au moins une carte
  const tabs = RARITY_GROUPS.map((g) => ({
    ...g,
    count: g.id === "all" ? cards.length : cards.filter((c) => g.match(c.rarity)).length,
  })).filter((t) => t.count > 0);

  if (tabs.length <= 1) return null; // Pas besoin d'onglets si tout est dans "Toutes"

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-6 pb-0 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted)] hover:text-white"
          }`}
        >
          <span>{tab.emoji}</span>
          <span>{tab.label}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === tab.id
                ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                : "bg-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function ImportSetModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("series");

  // Mode série
  const [step, setStep] = useState<"pick-set" | "pick-cards">("pick-set");
  const [series, setSeries] = useState<SerieGroup[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [setSearch, setSetSearch] = useState("");
  const [expandedSerie, setExpandedSerie] = useState<string | null>(null);
  const [setData, setSetData] = useState<SetData | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);

  // Mode recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NormalizedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Partagé
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState("near_mint");
  const [variant, setVariant] = useState("normal");
  const [quantity, setQuantity] = useState(1);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/sets")
      .then((r) => r.json())
      .then((d) => {
        setSeries(d.series ?? []);
        if ((d.series ?? []).length > 0) setExpandedSerie(d.series[0].id);
      })
      .finally(() => setLoadingSets(false));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearchDone(false); return; }
    setSearching(true); setSearchDone(false);
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}&pageSize=150`);
      const data = await res.json();
      setSearchResults(data.data ?? []);
    } finally { setSearching(false); setSearchDone(true); }
  }, []);

  useEffect(() => {
    if (mode !== "search") return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => runSearch(searchQuery), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, mode, runSearch]);

  function switchMode(m: Mode) { setMode(m); setSelectedIds(new Set()); }

  async function pickSet(setId: string) {
    setStep("pick-cards");
    setLoadingCards(true);
    setSetData(null);
    setSelectedIds(new Set());
    const res = await fetch(`/api/sets/${setId}`);
    if (res.ok) setSetData(await res.json());
    setLoadingCards(false);
  }

  function toggleCard(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectVisible(cards: NormalizedCard[]) {
    setSelectedIds((prev) => { const n = new Set(prev); cards.forEach((c) => n.add(c.id)); return n; });
  }
  function deselectAll() { setSelectedIds(new Set()); }

  async function handleImport() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setImporting(true);
    setProgress({ done: 0, total: ids.length });
    const res = await fetch("/api/portfolio/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tcgIds: ids, condition, variant, quantity }),
    });
    setProgress({ done: ids.length, total: ids.length });
    if (res.ok) { const data = await res.json(); onImported(data.total ?? ids.length); }
    setImporting(false);
  }

  const filteredSeries = useMemo(() => {
    if (!setSearch.trim()) return series;
    const q = setSearch.toLowerCase();
    return series
      .map((s) => ({ ...s, sets: s.sets.filter((x) => x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q)) }))
      .filter((s) => s.sets.length > 0);
  }, [series, setSearch]);

  const headerTitle =
    mode === "search" ? "🔍 Recherche par carte"
    : step === "pick-cards" && setData ? `📦 ${setData.set.name}`
    : "📦 Importer par série";

  const headerSub =
    mode === "search"
      ? searchResults.length > 0
        ? `${searchResults.length} résultat${searchResults.length > 1 ? "s" : ""} · ${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}`
        : "Trouvez toutes les versions d'une carte, peu importe sa série"
      : step === "pick-cards" && setData
      ? `${setData.cards.length} cartes · ${selectedIds.size} sélectionnée${selectedIds.size > 1 ? "s" : ""}`
      : "Choisissez une collection pour importer ses cartes en lot";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {mode === "series" && step === "pick-cards" && (
                <button
                  onClick={() => { setStep("pick-set"); setSelectedIds(new Set()); }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white transition-colors"
                >←</button>
              )}
              <div>
                <h2 className="text-lg font-bold">{headerTitle}</h2>
                <p className="text-sm text-[var(--muted)]">{headerSub}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white"
            >✕</button>
          </div>

          {/* Onglets de mode */}
          <div className="mt-3 flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 gap-1 w-fit">
            {([
              { key: "series", label: "📦 Par série" },
              { key: "search", label: "🔍 Par carte" },
            ] as { key: Mode; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchMode(tab.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === tab.key ? "bg-[var(--primary)] text-black" : "text-[var(--muted)] hover:text-white"
                }`}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {/* ── MODE SÉRIE — Étape 1 ── */}
        {mode === "series" && step === "pick-set" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-[var(--border)] px-6 py-3">
              <input
                type="text" value={setSearch} onChange={(e) => setSetSearch(e.target.value)}
                placeholder="Rechercher une série... (ex: Écarlate, Épée et Bouclier, XY)"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingSets ? (
                <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /></div>
              ) : filteredSeries.length === 0 ? (
                <p className="py-16 text-center text-sm text-[var(--muted)]">Aucune série trouvée</p>
              ) : (
                filteredSeries.map((serie) => (
                  <SerieSection
                    key={serie.id} serie={serie}
                    expanded={expandedSerie === serie.id || !!setSearch}
                    onToggle={() => setExpandedSerie(expandedSerie === serie.id ? null : serie.id)}
                    onPickSet={pickSet}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── MODE SÉRIE — Étape 2 (grille avec onglets) ── */}
        {mode === "series" && step === "pick-cards" && (
          <SeriesCardGrid
            setData={setData}
            loadingCards={loadingCards}
            selectedIds={selectedIds}
            onToggle={toggleCard}
            onSelectVisible={selectVisible}
            onDeselectAll={deselectAll}
          />
        )}

        {/* ── MODE RECHERCHE ── */}
        {mode === "search" && (
          <SearchCardMode
            query={searchQuery}
            onQueryChange={setSearchQuery}
            searching={searching}
            searchDone={searchDone}
            results={searchResults}
            selectedIds={selectedIds}
            onToggle={toggleCard}
            onSelectGroup={selectVisible}
            onDeselectAll={deselectAll}
          />
        )}

        {/* Footer commun */}
        {(mode === "search" || step === "pick-cards") && (
          <ImportFooter
            selectedCount={selectedIds.size}
            condition={condition}
            variant={variant}
            quantity={quantity}
            importing={importing}
            progress={progress}
            onConditionChange={setCondition}
            onVariantChange={setVariant}
            onQuantityChange={setQuantity}
            onImport={handleImport}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grille série avec onglets de variantes ───────────────────────────────────

function SeriesCardGrid({
  setData,
  loadingCards,
  selectedIds,
  onToggle,
  onSelectVisible,
  onDeselectAll,
}: {
  setData: SetData | null;
  loadingCards: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectVisible: (cards: NormalizedCard[]) => void;
  onDeselectAll: () => void;
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [cardSearch, setCardSearch] = useState("");

  // Reset tab quand le set change
  useEffect(() => { setActiveTab("all"); setCardSearch(""); }, [setData]);

  const allCards = setData?.cards ?? [];

  const filtered = useMemo(() => {
    const tabGroup = RARITY_GROUPS.find((g) => g.id === activeTab);
    return allCards.filter((c) => {
      const matchTab = tabGroup ? tabGroup.match(c.rarity) : true;
      const matchSearch =
        !cardSearch ||
        c.name.toLowerCase().includes(cardSearch.toLowerCase()) ||
        c.number.includes(cardSearch);
      return matchTab && matchSearch;
    });
  }, [allCards, activeTab, cardSearch]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Onglets variantes */}
      {!loadingCards && allCards.length > 0 && (
        <TabBar cards={allCards} activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); }} />
      )}

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-3">
        <input
          type="text" value={cardSearch} onChange={(e) => setCardSearch(e.target.value)}
          placeholder="Nom ou numéro..."
          className="w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => onSelectVisible(filtered)}
            disabled={loadingCards}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--primary)]/50 hover:text-white transition-colors"
          >
            Tout sélectionner ({filtered.length})
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={onDeselectAll}
              className="rounded-lg border border-[var(--danger)]/30 px-3 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
            >
              Désélectionner ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Grille */}
      <div className="flex-1 overflow-y-auto p-4">
        {loadingCards ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            <p className="text-sm text-[var(--muted)]">Chargement des cartes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">Aucune carte dans cet onglet</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {filtered.map((card) => (
              <CardTile key={card.id} card={card} selected={selectedIds.has(card.id)} onToggle={() => onToggle(card.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mode Recherche par carte avec onglets ────────────────────────────────────

function SearchCardMode({
  query,
  onQueryChange,
  searching,
  searchDone,
  results,
  selectedIds,
  onToggle,
  onSelectGroup,
  onDeselectAll,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  searching: boolean;
  searchDone: boolean;
  results: NormalizedCard[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectGroup: (cards: NormalizedCard[]) => void;
  onDeselectAll: () => void;
}) {
  const [activeTab, setActiveTab] = useState("all");

  // Reset onglet à chaque nouvelle recherche
  useEffect(() => { setActiveTab("all"); }, [results]);

  const tabGroup = RARITY_GROUPS.find((g) => g.id === activeTab);
  const filteredResults = tabGroup
    ? results.filter((c) => tabGroup.match(c.rarity))
    : results;

  // Groupe par set après filtrage
  const groups = useMemo(() => {
    const map = new Map<string, { setName: string; cards: NormalizedCard[] }>();
    for (const card of filteredResults) {
      const key = card.set.id;
      if (!map.has(key)) map.set(key, { setName: card.set.name, cards: [] });
      map.get(key)!.cards.push(card);
    }
    return Array.from(map.entries()).map(([setId, g]) => ({ setId, ...g }));
  }, [filteredResults]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barre de recherche */}
      <div className="border-b border-[var(--border)] px-6 py-3">
        <div className="relative">
          <input
            type="text" value={query} onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Nom du Pokémon... ex : Floréclat, Dracaufeu, Pikachu"
            autoFocus
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--primary)] transition-colors"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">🔍</span>
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          )}
        </div>
        {results.length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-[var(--muted)]">
              <span className="font-medium text-white">{results.length} carte{results.length > 1 ? "s" : ""}</span>
              {" "}dans{" "}
              <span className="font-medium text-white">{groups.length} série{groups.length > 1 ? "s" : ""}</span>
            </p>
            {selectedIds.size > 0 && (
              <button onClick={onDeselectAll} className="text-xs text-[var(--danger)] hover:underline">
                Désélectionner ({selectedIds.size})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Onglets variantes (si résultats) */}
      {results.length > 0 && (
        <TabBar cards={results} activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Résultats */}
      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-medium">Tapez le nom d&apos;une carte</p>
            <p className="mt-1 text-sm">Exemple : &quot;Floréclat&quot;, &quot;Dracaufeu&quot;, &quot;Ronflex&quot;</p>
            <p className="mt-3 text-xs opacity-60">Toutes les séries et versions seront affichées</p>
          </div>
        ) : searching && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            <p className="text-sm">Recherche dans toutes les séries...</p>
          </div>
        ) : searchDone && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
            <p className="text-4xl mb-3">😕</p>
            <p className="font-medium">Aucun résultat pour &quot;{query}&quot;</p>
            <p className="mt-1 text-sm">Essayez un nom français ou vérifiez l&apos;orthographe</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {groups.map((group) => (
              <SearchResultGroup
                key={group.setId}
                group={group}
                selectedIds={selectedIds}
                onToggle={onToggle}
                onSelectAll={() => onSelectGroup(group.cards)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Groupe de résultats (mode recherche) ─────────────────────────────────────

function SearchResultGroup({
  group,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  group: { setId: string; setName: string; cards: NormalizedCard[] };
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}) {
  const allSelected = group.cards.every((c) => selectedIds.has(c.id));

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">{group.setName}</p>
          <p className="text-xs text-[var(--muted)]">
            {group.cards.length} version{group.cards.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onSelectAll}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
            allSelected
              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]/50 hover:text-white"
          }`}
        >
          {allSelected ? "✓ Toutes" : "Tout sélectionner"}
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
        {group.cards.map((card) => (
          <CardTile key={card.id} card={card} selected={selectedIds.has(card.id)} onToggle={() => onToggle(card.id)} showSet={false} />
        ))}
      </div>
    </div>
  );
}

// ─── Section série (étape 1) ──────────────────────────────────────────────────

function SerieSection({ serie, expanded, onToggle, onPickSet }: {
  serie: SerieGroup; expanded: boolean; onToggle: () => void; onPickSet: (id: string) => void;
}) {
  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-[var(--card)] transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{serie.name}</span>
          <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">{serie.sets.length}</span>
        </div>
        <span className="text-[var(--muted)] text-sm">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="grid grid-cols-1 gap-1 px-6 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {serie.sets.map((set) => <SetItem key={set.id} set={set} onClick={() => onPickSet(set.id)} />)}
        </div>
      )}
    </div>
  );
}

function SetItem({ set, onClick }: { set: TCGdexSet; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left hover:border-[var(--primary)]/50 hover:bg-[var(--card-hover)] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{set.name}</p>
        <p className="text-xs text-[var(--muted)]">
          {set.cardCount?.total ?? "?"} cartes
          {set.releaseDate && <> · {new Date(set.releaseDate).getFullYear()}</>}
        </p>
      </div>
      <span className="shrink-0 text-[var(--muted)] text-xs">→</span>
    </button>
  );
}

// ─── Footer import ────────────────────────────────────────────────────────────

function ImportFooter({ selectedCount, condition, variant, quantity, importing, progress, onConditionChange, onVariantChange, onQuantityChange, onImport }: {
  selectedCount: number; condition: string; variant: string; quantity: number; importing: boolean;
  progress: { done: number; total: number } | null;
  onConditionChange: (c: string) => void; onVariantChange: (v: string) => void; onQuantityChange: (q: number) => void; onImport: () => void;
}) {
  return (
    <div className="border-t border-[var(--border)] px-6 py-4">
      {importing && progress && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">Import en cours...</span>
            <span className="font-medium text-[var(--primary)]">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border)]">
            <div className="h-2 rounded-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">État</label>
            <select value={condition} onChange={(e) => onConditionChange(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]">
              {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Variante</label>
            <select value={variant} onChange={(e) => onVariantChange(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]">
              {Object.entries(VARIANT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">Qté</label>
            <input type="number" min={1} max={99} value={quantity} onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <button
          onClick={onImport}
          disabled={selectedCount === 0 || importing}
          className="ml-auto rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-52"
        >
          {importing ? "⏳ Import en cours..."
            : selectedCount === 0 ? "Sélectionnez des cartes"
            : `✅ Ajouter ${selectedCount} carte${selectedCount > 1 ? "s" : ""} au portfolio`}
        </button>
      </div>
    </div>
  );
}

// ─── Tuile de carte ───────────────────────────────────────────────────────────

function CardTile({ card, selected, onToggle, showSet = true }: {
  card: NormalizedCard; selected: boolean; onToggle: () => void; showSet?: boolean;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      onClick={onToggle}
      className={`group relative flex flex-col items-center rounded-xl border-2 p-1.5 transition-all ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-md shadow-[var(--primary)]/10"
          : "border-transparent hover:border-[var(--border)]"
      }`}
    >
      {/* Checkmark */}
      <div className={`absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
        selected ? "border-[var(--primary)] bg-[var(--primary)] text-black" : "border-[var(--border)] bg-[var(--background)] opacity-0 group-hover:opacity-100"
      }`}>
        {selected && "✓"}
      </div>

      {/* Image avec skeleton + fallback FR → EN */}
      <div className="relative mb-1 aspect-[2.5/3.5] w-full overflow-hidden rounded-lg bg-[var(--background)]">
        {!imgLoaded && !imgFailed && card.images?.small && (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-gradient-to-br from-[var(--border)] via-[var(--card)] to-[var(--border)]" />
        )}

        <CardImage
          src={card.images?.small}
          alt={card.name}
          fill
          className={`object-contain transition-opacity duration-200 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          sizes="120px"
          onLoad={() => setImgLoaded(true)}
          onFinalError={() => setImgFailed(true)}
        />

        {imgFailed && (
          <div className="flex h-full items-center justify-center text-xl">🃏</div>
        )}
      </div>

      <p className="w-full truncate text-center text-xs font-medium leading-tight mt-1">{card.name}</p>
      <p className="text-[10px] text-[var(--muted)]">#{card.number}</p>
      {showSet && card.set?.name && (
        <p className="w-full truncate text-center text-[10px] text-[var(--muted)]/60">{card.set.name}</p>
      )}
      {card.rarity && (
        <p className="mt-0.5 w-full truncate text-center text-[10px] text-[var(--primary)]">{card.rarity}</p>
      )}
    </button>
  );
}
