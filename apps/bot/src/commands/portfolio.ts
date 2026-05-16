import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { formatPrice } from "@pokemon/shared";
import type { BotCommand } from "../index";

export const portfolioCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("portfolio")
    .setDescription("View your Pokemon card portfolio") as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    // TODO: Fetch from database once auth is connected
    const embed = new EmbedBuilder()
      .setTitle("Your Portfolio")
      .setDescription("Your Pokemon card collection overview")
      .setColor(0xf59e0b)
      .addFields(
        { name: "Total Cards", value: "0", inline: true },
        { name: "Total Value", value: formatPrice(0, "EUR"), inline: true },
        { name: "24h Change", value: "+0.00%", inline: true }
      )
      .setFooter({ text: "Use the web dashboard for full portfolio management" });

    await interaction.editReply({ embeds: [embed] });
  },
};
