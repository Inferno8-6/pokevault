"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { StarRating } from "@/components/star-rating";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConvPartner {
  id: string;
  name: string | null;
  image: string | null;
}

interface Conversation {
  partner: ConvPartner;
  lastMessage: { content: string; createdAt: string; isFromMe: boolean };
  unreadCount: number;
}

interface Message {
  id: string;
  fromUserId: string;
  content: string;
  read: boolean;
  createdAt: string;
  from: { id: string; name: string | null; image: string | null };
  tradeOffer?: {
    id: string;
    status: string;
    items: { card: { name: string; imageSmall: string | null } }[];
  } | null;
}

interface PartnerInfo extends ConvPartner {
  reputation: number | null;
  reviewCount: number;
}

// ─── Wrapper Suspense (requis pour useSearchParams) ──────────────────────────

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /></div>}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedUserId = searchParams.get("userId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(
    preselectedUserId
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showRepModal, setShowRepModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Charge la liste des conversations
  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/messages");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Ouvre la conversation présélectionnée depuis ?userId=
  useEffect(() => {
    if (preselectedUserId && !activePartnerId) {
      openConversation(preselectedUserId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedUserId]);

  // Charge les messages d'une conversation
  async function openConversation(partnerId: string) {
    setActivePartnerId(partnerId);
    setLoadingMessages(true);
    setMessages([]);
    setPartner(null);

    const res = await fetch(`/api/messages/${partnerId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
      setPartner(data.partner ?? null);
      // Rafraîchit les conversations pour mettre à jour les non-lus
      fetchConversations();
    }
    setLoadingMessages(false);
  }

  // Rafraîchissement silencieux des messages toutes les 10 secondes
  const pollMessages = useCallback(async () => {
    if (!activePartnerId) return;
    try {
      const res = await fetch(`/api/messages/${activePartnerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          // Ne met à jour que si de nouveaux messages sont arrivés
          const incoming = data.messages ?? [];
          if (incoming.length > prev.length) return incoming;
          return prev;
        });
      }
    } catch {
      // silencieux
    }
  }, [activePartnerId]);

  useEffect(() => {
    if (!activePartnerId) return;
    const interval = setInterval(pollMessages, 10_000);
    return () => clearInterval(interval);
  }, [activePartnerId, pollMessages]);

  // Scroll automatique vers le bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Envoi d'un message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activePartnerId || sending) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: activePartnerId, content }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        fetchConversations();
      }
    } finally {
      setSending(false);
    }
  }

  const myId = session?.user?.id;

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 overflow-hidden rounded-2xl border border-[var(--border)]">
      {/* ── Sidebar conversations ───────────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] p-4">
          <h2 className="text-lg font-bold">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm text-center px-4">
                Aucune conversation. Contactez quelqu'un depuis les échanges.
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvItem
                key={conv.partner.id}
                conversation={conv}
                active={activePartnerId === conv.partner.id}
                onClick={() => openConversation(conv.partner.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Zone de chat ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-[var(--background)]">
        {!activePartnerId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-[var(--muted)]">
            <p className="text-5xl mb-4">💬</p>
            <p className="text-lg font-medium">Sélectionnez une conversation</p>
            <p className="text-sm mt-1">
              ou contactez un échangeur depuis le Marché
            </p>
          </div>
        ) : (
          <>
            {/* Header du chat */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={partner} size={36} />
                <div>
                  <p className="font-semibold">{partner?.name ?? "..."}</p>
                  {partner?.reputation != null && (
                    <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <StarRating score={partner.reputation} small />
                      <span>({partner.reviewCount} avis)</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowRepModal(true)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--primary)]/50 hover:text-white transition-colors"
              >
                ⭐ Laisser un avis
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
                  <p className="text-3xl mb-2">👋</p>
                  <p className="text-sm">
                    Démarrez la conversation avec {partner?.name ?? "cet utilisateur"}
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isFromMe={msg.fromUserId === myId}
                  />
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input envoi */}
            <form
              onSubmit={handleSend}
              className="flex items-end gap-3 border-t border-[var(--border)] bg-[var(--card)] p-4"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Votre message... (Entrée pour envoyer)"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Envoyer →
              </button>
            </form>
          </>
        )}
      </div>

      {/* Modal réputation */}
      {showRepModal && activePartnerId && (
        <ReputationModal
          userId={activePartnerId}
          userName={partner?.name ?? "cet utilisateur"}
          onClose={() => setShowRepModal(false)}
          onSaved={() => {
            setShowRepModal(false);
            if (activePartnerId) openConversation(activePartnerId);
          }}
        />
      )}
    </div>
  );
}

// ─── Item de conversation ────────────────────────────────────────────────────

function ConvItem({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        active
          ? "bg-[var(--primary)]/10 border-r-2 border-[var(--primary)]"
          : "hover:bg-[var(--background)]"
      }`}
    >
      <UserAvatar user={conversation.partner} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-medium">
            {conversation.partner.name ?? "Anonyme"}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-xs font-bold text-black">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--muted)]">
          {conversation.lastMessage.isFromMe ? "Vous : " : ""}
          {conversation.lastMessage.content}
        </p>
      </div>
    </button>
  );
}

// ─── Bulle de message ────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isFromMe,
}: {
  message: Message;
  isFromMe: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex items-end gap-2 ${isFromMe ? "flex-row-reverse" : ""}`}>
      {!isFromMe && <UserAvatar user={message.from} size={28} />}

      <div className="max-w-[70%]">
        {/* Contexte offre si présent */}
        {message.tradeOffer && (
          <div className="mb-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
            🤝 En lien avec une offre d'échange
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isFromMe
              ? "rounded-br-sm bg-[var(--primary)] text-black"
              : "rounded-bl-sm bg-[var(--card)] text-white"
          }`}
        >
          {message.content}
        </div>
        <p
          className={`mt-1 text-xs text-[var(--muted)] ${isFromMe ? "text-right" : ""}`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

// ─── Avatar utilisateur ──────────────────────────────────────────────────────

function UserAvatar({
  user,
  size,
}: {
  user: { name?: string | null; image?: string | null } | null;
  size: number;
}) {
  if (!user) {
    return (
      <div
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-[var(--border)] text-[var(--muted)] flex items-center justify-center text-sm"
      >
        ?
      </div>
    );
  }

  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name ?? "User"}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--border)]"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="shrink-0 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold"
    >
      {(user.name ?? "?")[0].toUpperCase()}
    </div>
  );
}

// ─── Modal laisser un avis ───────────────────────────────────────────────────

function ReputationModal({
  userId,
  userName,
  onClose,
  onSaved,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/reputation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, score, comment }),
      });
      if (res.ok) onSaved();
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
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Évaluer {userName}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sélection étoiles */}
          <div className="mb-5 text-center">
            <p className="mb-3 text-sm text-[var(--muted)]">
              Comment s&apos;est passé l&apos;échange ?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore(i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-4xl transition-transform hover:scale-110"
                >
                  <span
                    className={
                      i <= (hovered || score)
                        ? "text-[var(--primary)]"
                        : "text-[var(--border)]"
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm font-medium">
              {["", "Très mauvais", "Mauvais", "Correct", "Bien", "Excellent"][score]}
            </p>
          </div>

          {/* Commentaire */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium">
              Commentaire <span className="text-[var(--muted)]">(optionnel)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Livraison rapide, carte en parfait état..."
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--muted)] hover:border-[var(--primary)]/40 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
            >
              {saving ? "Envoi..." : "⭐ Publier l'avis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
