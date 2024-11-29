import {EventBase, KhaxyClient} from "../../@types/types";
import {Events, Interaction} from "discord.js";
import {log} from "../utils/utils.js";

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction: Interaction) {
        if(!interaction.isChatInputCommand()) return;
        if(interaction.guildId && !(await(interaction.client as KhaxyClient).pgClient.query('SELECT EXISTS (SELECT 1 FROM guilds WHERE id = $1)', [interaction.guildId])).rows[0]) {
            log("WARNING", "interactionCreate.ts", `Guild config for ${interaction.guildId} not found. Creating...`);
            try {
                await (interaction.client as KhaxyClient).pgClient.query('INSERT INTO guilds (id, language) VALUES ($1, $2)', [interaction.guildId, 'en']);
                log("INFO", "interactionCreate.ts", `Guild config for ${interaction.guildId} created successfully.`);
            } catch (error) {
                log("ERROR", "interactionCreate.ts", error);
                return;
            }
        }
        const command = (interaction.client as KhaxyClient).slashCommands.get(interaction.commandName);
        if (!command) {
            log("ERROR", "interactionCreate.ts", `No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            log("ERROR", "interactionCreate.ts", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
} as EventBase