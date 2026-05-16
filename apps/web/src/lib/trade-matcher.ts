/**
 * Moteur de matching des offres d'échange
 * Trouve les offres complémentaires et envoie les notifications Discord
 */

import { db } from "@pokemon/db";
import { sendDiscordDM, formatMatchNotification } from "@/lib/discord";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://pokevault.app";

/**
 * Recherche toutes les offres qui matchent avec l'offre donnée.
 * Un match = l'autre utilisateur a au moins une carte que je veux
 *           ET veut au moins une carte que j'ai.
 */
export async function findAndSaveMatches(offerId: string): Promise<number> {
  // Charge l'offre source avec ses items
  const offer = await db.tradeOffer.findUnique({
    where: { id: offerId },
    include: {
      items: { include: { card: true } },
      user: { select: { id: true, name: true, discordId: true } },
    },
  });

  if (!offer || offer.status !== "open") return 0;

  const haveCardIds = offer.items
    .filter((i) => i.direction === "have")
    .map((i) => i.cardId);

  const wantCardIds = offer.items
    .filter((i) => i.direction === "want")
    .map((i) => i.cardId);

  // Pas assez d'infos pour matcher
  if (haveCardIds.length === 0 || wantCardIds.length === 0) return 0;

  // Trouve les offres complémentaires :
  // - L'autre a en "have" au moins une carte que je veux (dans wantCardIds)
  // - L'autre a en "want" au moins une carte que j'ai (dans haveCardIds)
  const candidates = await db.tradeOffer.findMany({
    where: {
      id: { not: offerId },
      userId: { not: offer.userId },
      status: "open",
      AND: [
        { items: { some: { direction: "have", cardId: { in: wantCardIds } } } },
        { items: { some: { direction: "want", cardId: { in: haveCardIds } } } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, discordId: true } },
      items: { include: { card: { select: { id: true, name: true } } } },
    },
  });

  let newMatches = 0;

  for (const candidate of candidates) {
    // Vérifie si un match existe déjà entre ces deux offres (les deux sens)
    const existing = await db.tradeMatch.findFirst({
      where: {
        OR: [
          { offerAId: offerId, offerBId: candidate.id },
          { offerAId: candidate.id, offerBId: offerId },
        ],
      },
    });

    if (existing) continue;

    // Crée le match — normaliser l'ordre pour éviter les doublons inversés
    let match;
    try {
      match = await db.tradeMatch.create({
        data: {
          offerAId: offerId,
          offerBId: candidate.id,
          notified: false,
        },
      });
    } catch (err) {
      // Race condition : un autre process a créé le match en même temps
      console.warn(`[TradeMatch] Duplicate prevented for ${offerId}↔${candidate.id}:`, err);
      continue;
    }

    newMatches++;

    // Envoie les notifications Discord aux deux parties (non-bloquant)
    const offerHaveNames = offer.items
      .filter((i) => i.direction === "have")
      .map((i) => i.card.name);
    const offerWantNames = offer.items
      .filter((i) => i.direction === "want")
      .map((i) => i.card.name);

    const candidateHaveNames = candidate.items
      .filter((i) => i.direction === "have")
      .map((i) => i.card.name);
    const candidateWantNames = candidate.items
      .filter((i) => i.direction === "want")
      .map((i) => i.card.name);

    let notified = false;

    // Notification à l'auteur de l'offre source
    if (offer.user.discordId) {
      try {
        const msg = formatMatchNotification({
          myCardNames: offerWantNames,
          theirCardNames: candidateHaveNames,
          platformUrl: `${APP_URL}/trades`,
        });
        await sendDiscordDM(offer.user.discordId, msg);
        notified = true;
      } catch (err) {
        // Discord DM non critique — ne pas faire échouer le matching
        console.warn(`[Discord] DM failed for offer author ${offer.user.id}:`, err);
      }
    }

    // Notification à l'auteur de l'offre candidate
    if (candidate.user.discordId) {
      try {
        const msg = formatMatchNotification({
          myCardNames: candidateWantNames,
          theirCardNames: offerHaveNames,
          platformUrl: `${APP_URL}/trades`,
        });
        await sendDiscordDM(candidate.user.discordId, msg);
        notified = true;
      } catch (err) {
        console.warn(`[Discord] DM failed for candidate author ${candidate.user.id}:`, err);
      }
    }

    // Marque comme notifié si au moins un DM envoyé
    if (notified) {
      await db.tradeMatch.update({
        where: { id: match.id },
        data: { notified: true },
      });
    }
  }

  return newMatches;
}

/**
 * Retourne le nombre de matches actifs pour une offre
 */
export async function getMatchCount(offerId: string): Promise<number> {
  return db.tradeMatch.count({
    where: {
      OR: [{ offerAId: offerId }, { offerBId: offerId }],
    },
  });
}
