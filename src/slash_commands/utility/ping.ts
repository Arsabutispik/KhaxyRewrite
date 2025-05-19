import { SlashCommandBuilder } from "discord.js";
import { SlashCommandBase } from "../../../@types/types";
import { vote } from "../../utils/utils.js";

export default {
  data: new SlashCommandBuilder().setName("user").setDescription("Provides information about the user."),
  async execute(interaction) {
    const message = await interaction.reply({ content: "Test", withResponse: true });
    const users = await interaction.guild.members.fetch();
    const result = await vote(
      interaction,
      users.filter((user) => user.user.id !== interaction.user.id && !user.user.bot),
      message.resource!.message!,
    );
    if (result) {
      await interaction.followUp("Voting successful!");
    } else {
      await interaction.followUp("Voting failed.");
    }
  },
} as SlashCommandBase;
