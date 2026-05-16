"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface SetWithProgress {
  id: string;
  name: string;
  serie?: { id: string; name: string };
  cardCount: { total: number; official: number };
  releaseDate?: string;
  logo?: string;
  symbol?: string;
  owned: number;
  total: number;
  /** Statut TCGdex pour cette langue. `null` = jamais probé (affiché par défaut).
   *  `false` = la liste de cartes côté TCGdex est vide → masqué sauf includeEmpty. */
  hasCards: boolean | null;
  scannedCardCount: number | null;
}

type Lang = "fr" | "en" | "ja";

/** Construit l'URL du symbole de set TCGdex avec l'extension explicite.
 *  L'API retourne les URLs sans extension (content-type: text/html) — le navigateur
 *  a besoin de .webp pour charger correctement l'image.
 *  ex: sv01 → https://assets.tcgdex.net/univ/sv/sv01/symbol.webp */
function buildSymbolUrl(symbol: string | undefined, setId: string): string {
  const base = symbol ?? `https://assets.tcgdex.net/univ/${setId.match(/^([a-z]+)/)?.[1] ?? "base"}/${setId}/symbol`;
  return base.endsWith(".webp") ? base : `${base}.webp`;
}

const LANG_LABELS: Record<Lang, { label: string; flag: string }> = {
  fr: { label: "Français", flag: "🇫🇷" },
  en: { label: "Anglais", flag: "🇺🇸" },
  ja: { label: "Japonais", flag: "🇯🇵" },
};

/**
 * URL = source de vérité pour la langue. Permet de :
 *  - rester sur la même langue après un retour depuis /sets/[id]
 *  - partager un lien direct vers la liste JP/EN/FR
 *  - garder la sélection après refresh de la page
 */
function parseLang(raw: string | null): Lang {
  return raw === "en" || raw === "ja" || raw === "fr" ? raw : "fr";
}

export default function SetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlLang = parseLang(searchParams.get("lang"));

  const [sets, setSets] = useState<SetWithProgress[]>([]);
  const [hiddenEmpty, setHiddenEmpty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [filterOwned, setFilterOwned] = useState<"all" | "started" | "complete">("all");
  const [sortKey, setSortKey] = useState<"date" | "name" | "progress">("date");
  /** Inclure les sets dont TCGdex n'a pas scanné les cartes. Désactivé par
   *  défaut pour ne pas montrer 90+ sets JP vides. */
  const [includeEmpty, setIncludeEmpty] = useState(false);

  /** Change la langue et synchronise l'URL. `replace` plutôt que `push` pour
   *  ne pas polluer l'historique navigateur avec chaque switch. */
  function switchLang(next: Lang) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "fr") params.delete("lang");
    else params.set("lang", next);
    const qs = params.toString();
    router.replace(qs ? `/sets?${qs}` : "/sets", { scroll: false });
  }

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ lang: urlLang });
    if (includeEmpty) params.set("includeEmpty", "1");
    fetch(`/api/sets?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setSets(d.sets ?? []);
        setHiddenEmpty(d.hiddenEmpty ?? 0);
      })
      .finally(() => setLoading(false));
  }, [urlLang, includeEmpty]);

  const filtered = useMemo(() => {
    let result = [...sets];

    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.serie?.name.toLowerCase().includes(q)
      );
    }

    if (filterOwned === "started") result = result.filter((s) => s.owned > 0 && s.owned < s.total);
    if (filterOwned === "complete") result = result.filter((s) => s.owned > 0 && s.owned >= s.total);

    result.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "progress") {
        const pa = a.total > 0 ? a.owned / a.total : 0;
        const pb = b.total > 0 ? b.owned / b.total : 0;
        return pb - pa;
      }
      // date (défaut)
      if (!a.releaseDate && !b.releaseDate) return a.name.localeCompare(b.name);
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return b.releaseDate.localeCompare(a.releaseDate);
    });

    return result;
  }, [sets, filterText, filterOwned, sortKey]);

  const totalOwned = sets.reduce((s, set) => s + set.owned, 0);
  const startedSets = sets.filter((s) => s.owned > 0).length;
  const completeSets = sets.filter((s) => s.owned > 0 && s.owned >= s.total).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Complétion des séries</h1>
        <p className="text-[var(--muted)]">
          Visualisez votre progression dans chaque extension Pokémon TCG
        </p>
      </div>

      {/* Stats globales */}
      {!loading && totalOwned > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            { value: totalOwned, label: "Cartes possédées", color: "var(--primary)", icon: "🃏" },
            { value: startedSets, label: "Séries en cours", color: "var(--accent)", icon: "📖" },
            { value: completeSets, label: "Séries complètes", color: "var(--success)", icon: "🏆" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top, ${s.color}, transparent 70%)` }} />
              <p className="mb-1 text-3xl">{s.icon}</p>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sélecteur de langue — top niveau, change tout l'affichage */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mr-1">Langue :</span>
        {(["fr", "en", "ja"] as Lang[]).map((l) => {
          const meta = LANG_LABELS[l];
          const active = urlLang === l;
          return (
            <button
              key={l}
              onClick={() => switchLang(l)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40"
              }`}
            >
              <span className="text-base leading-none">{meta.flag}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Toggle "Voir les séries sans données TCGdex" — utile pour les complétistes
          JP qui veulent saisir manuellement les vieux sets non scannés. */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setIncludeEmpty((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
            includeEmpty
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40"
          }`}
          title="Affiche aussi les séries dont TCGdex n'a pas (encore) scanné les cartes"
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded border ${includeEmpty ? "bg-[var(--accent)] border-[var(--accent)] text-black" : "border-[var(--border)]"}`}>
            {includeEmpty ? "✓" : ""}
          </span>
          Voir aussi les séries sans données TCGdex
        </button>
        {!includeEmpty && hiddenEmpty > 0 && (
          <span className="text-xs text-[var(--muted)]">
            ({hiddenEmpty} série{hiddenEmpty > 1 ? "s" : ""} masquée{hiddenEmpty > 1 ? "s" : ""})
          </span>
        )}
      </div>

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filtrer par nom..."
          className="flex-1 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
        />

        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 gap-1">
          {[
            { key: "all", label: "Toutes" },
            { key: "started", label: "En cours" },
            { key: "complete", label: "Complètes" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterOwned(opt.key as typeof filterOwned)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterOwned === opt.key
                  ? "bg-[var(--primary)] text-black"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
        >
          <option value="date">Plus récentes</option>
          <option value="name">Nom A→Z</option>
          <option value="progress">Progression</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="shrink-0 h-[52px] w-[52px] rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded animate-pulse" />
                <div className="h-3 w-1/4 rounded animate-pulse" />
                <div className="h-1 w-full rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-[var(--muted)]">
            {filtered.length} série{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.map((set, idx) => {
            const pct = set.total > 0 ? Math.min(100, Math.round((set.owned / set.total) * 100)) : 0;
            const isComplete = set.owned > 0 && set.owned >= set.total;
            const isStarted = set.owned > 0 && !isComplete;
            const color = isComplete ? "var(--success)" : isStarted ? "var(--primary)" : "var(--border)";

            // SVG circular progress
            const r = 20;
            const circ = 2 * Math.PI * r;
            const dash = (pct / 100) * circ;

            // TCGdex partage parfois un même `id` entre plusieurs sets JP distincts
            // (ex: sv1a apparaît 9 fois pour Triplet Beat variantes). On combine id+index
            // pour garantir l'unicité côté React sans perdre d'entrée.
            return (
              <Link
                key={`${set.id}-${idx}`}
                href={`/sets/${set.id}${urlLang !== "fr" ? `?lang=${urlLang}` : ""}`}
                className="card-glow group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]/30 transition-all"
              >
                {/* Subtle hover glow bg */}
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `radial-gradient(ellipse at left, ${color}08, transparent 60%)` }} />

                {/* Circular progress ring + set symbol */}
                <div className="relative shrink-0 flex items-center justify-center" style={{ width: 52, height: 52 }}>
                  <svg width="52" height="52" className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="26" cy="26" r={r} fill="none" stroke="var(--background)" strokeWidth="3.5" />
                    <circle
                      cx="26" cy="26" r={r} fill="none"
                      stroke={color} strokeWidth="3.5"
                      strokeDasharray={`${dash} ${circ}`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)" }}
                    />
                  </svg>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={buildSymbolUrl(set.symbol, set.id)}
                    alt=""
                    width={26}
                    height={26}
                    className="relative object-contain drop-shadow-sm symbol-img"
                    style={{ filter: pct === 0 ? "grayscale(0.5) opacity(0.6)" : "none" }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = "none";
                      const span = img.nextElementSibling as HTMLElement | null;
                      if (span) span.style.display = "block";
                    }}
                  />
                  <span className="absolute text-[11px] font-black" style={{ color, display: "none" }}>
                    {pct}%
                  </span>
                </div>

                {/* Infos */}
                <div className="relative flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold truncate">{set.name}</p>
                    {isComplete && (
                      <span className="shrink-0 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
                        ✓ Complète
                      </span>
                    )}
                    {isStarted && (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/12 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                        En cours
                      </span>
                    )}
                    {set.hasCards === false && (
                      <span
                        className="shrink-0 rounded-full bg-[var(--danger)]/12 px-2 py-0.5 text-[10px] font-bold text-[var(--danger)]"
                        title="TCGdex n'a pas (encore) scanné les cartes de cette série"
                      >
                        ⚠ Sans visuels
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-2">
                    {set.serie?.name ?? "—"}
                    {set.releaseDate ? ` · ${set.releaseDate.slice(0, 4)}` : ""}
                  </p>

                  {/* Flat progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-[var(--background)] overflow-hidden">
                      <div
                        className="h-full rounded-full progress-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color }}>
                      {set.owned}<span className="text-[var(--muted)] font-normal">/{set.total}</span>
                    </span>
                  </div>
                </div>

                <span className="relative shrink-0 text-[var(--border)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
