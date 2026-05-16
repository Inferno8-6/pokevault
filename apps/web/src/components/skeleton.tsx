/**
 * Composants de chargement réutilisables — évite la duplication de
 * `Array.from({ length: N }).map(...)` éparpillée dans les pages.
 */

interface SkeletonGridProps {
  /** Nombre de cellules à afficher. */
  count: number;
  /** Aspect-ratio CSS Tailwind (ex: "aspect-[3/4]"). Défaut : carré. */
  aspect?: string;
  /** Classes utilitaires Tailwind pour la grille (cols, gap…). */
  className?: string;
}

/** Grille de tuiles pulsantes — utile pour des grilles de cartes ou de produits. */
export function SkeletonGrid({
  count,
  aspect = "aspect-square",
  className = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
}: SkeletonGridProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${aspect} rounded-2xl animate-pulse bg-white/5`} />
      ))}
    </div>
  );
}

/** Ligne de tableau pulsante — utilisée dans le portfolio table. */
export function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 items-center gap-4 rounded-xl px-3 py-3 animate-pulse">
      <div className="col-span-5 flex items-center gap-3">
        <div className="h-12 w-9 rounded bg-white/5" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-32 rounded bg-white/5" />
          <div className="h-2 w-20 rounded bg-white/5" />
        </div>
      </div>
      {[2, 1, 2, 2].map((span, i) => (
        <div key={i} className={`col-span-${span} flex justify-end`}>
          <div className="h-3 w-14 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
