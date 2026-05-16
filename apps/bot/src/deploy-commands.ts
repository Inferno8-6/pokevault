import "dotenv/config";
import { REST, Routes } from "discord.js";
import { searchCommand } from "./commands/search";
import { priceCommand } from "./commands/price";
import { portfolioCommand } from "./commands/portfolio";

const commands = [
  searchCommand.data.toJSON(),
  priceCommand.data.toJSON(),
  portfolioCommand.data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });
    console.log("Slash commands registered successfully!");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
})();
