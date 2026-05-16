"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { NormalizedCard } from "@/lib/tcgdex";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TradeCard {
  id: string;
  cardId: string;
  name: string;
  setName: string;
  number: string;
  imageSmall: string | null;
  rarity: string | null;
}

interface TradeUser {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
  reputation: number | null;
  reviewCount: number;
}

interface FairnessInfo {
  haveValue: number;
  wantValue: number;
  ratio: number | null;
  delta: number;
  verdict: "fair" | "favors_taker" | "favors_offerer" | "unknown";
  missingPriceCount: number;
}

interface TradeOffer {
  id: string;
  status: string;
  createdAt: string;
  user: TradeUser;
  have: TradeCard[];
  want: TradeCard[];
  isMatch?: boolean;
  matchCount?: number;
  fairness?: FairnessInfo;
}

const FAIRNESS_META: Record<FairnessInfo["verdict"], { label: string; color: string; emoji: string }> = {
  fair: { label: "Équitable", color: "var(--success)", emoji: "⚖️" },
  favors_taker: { label: "Bonne affaire", color: "var(--primary)", emoji: "💎" },
  favors_offerer: { label: "Déséquilibré", color: "var(--danger)", emoji: "⚠️" },
  unknown: { label: "Sans prix", color: "var(--muted)", emoji: "❔" },
};

// ─── Page principale ─────────────────────────────────────────────────────────

export default function TradesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [myOffers, setMyOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [matchToast, setMatchToast] = useState<number | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const [marketRes, mineRes] = await Promise.all([
        fetch("/api/trades"),
        fetch("/api/trades?mine=1"),
      ]);
      if (marketRes.ok) setOffers((await marketRes.json()).offers ?? []);
      if (mineRes.ok) setMyOffers((await mineRes.json()).offers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  async function handleCancel(id: string) {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    setMyOffers((prev) => prev.filter((o) => o.id !== id));
    setOffers((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleComplete(id: string) {
    const res = await fetch(`/api/trades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      const updater = (prev: TradeOffer[]) =>
        prev.map((o) => (o.id === id ? { ...o, status: "completed" } : o));
      setMyOffers(updater);
      setOffers(updater);
    }
  }

  async function handleCreated(matchCount: number) {
    setShowModal(false);
    await fetchOffers();
    if (matchCount > 0) {
      setMatchToast(matchCount);
      setTimeout(() => setMatchToast(null), 5000);
    }
  }

  function handleContact(userId: string) {
    router.push(`/messages?userId=${userId}`);
  }

  const displayed = tab === "market" ? offers : myOffers;
  const matchCount = offers.filter((o) => o.isMatch).length;

  return (
    <div>
      {/* Toast match */}
      {matchToast !== null && (
        <div className="toast fixed top-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-[var(--success)]/40 bg-[var(--background)] px-5 py-3 shadow-xl">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="font-semibold text-[var(--success)]">
              {matchToast} match{matchToast > 1 ? "es" : ""} trouvé{matchToast > 1 ? "s" : ""} !
            </p>
            <p className="text-sm text-[var(--muted)]">
              Des échangeurs cherchent vos cartes. Notifications Discord envoyées.
            </p>
          </div>
          <button
            onClick={() => setMatchToast(null)}
            className="text-[var(--muted)] hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Centre d&apos;échanges</h1>
        <p className="text-[var(--muted)]">
          Proposez vos doublons et trouvez les cartes qui vous manquent
        </p>
      </div>

      {/* Tabs + bouton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 gap-1">
          {[
            {
              key: "market",
              label: "🌐 Marché",
              badge: matchCount > 0 ? matchCount : null,
            },
            { key: "mine", label: "📋 Mes offres", badge: null },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "market" | "mine")}
              className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[var(--primary)] text-black"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {t.label}
              {t.badge != null && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--success)] px-1 text-[10px] font-bold text-black">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/trades/history"
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] hover:text-white hover:border-[var(--primary)]/40 transition-colors"
          >
            📋 Historique
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/10"
          >
            + Nouvelle offre
          </button>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-1/3 rounded animate-pulse" />
                  <div className="h-2.5 w-1/4 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-14 w-10 rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="flex gap-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="h-14 w-10 rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="h-9 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState tab={tab} onNew={() => setShowModal(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              isOwn={offer.user.id === session?.user?.id}
              onCancel={() => handleCancel(offer.id)}
              onComplete={() => handleComplete(offer.id)}
              onContact={() => handleContact(offer.user.id)}
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <CreateTradeModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

// ─── État vide ───────────────────────────────────────────────────────────────

function EmptyState({ tab, onNew }: { tab: string; onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
      <p className="mb-3 text-5xl">{tab === "market" ? "🤝" : "📋"}</p>
      <p className="font-medium">
        {tab === "market" ? "Aucune offre sur le marché" : "Vous n'avez aucune offre"}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {tab === "market"
          ? "Soyez le premier à proposer un échange !"
          : "Créez une offre pour échanger vos doublons"}
      </p>
      <button
        onClick={onNew}
        className="mt-4 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors"
      >
        + Créer une offre
      </button>
    </div>
  );
}

// ─── Carte d'offre ───────────────────────────────────────────────────────────

function OfferCard({
  offer,
  isOwn,
  onCancel,
  onComplete,
  onContact,
}: {
  offer: TradeOffer;
  isOwn: boolean;
  onCancel: () => void;
  onComplete: () => void;
  onContact: () => void;
}) {
  return (
    <div
      className={`relative rounded-2xl border bg-[var(--card)] p-4 flex flex-col gap-4 transition-colors ${
        offer.isMatch
          ? "border-[var(--success)]/50 shadow-lg shadow-[var(--success)]/5"
          : "border-[var(--border)]"
      }`}
    >
      {/* Badge match */}
      {offer.isMatch && (
        <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 rounded-full bg-[var(--success)] px-3 py-0.5 text-xs font-bold text-black">
          🎯 Match !
        </div>
      )}

      {/* Badge mes matches (vue "mes offres") */}
      {offer.matchCount != null && offer.matchCount > 0 && (
        <div className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-bold text-black">
          {offer.matchCount} match{offer.matchCount > 1 ? "es" : ""}
        </div>
      )}

      {/* Auteur */}
      <div className="flex items-center gap-2">
        <UserAvatar user={offer.user} size={32} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">
            {offer.user.name ?? "Anonyme"}
          </p>
          {offer.user.reputation != null ? (
            <div className="flex items-center gap-1">
              <StarRatingSmall score={offer.user.reputation} />
              <span className="text-xs text-[var(--muted)]">
                ({offer.user.reviewCount})
              </span>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">Nouveau membre</p>
          )}
        </div>
        <StatusBadge status={offer.status} />
      </div>

      {/* J'offre */}
      <TradeSection label="✅ Offre" cards={offer.have} accentVar="--success" />

      {/* Fairness verdict + valeurs marché */}
      {offer.fairness && <FairnessBar fairness={offer.fairness} />}

      {/* Flèche */}
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-lg">⇄</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {/* Je recherche */}
      <TradeSection label="🔍 Recherche" cards={offer.want} accentVar="--accent" />

      {/* Date */}
      <p className="text-xs text-[var(--muted)]">
        {new Date(offer.createdAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
        })}
      </p>

      {/* Actions */}
      {isOwn ? (
        <div className="flex gap-2">
          {offer.status === "open" && (
            <button
              onClick={onComplete}
              className="flex-1 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/10 py-2 text-sm font-medium text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors"
            >
              ✅ Terminé
            </button>
          )}
          <button
            onClick={onCancel}
            disabled={offer.status !== "open"}
            className="flex-1 rounded-xl border border-[var(--danger)]/30 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Annuler l&apos;offre
          </button>
        </div>
      ) : (
        <button
          onClick={onContact}
          className="w-full rounded-xl bg-[var(--primary)] py-2 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors"
        >
          💬 Envoyer un message
        </button>
      )}
    </div>
  );
}

// ─── Section cartes ───────────────────────────────────────────────────────────

function TradeSection({
  label,
  cards,
  accentVar,
}: {
  label: string;
  cards: TradeCard[];
  accentVar: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      {cards.length === 0 ? (
        <p className="text-xs text-[var(--muted)] italic">Aucune carte</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cards.slice(0, 6).map((card) => (
            <div
              key={card.id}
              title={`${card.name} — ${card.setName} #${card.number}`}
              className="group relative"
            >
              <div
                className="relative h-14 w-10 overflow-hidden rounded-lg border"
                style={{ borderColor: `var(${accentVar})` }}
              >
                {card.imageSmall ? (
                  <CardImage
                    src={card.imageSmall}
                    alt={card.name}
                    fill
                    className="object-contain"
                    sizes="48px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[var(--background)] text-base">
                    🃏
                  </div>
                )}
              </div>
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {card.name}
                <br />
                <span className="text-[var(--muted)]">
                  {card.setName} #{card.number}
                </span>
              </div>
            </div>
          ))}
          {cards.length > 6 && (
            <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-medium text-[var(--muted)]">
              +{cards.length - 6}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Barre d'équité ───────────────────────────────────────────────────────────

/**
 * Affiche un verdict visuel "Équitable / Bonne affaire / Déséquilibré" avec
 * les valeurs marché des deux côtés et un indicateur si des prix manquent.
 *
 * Calcul fait serveur-side dans `computeFairness`. Le client n'affiche que.
 */
function FairnessBar({ fairness }: { fairness: FairnessInfo }) {
  const meta = FAIRNESS_META[fairness.verdict];
  const fmt = (n: number) => `${n.toFixed(2)} €`;

  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{ borderColor: `${meta.color}40`, background: `${meta.color}0d` }}
      title={
        fairness.missingPriceCount > 0
          ? `${fairness.missingPriceCount} carte(s) sans prix marché — évaluation partielle`
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{meta.emoji}</span>
          <span className="text-xs font-bold" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {fairness.missingPriceCount > 0 && (
            <span className="text-[10px] text-[var(--muted)]">
              · {fairness.missingPriceCount} sans prix
            </span>
          )}
        </div>
        {fairness.verdict !== "unknown" && (
          <span className="text-[11px] tabular-nums text-[var(--muted)]">
            {fmt(fairness.haveValue)} <span className="opacity-60">↔</span> {fmt(fairness.wantValue)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function UserAvatar({
  user,
  size,
}: {
  user: { name?: string | null; image?: string | null } | null;
  size: number;
}) {
  if (!user) return null;
  if (user.image)
    return (
      <Image
        src={user.image}
        alt={user.name ?? "User"}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--border)]"
      />
    );
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs font-bold"
    >
      {(user.name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function StarRatingSmall({ score }: { score: number }) {
  const filled = Math.round(score);
  return (
    <span className="text-xs">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= filled ? "text-[var(--primary)]" : "text-[var(--border)]"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "open")
    return (
      <span className="rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--success)]">
        Ouvert
      </span>
    );
  if (status === "completed")
    return (
      <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
        Terminé
      </span>
    );
  return (
    <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
      Annulé
    </span>
  );
}

// ─── Modal création d'offre ───────────────────────────────────────────────────

function CreateTradeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (matchCount: number) => void;
}) {
  const [haveCards, setHaveCards] = useState<NormalizedCard[]>([]);
  const [wantCards, setWantCards] = useState<NormalizedCard[]>([]);
  const [activeSection, setActiveSection] = useState<"have" | "want" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NormalizedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/cards/search?q=${encodeURIComponent(searchQuery)}&pageSize=20`
      );
      const data = await res.json();
      setSearchResults(data.data ?? []);
    } finally {
      setSearching(false);
    }
  }

  function addCard(card: NormalizedCard) {
    if (!activeSection) return;
    if (activeSection === "have") {
      if (!haveCards.find((c) => c.id === card.id))
        setHaveCards((prev) => [...prev, card]);
    } else {
      if (!wantCards.find((c) => c.id === card.id))
        setWantCards((prev) => [...prev, card]);
    }
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeCard(section: "have" | "want", id: string) {
    if (section === "have") setHaveCards((prev) => prev.filter((c) => c.id !== id));
    else setWantCards((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (haveCards.length === 0 && wantCards.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          have: haveCards.map((c) => c.id),
          want: wantCards.map((c) => c.id),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.matchCount ?? 0);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-lg font-bold">Nouvelle offre d&apos;échange</h2>
            <p className="text-sm text-[var(--muted)]">
              Le matching automatique cherchera des contreparties à la publication
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <SectionEditor
            label="✅ Cartes que j'offre"
            cards={haveCards}
            active={activeSection === "have"}
            accentVar="--success"
            onActivate={() => {
              setActiveSection("have");
              setSearchQuery("");
              setSearchResults([]);
            }}
            onRemove={(id) => removeCard("have", id)}
          />

          <SectionEditor
            label="🔍 Cartes que je cherche"
            cards={wantCards}
            active={activeSection === "want"}
            accentVar="--accent"
            onActivate={() => {
              setActiveSection("want");
              setSearchQuery("");
              setSearchResults([]);
            }}
            onRemove={(id) => removeCard("want", id)}
          />

          {activeSection && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="mb-3 text-sm font-medium">
                Ajouter à{" "}
                <span
                  className={
                    activeSection === "have"
                      ? "text-[var(--success)]"
                      : "text-[var(--accent)]"
                  }
                >
                  {activeSection === "have" ? "mes offres" : "mes recherches"}
                </span>
              </p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher : Dracaufeu, Pikachu..."
                  autoFocus
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {searching ? "..." : "Chercher"}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                  {searchResults.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => addCard(card)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[var(--background)] transition-colors"
                    >
                      <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded-lg">
                        {card.images?.small ? (
                          <CardImage
                            src={card.images?.small}
                            alt={card.name}
                            fill
                            className="object-contain"
                            sizes="28px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-[var(--background)] text-sm">
                            🃏
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{card.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {card.set.name} · #{card.number}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs text-[var(--primary)]">
                        + Ajouter
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!searching && searchQuery && searchResults.length === 0 && (
                <p className="mt-3 text-center text-sm text-[var(--muted)]">
                  Aucune carte trouvée
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-[var(--muted)]">
            <span>
              ✅ {haveCards.length} carte{haveCards.length !== 1 ? "s" : ""} à
              offrir
            </span>
            <span className="text-[var(--border)]">·</span>
            <span>
              🔍 {wantCards.length} carte{wantCards.length !== 1 ? "s" : ""}{" "}
              recherchée{wantCards.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={
                saving || (haveCards.length === 0 && wantCards.length === 0)
              }
              className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "🔍 Recherche de matches..." : "🤝 Publier l'offre"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Éditeur de section ───────────────────────────────────────────────────────

function SectionEditor({
  label,
  cards,
  active,
  accentVar,
  onActivate,
  onRemove,
}: {
  label: string;
  cards: NormalizedCard[];
  active: boolean;
  accentVar: string;
  onActivate: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        active
          ? `border-[var(${accentVar})]/40 bg-[var(${accentVar})]/5`
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p
          className="text-sm font-semibold"
          style={{ color: `var(${accentVar})` }}
        >
          {label}
        </p>
        <button
          onClick={onActivate}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--primary)]/50 hover:text-white transition-colors"
        >
          + Ajouter
        </button>
      </div>

      {cards.length === 0 ? (
        <button
          onClick={onActivate}
          className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors"
        >
          Cliquez pour ajouter des cartes
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cards.map((card) => (
            <div key={card.id} className="group relative">
              <div className="relative h-16 w-11 overflow-hidden rounded-lg border border-[var(--border)]">
                <CardImage
                  src={card.images?.small}
                  alt={card.name}
                  fill
                  className="object-contain"
                  sizes="44px"
                />
                {!card.images?.small && (
                  <div className="flex h-full items-center justify-center bg-[var(--background)] text-base">
                    🃏
                  </div>
                )}
                <button
                  onClick={() => onRemove(card.id)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  ✕
                </button>
              </div>
              <p className="mt-0.5 w-11 truncate text-center text-[10px] text-[var(--muted)]">
                {card.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
