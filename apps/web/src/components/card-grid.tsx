"use client";

import { useState } from "react";
import type { NormalizedCard } from "@/lib/tcgdex";
import { CardImage } from "@/components/card-image";

interface CardGridProps {
  cards: NormalizedCard[];
  onCardClick?: (card: NormalizedCard) => void;
}

export function CardGrid({ cards, onCardClick }: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--muted)]">
        Aucune carte trouvée
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card, index) => (
        <CardItem
          key={card.id}
          card={card}
          priority={index < 10}
          onClick={() => onCardClick?.(card)}
        />
      ))}
    </div>
  );
}

function CardItem({
  card,
  priority = false,
  onClick,
}: {
  card: NormalizedCard;
  priority?: boolean;
  onClick: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const price =
    card.cardmarket?.prices?.trendPrice ??
    card.cardmarket?.prices?.averageSellPrice;

  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-left transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover)] hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--primary)]/5"
    >
      {/* Zone image avec skeleton */}
      <div className="relative mb-3 aspect-[2.5/3.5] overflow-hidden rounded-xl bg-[var(--background)]">
        {/* Skeleton animé tant que l'image n'est pas chargée */}
        {!imgLoaded && !imgFailed && card.images?.small && (
          <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-br from-[var(--border)] via-[var(--card)] to-[var(--border)]" />
        )}

        {/* CardImage gère FR → EN → null automatiquement */}
        <CardImage
          src={card.images?.small}
          alt={card.name}
          fill
          className={`object-contain transition-all duration-300 group-hover:scale-105 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          priority={priority}
          onLoad={() => setImgLoaded(true)}
          onFinalError={() => setImgFailed(true)}
        />

        {imgFailed && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
            <span className="text-4xl">🃏</span>
            <p className="text-center text-xs font-medium text-[var(--muted)] leading-tight">
              {card.name}
            </p>
            <p className="text-[10px] text-[var(--muted)]/50">
              Image non disponible
            </p>
          </div>
        )}
      </div>

      <h3 className="truncate text-sm font-medium">{card.name}</h3>
      <p className="truncate text-xs text-[var(--muted)]">
        {card.set.name} · #{card.number}
      </p>

      {price != null && (
        <p className="mt-1.5 text-sm font-bold text-[var(--primary)]">
          {price.toFixed(2)} €
        </p>
      )}

      {card.rarity && (
        <span className="mt-1.5 inline-block rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
          {card.rarity}
        </span>
      )}
    </button>
  );
}
