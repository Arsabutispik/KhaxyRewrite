import {SlashCommandBuilder} from 'discord.js';
import {KhaxyClient, SlashCommandBase} from "../../../@types/types";
import modLog from "../../utils/modLog.js";
export default {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Provides information about the user.'),
    async execute(interaction) {
        // interaction.user is the object representing the User who ran the command
        // interaction.member is the GuildMember object, which represents the user in the specific guild
        await interaction.reply("Testing user command...");
        const result = await modLog({guild: interaction.guild!, user: interaction.user, action: "WARNING", moderator: interaction.user, reason: "This is a warning!"}, interaction.client as KhaxyClient);
        if(result?.message) {
            await interaction.followUp({content: result.message, ephemeral: true});
        }
    },
} as SlashCommandBase;
