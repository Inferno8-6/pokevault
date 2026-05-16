/**
 * @deprecated Ce fichier n'est plus utilisé.
 * L'application utilise désormais exclusivement TCGdex (src/lib/tcgdex.ts)
 * pour les cartes, images et prix en français.
 * Le client pokemontcg.io (PokemonTCGClient) est conservé dans @pokemon/tcg-api
 * pour une éventuelle utilisation future mais n'est pas actif.
 */

import { PokemonTCGClient } from "@pokemon/tcg-api";

// Singleton client (inactif — conservé pour compatibilité future)
const globalForTcg = globalThis as unknown as {
  tcgClient: PokemonTCGClient | undefined;
};

export const tcg =
  globalForTcg.tcgClient ?? new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);

if (process.env.NODE_ENV !== "production") globalForTcg.tcgClient = tcg;
