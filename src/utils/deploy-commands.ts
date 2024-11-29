import {REST, Routes} from 'discord.js';
import "dotenv/config.js";
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import {log} from "./utils.js";
const __filename = fileURLToPath(import.meta.url);
const commands: any[] = [];
const __dirname = path.dirname(__filename);
// Recursive function to read all files in a directory and subdirectories
async function registerCommands(...dirs: string[]) {
    for (const dir of dirs) {
        const files = await fs.promises.readdir(path.join(__dirname, dir));
        for (const file of files) {
            const stat = await fs.promises.lstat(path.join(__dirname, dir, file));
            if (stat.isDirectory()) await registerCommands(path.join(dir, file));
            else {
                if (file.endsWith(".js")) {
                    try {
                        const command = (await import(pathToFileURL(path.join(__dirname, dir, file)).href)).default;
                        if ('data' in command && 'execute' in command) {
                            commands.push(command.data.toJSON());
                        } else {
                            log("WARNING", "deploy-commands.ts", `The command at ${pathToFileURL(path.join(__dirname, dir, file))} is missing a required "data" or "execute" property.`);
                        }
                    } catch (e) {
                        log("ERROR", "src/registry.js", `Error loading commands: ${e.message}`);
                        console.log(e);
                    }
                }
            }
        }
    }
}
// Change the path to the folder where your slash commands are stored
await registerCommands('../slash_commands');

if(!process.env.TOKEN) {
    throw new Error("Token is not defined in the .env file");
}
// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);
// and deploy your commands!
(async () => {
    if(!process.env.GUILD_ID) {
        throw new Error("Guild ID is not defined in the .env file");
    }
    if(!process.env.CLIENT_ID) {
        throw new Error("Client ID is not defined in the .env file");
    }
    try {
        log("INFO", "deploy-commands.ts", `Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            // Only add the comment from the line below if you don't want to deploy commands to a specific guild.
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            // Only remove the comment from the line below if you want to deploy global commands
            // Routes.applicationCommands(clientId),
            { body: commands },
        );
        //@ts-ignore
        log("INFO", "deploy-commands.ts", `Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();