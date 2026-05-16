"use client";

import { useState, useEffect } from "react";
import { CardImage } from "@/components/card-image";
import type { NormalizedCard } from "@/lib/tcgdex";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  number: string;
  imageSmall: string | null;
  condition: "above" | "below";
  threshold: number;
  currency: string;
  active: boolean;
  triggeredAt: string | null;
  createdAt: string;
  currentPrice: number | null;
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAlert, setEditAlert] = useState<Alert | null>(null);

  useEffect(() => { fetchAlerts(); }, []);

  async function fetchAlerts() {
    setLoading(true);
    const res = await fetch("/api/alerts");
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleToggle(id: string) {
    const res = await fetch(`/api/alerts?id=${id}`, { method: "PATCH" });
    if (res.ok) {
      const data = await res.json();
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: data.active } : a))
      );
    }
  }

  function handleEditSaved(
    id: string,
    threshold: number,
    condition: "above" | "below"
  ) {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, threshold, condition, active: true, triggeredAt: null }
          : a
      )
    );
    setEditAlert(null);
  }

  const activeCount = alerts.filter((a) => a.active).length;
  const triggeredCount = alerts.filter((a) => a.triggeredAt != null).length;
  const reachedCount = alerts.filter((a) => {
    if (!a.active || a.currentPrice == null) return false;
    return (a.condition === "above" && a.currentPrice >= a.threshold) ||
           (a.condition === "below" && a.currentPrice <= a.threshold);
  }).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Alertes de prix</h1>
        <p className="text-[var(--muted)]">
          Soyez notifié via Discord quand une carte atteint votre prix cible
        </p>
      </div>

      {/* Stats header */}
      {!loading && alerts.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { value: activeCount, label: "Alertes actives", icon: "🔔", color: "var(--primary)" },
            { value: reachedCount, label: "Prix atteints", icon: "✅", color: "var(--success)" },
            { value: triggeredCount, label: "Déclenchées (total)", icon: "📊", color: "var(--accent)" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-5"
                style={{ background: `radial-gradient(circle at top, ${s.color}, transparent 70%)` }} />
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/10"
        >
          + Nouvelle alerte
        </button>
      </div>

      {/* Liste des alertes */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="h-16 w-11 shrink-0 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded animate-pulse" />
                <div className="h-3 w-1/4 rounded animate-pulse" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-6 w-20 rounded animate-pulse" />
                <div className="h-3 w-14 rounded animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-lg animate-pulse" />
                <div className="h-8 w-14 rounded-full animate-pulse" />
                <div className="h-8 w-8 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-14 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-5"
            style={{ background: "radial-gradient(circle at center, var(--primary), transparent 70%)" }} />
          <span className="mb-3 block text-5xl">🔔</span>
          <p className="font-semibold text-lg">Aucune alerte configurée</p>
          <p className="mt-2 max-w-sm mx-auto text-center text-sm text-[var(--muted)]">
            Créez une alerte pour être notifié via Discord quand une carte atteint votre prix cible
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors shadow-lg shadow-[var(--primary)]/20"
          >
            + Créer ma première alerte
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onDelete={() => handleDelete(alert.id)}
              onToggle={() => handleToggle(alert.id)}
              onEdit={() => setEditAlert(alert)}
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <CreateAlertModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchAlerts(); }}
        />
      )}

      {/* Modal édition */}
      {editAlert && (
        <EditAlertModal
          alert={editAlert}
          onClose={() => setEditAlert(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}

// ─── Ligne d'alerte ──────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onDelete,
  onToggle,
  onEdit,
}: {
  alert: Alert;
  onDelete: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const conditionLabel = alert.condition === "above" ? "≥" : "≤";
  const conditionColor =
    alert.condition === "above" ? "text-[var(--success)]" : "text-[var(--danger)]";

  const priceReached =
    alert.currentPrice != null &&
    ((alert.condition === "above" && alert.currentPrice >= alert.threshold) ||
      (alert.condition === "below" && alert.currentPrice <= alert.threshold));

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border bg-[var(--card)] p-4 transition-colors ${
        !alert.active
          ? "border-[var(--border)] opacity-60"
          : priceReached
          ? "border-[var(--success)]/40"
          : "border-[var(--border)]"
      }`}
    >
      {/* Image */}
      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg">
        {alert.imageSmall ? (
          <CardImage
            src={alert.imageSmall}
            alt={alert.cardName}
            fill
            className="object-contain"
            sizes="44px"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--background)] text-lg">
            🃏
          </div>
        )}
      </div>

      {/* Infos carte */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{alert.cardName}</p>
        <p className="text-xs text-[var(--muted)]">
          {alert.setName} · #{alert.number}
        </p>
        {priceReached && alert.active && (
          <span className="mt-1 inline-block rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--success)]">
            ✓ Prix atteint !
          </span>
        )}
      </div>

      {/* Seuil */}
      <div className="text-right shrink-0">
        <p className={`text-lg font-bold ${conditionColor}`}>
          {conditionLabel} {alert.threshold.toFixed(2)} €
        </p>
        {alert.currentPrice != null && (
          <p className="text-xs text-[var(--muted)]">
            Actuel : {alert.currentPrice.toFixed(2)} €
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Modifier */}
        <button
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors"
          title="Modifier l'alerte"
        >
          ✏️
        </button>

        {/* Toggle actif */}
        <button
          onClick={onToggle}
          title={alert.active ? "Désactiver" : "Activer"}
          className={`h-8 w-14 rounded-full transition-colors ${
            alert.active
              ? "bg-[var(--primary)]"
              : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform mx-1 ${
              alert.active ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>

        {/* Supprimer */}
        <button
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] transition-colors"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Modal création d'alerte ─────────────────────────────────────────────────

function CreateAlertModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"search" | "configure">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NormalizedCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<NormalizedCard | null>(null);
  const [condition, setCondition] = useState<"above" | "below">("below");
  const [threshold, setThreshold] = useState("");
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

  function selectCard(card: NormalizedCard) {
    setSelectedCard(card);
    // Pré-remplir le threshold avec le prix actuel si disponible
    const price =
      card.cardmarket?.prices?.trendPrice ??
      card.cardmarket?.prices?.averageSellPrice;
    if (price) setThreshold(price.toFixed(2));
    setStep("configure");
  }

  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard || !threshold) return;
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tcgId: selectedCard.id,
          condition,
          threshold: parseFloat(threshold),
        }),
      });
      if (res.ok) {
        onCreated();
      } else if (res.status === 401) {
        // Session expirée — on redirige vers le login plutôt que d'afficher
        // un message technique. Détecte aussi le cookie obsolète après un
        // changement de NEXTAUTH_URL.
        setCreateError("Session expirée — reconnecte-toi");
        const { handleAuthError } = await import("@/lib/fetch-helper");
        handleAuthError(401);
      } else {
        const data = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        setCreateError(data.error ?? "Échec de la création");
      }
    } catch {
      setCreateError("Erreur réseau");
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
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Nouvelle alerte de prix</h2>
            <p className="text-sm text-[var(--muted)]">
              {step === "search"
                ? "Étape 1 : Choisissez une carte"
                : "Étape 2 : Configurez le seuil"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Étape 1 : Recherche */}
        {step === "search" && (
          <div>
            <form onSubmit={handleSearch} className="mb-4 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher : Dracaufeu, Pikachu..."
                autoFocus
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
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
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {searchResults.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:border-[var(--primary)]/50 hover:bg-[var(--card-hover)] transition-colors"
                  >
                    <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg">
                      <CardImage
                        src={card.images?.small}
                        alt={card.name}
                        fill
                        className="object-contain"
                        sizes="36px"
                        onFinalError={() => {}}
                      />
                      {!card.images?.small && (
                        <div className="flex h-full items-center justify-center bg-[var(--background)] text-base">🃏</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {card.set.name} · #{card.number}
                      </p>
                    </div>
                    {(card.cardmarket?.prices?.trendPrice ??
                      card.cardmarket?.prices?.averageSellPrice) != null && (
                      <p className="shrink-0 text-sm font-bold text-[var(--primary)]">
                        {(
                          card.cardmarket?.prices?.trendPrice ??
                          card.cardmarket?.prices?.averageSellPrice!
                        ).toFixed(2)}{" "}
                        €
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                Aucune carte trouvée
              </p>
            )}
          </div>
        )}

        {/* Étape 2 : Configuration */}
        {step === "configure" && selectedCard && (
          <form onSubmit={handleCreate}>
            {/* Carte sélectionnée */}
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3">
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg">
                <CardImage
                  src={selectedCard.images?.small}
                  alt={selectedCard.name}
                  fill
                  className="object-contain"
                  sizes="44px"
                />
                {!selectedCard.images?.small && (
                  <div className="flex h-full items-center justify-center bg-[var(--background)] text-xl">🃏</div>
                )}
              </div>
              <div>
                <p className="font-semibold">{selectedCard.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {selectedCard.set.name} · #{selectedCard.number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setStep("search"); setSelectedCard(null); }}
                className="ml-auto text-xs text-[var(--muted)] hover:text-white"
              >
                Changer
              </button>
            </div>

            {/* Condition */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">
                M&apos;alerter quand le prix est
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "below", label: "🔽 En dessous de", color: "var(--danger)" },
                  { value: "above", label: "🔼 Au dessus de", color: "var(--success)" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCondition(opt.value as "above" | "below")}
                    className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                      condition === opt.value
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--primary)]/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seuil */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">
                Prix seuil (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Ex: 5.00"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-lg font-bold outline-none focus:border-[var(--primary)]"
              />
            </div>

            {/* Message d'erreur */}
            {createError && (
              <p className="mb-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2.5 text-sm text-[var(--danger)]">
                ⚠️ {createError}
              </p>
            )}

            {/* Boutons */}
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
                disabled={saving || !threshold}
                className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
              >
                {saving ? "Création..." : "🔔 Créer l'alerte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Modal édition d'alerte ──────────────────────────────────────────────────

function EditAlertModal({
  alert,
  onClose,
  onSaved,
}: {
  alert: Alert;
  onClose: () => void;
  onSaved: (id: string, threshold: number, condition: "above" | "below") => void;
}) {
  const [condition, setCondition] = useState<"above" | "below">(alert.condition);
  const [threshold, setThreshold] = useState(alert.threshold.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(threshold);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Le seuil doit être un nombre positif.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts?id=${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition, threshold: parsed }),
      });
      if (res.ok) {
        onSaved(alert.id, parsed, condition);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Échec de la sauvegarde");
      }
    } catch {
      setError("Erreur réseau");
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
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Modifier l&apos;alerte</h2>
            <p className="text-sm text-[var(--muted)]">
              {alert.cardName} · {alert.setName} #{alert.number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)] hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Condition */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">
              M&apos;alerter quand le prix est
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "below", label: "🔽 En dessous de" },
                { value: "above", label: "🔼 Au dessus de" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCondition(opt.value as "above" | "below")}
                  className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                    condition === opt.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--primary)]/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Seuil */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium">Prix seuil (€)</label>
            {alert.currentPrice != null && (
              <p className="mb-2 text-xs text-[var(--muted)]">
                Prix actuel :{" "}
                <strong className="text-white">{alert.currentPrice.toFixed(2)} €</strong>
              </p>
            )}
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-lg font-bold outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Erreur */}
          {error && (
            <p className="mb-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2.5 text-sm text-[var(--danger)]">
              ⚠️ {error}
            </p>
          )}

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
              disabled={saving || !threshold}
              className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
            >
              {saving ? "Sauvegarde..." : "✅ Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
