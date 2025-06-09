import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { SlashCommandBase } from "@customTypes";

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check the bot's latency"),
  async execute(interaction) {
    await interaction.reply({
      content: `🏓 Pong! Latency is ${Date.now() - interaction.createdTimestamp}ms`,
      flags: MessageFlags.Ephemeral,
    });
  },
} as SlashCommandBase;
