import { REST, Routes } from "discord.js";
import "dotenv/config.js";
import { logger } from "@lib";

if (!process.env.TOKEN) {
  logger.error("❌ Token is not defined in the .env file", { discord: false });
  process.exit(1);
}

// Create a REST client
const rest = new REST().setToken(process.env.TOKEN);

// Deploy commands based on environment
(async () => {
  try {
    logger.info(`🚀 Removing all application (/) commands...`, { discord: false });

    if (!process.env.CLIENT_ID) {
      logger.error("❌ Client ID is not defined in the .env file", { discord: false });
      process.exit(1);
    }
    if (process.env.NODE_ENV === "development") {
      if (!process.env.GUILD_ID) {
        logger.error("❌ Guild ID is not defined in the .env file", { discord: false });
        process.exit(1);
      }
      console.log("🛠️ Running in development mode: Removing commands from a specific guild.");
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
        body: [],
      });
    } else if (process.env.NODE_ENV === "production") {
      console.log("🌍 Running in production mode: Removing commands globally.");
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
    } else {
      logger.error("❌ NODE_ENV is not defined in the .env file", { discord: false });
      process.exit(1);
    }
    logger.info(`✅ Successfully removed all application (/) commands.`, { discord: false });
  } catch (error) {
    logger.log({
      level: "error",
      message: "❌ Error deploying application (/) commands",
      error: error,
      discord: false,
    });
    console.error(error);
  }
})();
