import "dotenv/config";
import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { searchCommand } from "./commands/search";
import { priceCommand } from "./commands/price";
import { portfolioCommand } from "./commands/portfolio";

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Register commands
const commands = new Collection<string, BotCommand>();
const commandList: BotCommand[] = [searchCommand, priceCommand, portfolioCommand];

for (const command of commandList) {
  commands.set(command.data.name, command);
}

// Ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`[PokeVault Bot] Logged in as ${readyClient.user.tag}`);
  console.log(`[PokeVault Bot] Serving ${readyClient.guilds.cache.size} guilds`);
});

// Command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const reply = {
      content: "An error occurred while executing this command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Start
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN is required in .env");
  process.exit(1);
}

client.login(token);
