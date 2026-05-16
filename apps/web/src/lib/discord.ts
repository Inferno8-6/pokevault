/**
 * Utilitaire Discord — envoi de DM via bot
 * Requiert DISCORD_BOT_TOKEN dans .env
 * Sans token : les notifications sont silencieusement ignorées
 */

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Envoie un message privé Discord à un utilisateur via son Discord ID.
 * Retourne true si envoyé, false si impossible (pas de token, ID invalide, etc.)
 */
export async function sendDiscordDM(
  discordId: string,
  content: string
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return false;

  try {
    // Étape 1 : créer ou récupérer le channel DM
    const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!dmRes.ok) return false;
    const dm = (await dmRes.json()) as { id: string };

    // Étape 2 : envoyer le message
    const msgRes = await fetch(`${DISCORD_API}/channels/${dm.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    return msgRes.ok;
  } catch {
    return false;
  }
}

/**
 * Formate une notification de match pour Discord
 */
export function formatMatchNotification(params: {
  myCardNames: string[];
  theirCardNames: string[];
  platformUrl: string;
}): string {
  const { myCardNames, theirCardNames, platformUrl } = params;

  const have = theirCardNames.slice(0, 3).join(", ");
  const want = myCardNames.slice(0, 3).join(", ");

  return [
    "🎯 **Match d'échange trouvé sur PokeVault !**",
    "",
    `✅ Ils ont ce que vous cherchez : **${have}**`,
    `🔍 Ils cherchent ce que vous avez : **${want}**`,
    "",
    `👉 Connectez-vous pour contacter cet échangeur : ${platformUrl}`,
  ].join("\n");
}
