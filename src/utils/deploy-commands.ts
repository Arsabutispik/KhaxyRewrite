import { REST, Routes } from "discord.js";
import "dotenv/config.js";
import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import logger from "../lib/Logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commands: any[] = [];

// Prevent manual execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("❌ This script must be run using 'pnpm deploy-commands'.");
  process.exit(1);
}

// Recursive function to read all command files
async function registerCommands(...dirs: string[]) {
  for (const dir of dirs) {
    const files = await fs.promises.readdir(path.join(__dirname, dir));
    for (const file of files) {
      const stat = await fs.promises.lstat(path.join(__dirname, dir, file));
      if (stat.isDirectory()) {
        await registerCommands(path.join(dir, file));
      } else if (file.endsWith(".js")) {
        try {
          const command = (await import(pathToFileURL(path.join(__dirname, dir, file)).href)).default;
          if ("data" in command && "execute" in command) {
            commands.push(command.data.toJSON());
          } else {
            logger.warn(
              `The command at ${path.join(__dirname, dir, file)} is missing a required "data" or "execute" property.`,
            );
          }
        } catch (e) {
          logger.log({
            level: "error",
            message: "Error loading command",
            error: e,
            meta: { file: path.join(__dirname, dir, file) },
          });
        }
      }
    }
  }
}

// Load commands from the folder
await registerCommands("../slash_commands");

if (!process.env.TOKEN) {
  logger.error("❌ Token is not defined in the .env file", { discord: false });
  process.exit(1);
}

// Create a REST client
const rest = new REST().setToken(process.env.TOKEN);

// Deploy commands based on environment
(async () => {
  try {
    logger.info(`🚀 Deploying ${commands.length} application (/) commands...`, { discord: false });

    let data;
    if (!process.env.CLIENT_ID) {
      logger.error("❌ Client ID is not defined in the .env file", { discord: false });
      process.exit(1);
    }
    if (process.env.NODE_ENV === "development") {
      if (!process.env.GUILD_ID) {
        logger.error("❌ Guild ID is not defined in the .env file", { discord: false });
        process.exit(1);
      }
      console.log("🛠️ Running in development mode: Deploying to guild only.");
      data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
        body: commands,
      });
    } else if (process.env.NODE_ENV === "production") {
      console.log("🌍 Running in production mode: Deploying globally.");
      data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } else {
      logger.error("❌ NODE_ENV is not defined in the .env file", { discord: false });
      process.exit(1);
    }

    //@ts-ignore
    logger.info(`✅ Successfully deployed ${data.length} application (/) commands.`, { discord: false });
  } catch (error) {
    logger.log({
      level: "error",
      message: "❌ Error deploying application (/) commands",
      error: error,
      discord: false,
    });
  }
})();
