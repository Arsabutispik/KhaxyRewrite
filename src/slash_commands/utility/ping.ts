import { SlashCommandBuilder } from "discord.js";
import { SlashCommandBase } from "../../../@types/types";

export default {
  data: new SlashCommandBuilder().setName("user").setDescription("Provides information about the user."),
  async execute(interaction) {
    interaction.client.users.fetch("1270308971181506614").then(async (user) => {
      console.log(user);
      await interaction.reply({
        content: `User: ${user.tag}`,
        ephemeral: true,
      });
    });
  },
} as SlashCommandBase;
