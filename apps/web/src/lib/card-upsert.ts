/**
 * Utilitaire partagé : upsert d'une carte depuis TCGdex dans la base de données.
 *
 * Supporte les trois langues exposées par TCGdex (fr / en / ja). La langue
 * persiste sur la carte (`Card.language`) — un Dracaufeu FR et un Dracaufeu JP
 * sont deux entrées distinctes avec leurs propres prix et historique.
 */
import { db } from "@pokemon/db";
import { getFullCard, normalizeFullCard, type TCGdexLanguage } from "@/lib/tcgdex";

export async function upsertCardFromTCGdex(tcgId: string, lang: TCGdexLanguage = "fr") {
  // 1. Vérifie si la carte existe déjà (le tcgId est unique tous langues confondues
  //    car TCGdex utilise le même schéma d'ID — un set JP a son propre setCode).
  const existing = await db.card.findUnique({ where: { tcgId } });
  if (existing) return existing;

  // 2. Récupère les détails depuis TCGdex
  const full = await getFullCard(tcgId, lang);
  if (!full) throw new Error(`Card ${tcgId} not found in TCGdex (${lang})`);

  const normalized = normalizeFullCard(full, lang);

  // 3. Crée la carte en DB
  const card = await db.card.create({
    data: {
      tcgId: normalized.id,
      name: normalized.name,
      setCode: normalized.set.id,
      setName: normalized.set.name,
      number: normalized.number,
      rarity: normalized.rarity ?? null,
      imageSmall: normalized.images.small,
      imageLarge: normalized.images.large,
      supertype: normalized.supertype ?? null,
      hp: normalized.hp ?? null,
      types: normalized.types ?? [],
      language: lang,
    },
  });

  // 4. Enregistre le prix initial si disponible (sauf JP — pas de source auto)
  if (lang !== "ja") {
    const price =
      normalized.cardmarket?.prices?.trendPrice ??
      normalized.cardmarket?.prices?.averageSellPrice;

    if (price) {
      await db.priceHistory.create({
        data: {
          cardId: card.id,
          source: "cardmarket",
          price,
          currency: "EUR",
        },
      });
    }
  }

  return card;
}
