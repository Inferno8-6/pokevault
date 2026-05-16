"use client";

/**
 * CardImage — Composant image intelligent avec fallback FR → EN → placeholder
 *
 * TCGdex ne dispose pas de scans français pour toutes les cartes (surtout les
 * anciennes extensions). Ce composant tente d'abord l'image française, puis
 * l'image anglaise (même artwork, même CDN TCGdex), et n'affiche le placeholder
 * qu'en dernier recours. Un badge "EN" discret s'affiche quand le fallback anglais
 * est utilisé.
 */

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Transforme une URL d'image TCGdex FR en son équivalent EN */
function toEnglishUrl(url: string): string | null {
  if (url.includes("assets.tcgdex.net/fr/")) {
    return url.replace("assets.tcgdex.net/fr/", "assets.tcgdex.net/en/");
  }
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface CardImageProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
  onLoad?: () => void;
  /** Appelé quand FR et EN ont tous deux échoué */
  onFinalError?: () => void;
  /** Afficher le badge "EN" quand le fallback anglais est utilisé (défaut: true) */
  showBadge?: boolean;
}

export function CardImage({
  src,
  alt,
  fill,
  sizes,
  priority,
  className,
  onLoad,
  onFinalError,
  showBadge = true,
}: CardImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src ?? "");
  const [failed, setFailed] = useState(!src);
  const [isFallback, setIsFallback] = useState(false);
  const triedFallback = useRef(false);

  // Reset complet quand la source change (changement de carte dans le modal, etc.)
  useEffect(() => {
    setCurrentSrc(src ?? "");
    setFailed(!src);
    setIsFallback(false);
    triedFallback.current = false;
  }, [src]);

  // pokemontcg.io CDN bloque les requêtes serveur Next.js → charger directement via le navigateur
  const isUnoptimized = currentSrc.includes("images.pokemontcg.io");

  const handleError = () => {
    if (!triedFallback.current) {
      triedFallback.current = true;
      const enUrl = toEnglishUrl(currentSrc);
      if (enUrl) {
        setCurrentSrc(enUrl);
        setIsFallback(true);
        return;
      }
    }
    // FR et EN ont échoué
    setFailed(true);
    onFinalError?.();
  };

  if (failed) return null;

  return (
    <>
      <Image
        src={currentSrc}
        alt={alt}
        fill={fill}
        sizes={sizes}
        priority={priority}
        className={className}
        onLoad={onLoad}
        onError={handleError}
        unoptimized={isUnoptimized}
      />
      {/* Badge discret signalant que l'image est en anglais (pas de scan FR disponible) */}
      {isFallback && showBadge && (
        <span className="pointer-events-none absolute bottom-1 right-1 z-10 rounded bg-black/60 px-1 py-px text-[7px] font-bold leading-none tracking-wide text-white/80 backdrop-blur-sm">
          EN
        </span>
      )}
    </>
  );
}
