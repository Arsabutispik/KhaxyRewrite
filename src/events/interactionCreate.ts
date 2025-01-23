import {EventBase, KhaxyClient} from "../../@types/types";
import {Events, GuildMember, Interaction, MessageFlagsBitField} from "discord.js";
import {log, missingPermissionsAsString} from "../utils/utils.js";

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction: Interaction) {
        // Check if the interaction is a chat input command
        if(!interaction.isChatInputCommand()) return;
        // Check if the guild configuration exists in the database
        if(interaction.guildId && !(await(interaction.client as KhaxyClient).pgClient.query('SELECT EXISTS (SELECT 1 FROM guilds WHERE id = $1)', [interaction.guildId])).rows[0]) {
            log("WARNING", "interactionCreate.ts", `Guild config for ${interaction.guildId} not found. Creating...`);
            try {
                // Insert a new guild configuration into the database
                await (interaction.client as KhaxyClient).pgClient.query('INSERT INTO guilds (id, language) VALUES ($1, $2)', [interaction.guildId, 'en']);
                log("INFO", "interactionCreate.ts", `Guild config for ${interaction.guildId} created successfully.`);
            } catch (error) {
                log("ERROR", "interactionCreate.ts", error);
                return;
            }
        }

        // Retrieve the command from the client's slash commands collection
        const command = (interaction.client as KhaxyClient).slashCommands.get(interaction.commandName);
        if (!command) {
            log("ERROR", "interactionCreate.ts", `No command matching ${interaction.commandName} was found.`);
            return;
        }
        // Retrieve the language from the guild configuration
        const language = (await (interaction.client as KhaxyClient).pgClient.query('SELECT language FROM guilds WHERE id = $1', [interaction.guildId])).rows[0].language;
        // Retrieve the translation function
        const t = (interaction.client as KhaxyClient).i18next.getFixedT(language);
        // Check if the member has the required permissions to execute the command
        if(command.memberPermissions && interaction.member instanceof GuildMember && !interaction.member.permissions.has(command.memberPermissions)) {
            const missingPermissions = missingPermissionsAsString(interaction.client as KhaxyClient, interaction.member.permissions.missing(command.memberPermissions), language);
            await interaction.reply({ content: t('events:interactionCreate.memberMissingPermissions', {permissions: missingPermissions}), flags: MessageFlagsBitField.Flags.Ephemeral });
            return;
        }
        // Check if the client has the required permissions to execute the command
        if(command.clientPermissions && interaction.guild && !interaction.guild.members.me!.permissions.has(command.clientPermissions)) {
            const missingPermissions = missingPermissionsAsString(interaction.client as KhaxyClient, interaction.guild.members.me!.permissions.missing(command.clientPermissions), language);
            await interaction.reply({ content: t('events:interactionCreate.botMissingPermissions', {permissions: missingPermissions}), flags: MessageFlagsBitField.Flags.Ephemeral });
            return;
        }
        try {
            // Execute the command
            await command.execute(interaction);
        } catch (error) {
            log("ERROR", "interactionCreate.ts", error);
            // Handle errors during command execution
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an unexpected error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an unexpected error while executing this command!', ephemeral: true });
            }
        }
    }
} as EventBase;