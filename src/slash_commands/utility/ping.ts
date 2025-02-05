import { GuildMember, SlashCommandBuilder } from "discord.js";
import { SlashCommandBase } from "../../../@types/types";
import { useMainPlayer } from "discord-player";

export default {
  data: new SlashCommandBuilder().setName("user").setDescription("Provides information about the user."),
  async execute(interaction) {
    try {
      const player = useMainPlayer();
      await interaction.deferReply();
      const result = await player.play((interaction.member! as GuildMember).voice.channel!, "rick roll", {
        nodeOptions: {
          metadata: interaction,
          leaveOnEndCooldown: 10000,
        },
        requestedBy: interaction.user,
      });
      await interaction.followUp(result.track.title);
    } catch (e) {
      console.error(e);
      await interaction.followUp("An error occurred while playing the track.");
    }
  },
} as SlashCommandBase;
