import {SlashCommandBuilder} from 'discord.js';
import {SlashCommandBase} from "../../../@types/types";
import logger from "../../lib/logger.js";
export default {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Provides information about the user.'),
    async execute(interaction) {
        try {
            await interaction.guild!.members.fetch("23")
        } catch (err) {
            logger.log({
                level: "error",
                message: "Error fetching user",
                error: err,
                meta: {
                    userID: interaction.user.id,
                    guildID: interaction.guildId!,
                }
            })
        }
    },
} as SlashCommandBase;
