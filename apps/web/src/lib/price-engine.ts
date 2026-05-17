import { db } from "@pokemon/db";
import { getFullCard } from "@/lib/tcgdex";
import { fetchPokemonTcgPrice, fetchPokemonTcgPrices } from "@/lib/pokemontcg";
import { sendDiscordDM } from "@/lib/discord";
import { sendPriceAlertEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://pokevault.app";

// ─── Constantes du cron de prix ──────────────────────────────────────────────

/**
 * Si une carte n'a aucun prix après tous les fallbacks (TCGdex + pokemontcg.io),
 * on la marque comme indisponible et on attend ce délai avant de retenter.
 * Évite de spammer les APIs pour des cartes qui ne sortiront jamais (promos
 * obscures, sets JP non cotés par Cardmarket).
 */
const PRICE_RETRY_AFTER_DAYS = 30;

/** Taille de batch pour respecter les rate limits API. */
const FETCH_BATCH_SIZE = 5;

/** Pause inter-batch (ms) — laisse respirer les APIs externes. */
const BATCH_PAUSE_MS = 500;

/** Nombre max de cartes traitées par tick de cron. */
const MAX_CARDS_PER_RUN = 500;

// ─── Récupère et stocke les prix (TCGdex + pokemontcg.io fallback) ───────────

/**
 * Stratégie :
 * 1. Priorité aux cartes possédées par au moins un user (utile au business).
 * 2. Skip celles qu'on sait sans cotation (priceUnavailable + retry délai non écoulé).
 * 3. TCGdex (Cardmarket) → si miss, fallback pokemontcg.io (Cardmarket EU + TCGplayer US).
 * 4. Si tous les fallbacks ratent → marque la carte priceUnavailable.
 */
export async function fetchAndStorePrices() {
  const retryThreshold = new Date(Date.now() - PRICE_RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000);

  // 1. Récupère les cartes éligibles : possédées par quelqu'un OU jamais checkées
  //    OU déjà checkées sans succès mais le délai de retry est dépassé.
  const cards = await db.card.findMany({
    where: {
      OR: [
        { priceUnavailable: false },
        { lastPriceCheckAt: null },
        { lastPriceCheckAt: { lt: retryThreshold } },
      ],
    },
    select: {
      id: true,
      tcgId: true,
      language: true,
      _count: { select: { collections: true, wishlists: true } },
    },
    take: MAX_CARDS_PER_RUN,
  });

  if (cards.length === 0) {
    console.log("[PriceEngine] Aucune carte éligible, skip");
    return { updated: 0, errors: 0, marked: 0 };
  }

  // 2. Trie : les cartes en collection / wishlist d'abord, le reste ensuite
  cards.sort((a, b) => {
    const weight = (c: typeof cards[number]) => c._count.collections + c._count.wishlists;
    return weight(b) - weight(a);
  });

  let updated = 0;
  let errors = 0;
  let marked = 0;

  for (let i = 0; i < cards.length; i += FETCH_BATCH_SIZE) {
    const batch = cards.slice(i, i + FETCH_BATCH_SIZE);
    await Promise.all(batch.map((c) => processCard(c)));
    if (i + FETCH_BATCH_SIZE < cards.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  async function processCard(card: typeof cards[number]) {
    try {
      const results = await resolvePrices(card.tcgId, card.language);
      if (results.length > 0) {
        await db.$transaction([
          ...results.map((r) =>
            db.priceHistory.create({
              data: {
                cardId: card.id,
                source: r.source,
                variant: r.variant,
                price: r.price,
                currency: "EUR",
              },
            }),
          ),
          db.card.update({
            where: { id: card.id },
            data: { lastPriceCheckAt: new Date(), priceUnavailable: false },
          }),
        ]);
        updated++;
      } else {
        await db.card.update({
          where: { id: card.id },
          data: { lastPriceCheckAt: new Date(), priceUnavailable: true },
        });
        marked++;
      }
    } catch (err) {
      console.error(`[PriceEngine] Erreur sur ${card.tcgId}`, err);
      errors++;
    }
  }

  console.log(
    `[PriceEngine] ${updated} prix MAJ, ${marked} sans cotation, ${errors} erreurs (${cards.length} traitées)`
  );
  return { updated, errors, marked };
}

/**
 * Résout les prix pour toutes les variantes connues d'une carte.
 * 1. TCGdex (Cardmarket, prix générique variant=null)
 * 2. pokemontcg.io (Cardmarket + TCGplayer par variante)
 *
 * Les cartes JP sont skip car aucune source automatique n'est fiable.
 */
async function resolvePrices(
  tcgId: string,
  language: string,
): Promise<Array<{ price: number; source: string; variant: string | null }>> {
  if (language === "ja") return [];

  const results: Array<{ price: number; source: string; variant: string | null }> = [];

  // 1. TCGdex — prix générique Cardmarket (pas de variante)
  try {
    const full = await getFullCard(tcgId);
    const cm = full?.pricing?.cardmarket;
    const tcgdexPrice = cm?.trend ?? cm?.avg ?? cm?.avg7 ?? cm?.avg30 ?? cm?.low;
    if (tcgdexPrice != null && tcgdexPrice > 0) {
      results.push({ price: tcgdexPrice, source: "cardmarket", variant: null });
    }
  } catch { /* on tente le fallback */ }

  // 2. pokemontcg.io — prix par variante
  const ptcgPrices = await fetchPokemonTcgPrices(tcgId);
  for (const vp of ptcgPrices) {
    results.push({ price: vp.price, source: vp.source, variant: vp.variant });
  }

  return results;
}

// ─── Vérifie les alertes et marque celles qui ont été déclenchées ────────────
export async function checkAlerts() {
  const alerts = await db.priceAlert.findMany({
    where: { active: true, triggeredAt: null },
    include: {
      card: {
        include: {
          prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
        },
      },
      user: { select: { id: true, name: true, email: true, discordId: true, emailNotifications: true } },
    },
  });

  let triggered = 0;

  for (const alert of alerts) {
    const currentPrice = alert.card.prices[0]?.price;
    if (currentPrice == null) continue;

    const reached =
      (alert.condition === "above" && currentPrice >= alert.threshold) ||
      (alert.condition === "below" && currentPrice <= alert.threshold);

    if (reached) {
      await db.priceAlert.update({
        where: { id: alert.id },
        data: { triggeredAt: new Date(), active: false },
      });
      triggered++;
      console.log(
        `[Alerts] Alert triggered for ${alert.user.name} — ${alert.card.name} @ ${currentPrice}€`
      );

      // 🔔 Notification Discord
      if (alert.user.discordId) {
        const conditionText = alert.condition === "above" ? "au-dessus de" : "en-dessous de";
        const msg = [
          "🔔 **Alerte de prix déclenchée sur PokeVault !**",
          "",
          `💳 **${alert.card.name}** est maintenant à **${currentPrice.toFixed(2)} €**`,
          `📊 Votre seuil : ${conditionText} **${alert.threshold.toFixed(2)} €**`,
          "",
          `👉 Voir vos alertes : ${APP_URL}/alerts`,
        ].join("\n");
        await sendDiscordDM(alert.user.discordId, msg).catch(() => {});
      }

      // 📧 Notification email
      if (alert.user.emailNotifications && alert.user.email) {
        await sendPriceAlertEmail({
          to: alert.user.email,
          cardName: alert.card.name,
          currentPrice,
          threshold: alert.threshold,
          condition: alert.condition as "above" | "below",
        });
      }
    }
  }

  return { triggered };
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

export async function getLatestPrice(cardId: string, variant?: string | null) {
  if (variant) {
    const specific = await db.priceHistory.findFirst({
      where: { cardId, variant },
      orderBy: { fetchedAt: "desc" },
    });
    if (specific) return specific;
  }
  return db.priceHistory.findFirst({
    where: { cardId },
    orderBy: { fetchedAt: "desc" },
  });
}

export async function getPriceHistory(cardId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db.priceHistory.findMany({
    where: {
      cardId,
      fetchedAt: { gte: since },
    },
    orderBy: { fetchedAt: "asc" },
  });
}

export async function getTopMovers(limit = 10) {
  type MoverRow = {
    id: string; tcg_id: string; name: string; set_name: string;
    image_small: string | null; current_price: number; previous_price: number; change: number;
  };

  const query = `
    WITH ranked AS (
      SELECT ph."cardId", ph.price,
        ROW_NUMBER() OVER (PARTITION BY ph."cardId" ORDER BY ph."fetchedAt" DESC) AS rn
      FROM price_history ph
      WHERE ph.source = 'cardmarket'
    ),
    pairs AS (
      SELECT r1."cardId",
        r1.price AS current_price,
        r2.price AS previous_price,
        CASE WHEN r2.price > 0 THEN ((r1.price - r2.price) / r2.price) * 100 ELSE 0 END AS change
      FROM ranked r1
      JOIN ranked r2 ON r1."cardId" = r2."cardId" AND r2.rn = 2
      WHERE r1.rn = 1 AND r1.price != r2.price
    )
    SELECT c.id, c."tcgId" AS tcg_id, c.name, c."setName" AS set_name,
      c."imageSmall" AS image_small, p.current_price, p.previous_price, p.change
    FROM pairs p
    JOIN cards c ON c.id = p."cardId"
    ORDER BY ABS(p.change) DESC
    LIMIT ${limit * 2}
  `;
  const rows: MoverRow[] = await db.$queryRawUnsafe(query);

  const mapped = rows.map((r) => ({
    id: r.id, tcgId: r.tcg_id, name: r.name, setName: r.set_name,
    imageSmall: r.image_small, currentPrice: r.current_price,
    previousPrice: r.previous_price, change: r.change,
  }));

  const gainers = mapped.filter((m) => m.change > 0).slice(0, limit);
  const losers = mapped.filter((m) => m.change < 0).slice(0, limit);

  return { gainers, losers };
}
