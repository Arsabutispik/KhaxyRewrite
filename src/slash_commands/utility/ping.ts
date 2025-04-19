import { SlashCommandBuilder } from "discord.js";
import { SlashCommandBase } from "../../../@types/types";

export default {
  data: new SlashCommandBuilder().setName("user").setDescription("Provides information about the user."),
  async execute(interaction) {
    await interaction.reply("Your mother");
    console.log(await interaction.client.getGuildConfig(interaction.guildId));
  },
} as SlashCommandBase;
