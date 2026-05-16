import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { PokemonTCGClient } from "@pokemon/tcg-api";
import { formatPrice } from "@pokemon/shared";
import type { BotCommand } from "../index";

const tcg = new PokemonTCGClient();

export const searchCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for a Pokemon card")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Card name to search for")
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString("name", true);
    await interaction.deferReply();

    try {
      const results = await tcg.searchCards(name, { pageSize: 5 });

      if (!results.data.length) {
        await interaction.editReply(`No cards found for "${name}"`);
        return;
      }

      const embeds = results.data.map((card) => {
        const prices = PokemonTCGClient.getPrices(card);
        const mainPrice = prices.find((p) => p.source === "cardmarket") || prices[0];

        const embed = new EmbedBuilder()
          .setTitle(card.name)
          .setDescription(
            `**Set:** ${card.set.name}\n**Number:** #${card.number}\n**Rarity:** ${card.rarity || "N/A"}`
          )
          .setColor(0xf59e0b);

        if (card.images?.small) {
          embed.setThumbnail(card.images.small);
        }

        if (mainPrice) {
          embed.addFields({
            name: "Price",
            value: formatPrice(mainPrice.price, mainPrice.currency as "EUR" | "USD"),
            inline: true,
          });
        }

        return embed;
      });

      await interaction.editReply({
        content: `Found ${results.totalCount} results for "${name}":`,
        embeds: embeds.slice(0, 5),
      });
    } catch (error) {
      console.error("Search error:", error);
      await interaction.editReply("Failed to search cards. Try again later.");
    }
  },
};
