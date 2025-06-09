import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import { logger } from "@lib";
import { getGuildConfig } from "@database";

export default {
  clientPermissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  data: new SlashCommandBuilder()
    .setName("play")
    .setNameLocalizations({
      tr: "çal",
    })
    .setDescription("Play a song in the voice channel.")
    .setDescriptionLocalizations({
      tr: "Sesli kanalda bir şarkı çal.",
    })
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("query")
        .setNameLocalizations({
          tr: "şarkı",
        })
        .setDescription("The song to play.")
        .setDescriptionLocalizations({
          tr: "Çalınacak şarkı.",
        })
        .setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      return interaction.editReply({
        content: "This server is not configured yet.",
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "play");
    const query = interaction.options.getString("query", true);
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        content: t("not_in_voice_channel"),
      });
    }
    if (
      interaction.guild.members.me?.voice.channel &&
      interaction.guild.members.me.voice.channel.id !== voiceChannel.id
    ) {
      return interaction.editReply({
        content: t("already_in_voice_channel"),
      });
    }
    if (!voiceChannel.permissionsFor(interaction.guild.members.me!).has(PermissionsBitField.Flags.Connect)) {
      return interaction.editReply({
        content: t("no_connect_permission"),
      });
    }
    if (!voiceChannel.permissionsFor(interaction.guild.members.me!).has(PermissionsBitField.Flags.Speak)) {
      return interaction.editReply({
        content: t("no_speak_permission"),
      });
    }
    const player = useMainPlayer();
    try {
      const result = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: {
            channel: interaction.channel,
          },
          leaveOnEnd: true,
        },
        requestedBy: interaction.user,
      });
      await interaction.editReply(t("playing", { query: result.track.title }));
    } catch (error) {
      logger.log({
        level: "error",
        error,
        message: `Error while executing play command: ${error}`,
        guildId: interaction.guildId,
        userId: interaction.user.id,
      });
      await interaction.editReply({
        content: t("error_playing"),
      });
    }
  },
} as SlashCommandBase;
