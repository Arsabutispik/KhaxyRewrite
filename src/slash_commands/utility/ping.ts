import {SlashCommandBuilder} from 'discord.js';
import {SlashCommandBase} from "../../../@types/types";
import {replacePlaceholders} from "../../utils/utils.js";
export default {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Provides information about the user.'),
    async execute(interaction) {
        await interaction.reply({content: replacePlaceholders("Just a test command for the user command. #{interaction.member.user.username}", interaction, "bad value")});
    },
} as SlashCommandBase;
