"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Heatmap GitHub-style : une cellule = un jour. La couleur reflète l'intensité
 * d'activité (ajouts collection, trades, scellés, classeurs).
 *
 * Layout : colonnes = semaines (la plus ancienne à gauche), lignes = jours
 * de la semaine (dim → sam). Les jours sans data dans la première colonne
 * sont laissés vides pour aligner la grille sur le calendrier.
 */

interface Cell {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ActivityResponse {
  days: number;
  cells: Cell[];
  summary: { total: number; activeDays: number; maxDay: number };
}

const CELL = 11; // px
const GAP = 3; // px
const WEEKDAY_LABELS = ["", "L", "", "M", "", "V", ""]; // Affiche Lun/Mer/Ven pour la verticalité

/**
 * Bucketise une intensité en 5 niveaux 0..4.
 * Échelle non-linéaire (log) pour éviter qu'un jour à 50 cartes écrase la lisibilité.
 */
function intensityLevel(count: number, maxDay: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (maxDay <= 1) return 4;
  const ratio = Math.log(count + 1) / Math.log(maxDay + 1);
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

const LEVEL_COLORS = [
  "var(--border)", // 0 : aucun
  "#2d4a2b",       // 1 : faible
  "#3f6e3d",       // 2 : moyen
  "#5da45a",       // 3 : élevé
  "#7dd87a",       // 4 : très élevé
];

export function ActivityHeatmap({ days = 365 }: { days?: number }) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [hovered, setHovered] = useState<Cell | null>(null);

  useEffect(() => {
    fetch(`/api/profile/activity?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [days]);

  /** Pré-calcule la grille semaine × jour pour éviter de remap à chaque render. */
  const grid = useMemo(() => {
    if (!data) return null;
    const cells = data.cells;
    if (cells.length === 0) return null;

    // Première cellule = padding pour aligner sur la semaine (dim = 0)
    const firstDate = new Date(cells[0].date + "T00:00:00Z");
    const firstWeekday = firstDate.getUTCDay(); // 0 = dim
    const padded: (Cell | null)[] = Array<Cell | null>(firstWeekday).fill(null).concat(cells);

    // Découpage en colonnes de 7
    const weeks: (Cell | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }
    return weeks;
  }, [data]);

  /** Labels de mois positionnés sur la colonne où le mois commence. */
  const monthLabels = useMemo(() => {
    if (!grid) return [];
    const labels: { weekIdx: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((week, wIdx) => {
      const firstDay = week.find((d): d is Cell => d !== null);
      if (!firstDay) return;
      const m = new Date(firstDay.date + "T00:00:00Z").getUTCMonth();
      if (m !== lastMonth) {
        labels.push({
          weekIdx: wIdx,
          label: new Date(firstDay.date + "T00:00:00Z").toLocaleDateString("fr-FR", {
            month: "short",
          }).replace(".", ""),
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [grid]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="h-6 w-32 rounded animate-pulse bg-white/5 mb-3" />
        <div className="h-24 rounded animate-pulse bg-white/5" />
      </div>
    );
  }

  if (!grid || data.summary.total === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
        <p className="text-2xl mb-2">📅</p>
        <p className="font-semibold text-white">Pas encore d&apos;activité</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Ajoute des cartes, crée des classeurs ou propose des échanges pour
          remplir ton calendrier.
        </p>
      </div>
    );
  }

  const width = grid.length * (CELL + GAP) - GAP;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Activité — 12 derniers mois</h3>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span><strong className="text-white">{data.summary.total}</strong> actions</span>
          <span><strong className="text-white">{data.summary.activeDays}</strong> jours actifs</span>
          {data.summary.maxDay > 0 && (
            <span>Pic <strong className="text-white">{data.summary.maxDay}</strong>/j</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1" style={{ minWidth: width + 30 }}>
          {/* Labels de mois */}
          <div className="relative h-3" style={{ marginLeft: 18 }}>
            {monthLabels.map((m) => (
              <span
                key={`${m.weekIdx}-${m.label}`}
                className="absolute text-[10px] uppercase tracking-wider text-[var(--muted)]"
                style={{ left: m.weekIdx * (CELL + GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Labels jours de la semaine */}
            <div className="flex flex-col gap-[3px] pr-1 text-[9px] text-[var(--muted)]" style={{ width: 14 }}>
              {WEEKDAY_LABELS.map((l, i) => (
                <div key={i} className="flex items-center justify-end" style={{ height: CELL }}>
                  {l}
                </div>
              ))}
            </div>

            {/* Grille */}
            <div className="flex gap-[3px]">
              {grid.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((_, dIdx) => {
                    const cell = week[dIdx];
                    if (!cell) return <div key={dIdx} style={{ width: CELL, height: CELL }} />;
                    const level = intensityLevel(cell.count, data.summary.maxDay);
                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={() => setHovered(cell)}
                        onMouseLeave={() => setHovered(null)}
                        className="rounded-[2px] transition-transform hover:scale-125 cursor-default"
                        style={{
                          width: CELL,
                          height: CELL,
                          background: LEVEL_COLORS[level],
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Légende + tooltip */}
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <div className="h-5 min-w-[10rem]">
              {hovered && (
                <span className="text-[var(--muted)]">
                  <strong className="text-white">{hovered.count}</strong> action
                  {hovered.count > 1 ? "s" : ""} le{" "}
                  {new Date(hovered.date + "T00:00:00Z").toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
              Moins
              {LEVEL_COLORS.map((c, i) => (
                <span
                  key={i}
                  className="rounded-[2px]"
                  style={{ width: CELL, height: CELL, background: c }}
                />
              ))}
              Plus
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
