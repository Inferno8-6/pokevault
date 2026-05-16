import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { PokemonTCGClient } from "@pokemon/tcg-api";
import { formatPrice } from "@pokemon/shared";
import type { BotCommand } from "../index";

const tcg = new PokemonTCGClient();

export const priceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("price")
    .setDescription("Get the price of a specific Pokemon card")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Card name")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("set")
        .setDescription("Set name (optional, for precision)")
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString("name", true);
    const setName = interaction.options.getString("set");
    await interaction.deferReply();

    try {
      const query = setName ? `name:"${name}" set.name:"${setName}"` : undefined;
      const results = await tcg.searchCards(name, {
        q: query ? query : undefined,
        pageSize: 1,
        orderBy: "-cardmarket.prices.averageSellPrice",
      });

      if (!results.data.length) {
        await interaction.editReply(`No card found for "${name}"${setName ? ` in ${setName}` : ""}`);
        return;
      }

      const card = results.data[0];
      const prices = PokemonTCGClient.getPrices(card);

      const embed = new EmbedBuilder()
        .setTitle(`${card.name} - Price Check`)
        .setDescription(`**Set:** ${card.set.name} | **#${card.number}** | ${card.rarity || "N/A"}`)
        .setColor(0xf59e0b);

      if (card.images?.large) {
        embed.setImage(card.images.large);
      }

      // Add all price sources
      for (const price of prices) {
        const lines: string[] = [];
        lines.push(`**Market:** ${formatPrice(price.price, price.currency as "EUR" | "USD")}`);
        if (price.low) lines.push(`Low: ${formatPrice(price.low, price.currency as "EUR" | "USD")}`);
        if (price.high) lines.push(`High: ${formatPrice(price.high, price.currency as "EUR" | "USD")}`);
        if (price.trend) lines.push(`Trend: ${formatPrice(price.trend, price.currency as "EUR" | "USD")}`);

        embed.addFields({
          name: price.source.replace("_", " ").toUpperCase(),
          value: lines.join("\n"),
          inline: true,
        });
      }

      if (prices.length === 0) {
        embed.addFields({ name: "Price", value: "No price data available", inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Price error:", error);
      await interaction.editReply("Failed to fetch price. Try again later.");
    }
  },
};
