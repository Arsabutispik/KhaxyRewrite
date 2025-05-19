import { MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { useTimeline } from "discord-player";
import { Guilds } from "../../../@types/DatabaseTypes";
import { SlashCommandBase } from "../../../@types/types";
import { toStringId, vote } from "../../utils/utils.js";

export default {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setNameLocalizations({
      tr: "duraklat",
    })
    .setDescription("Pause/Unpause the current track.")
    .setDescriptionLocalizations({
      tr: "Şu anda çalan parçayı duraklat/başlat.",
    })
    .setContexts(0),
  async execute(interaction) {
    const { rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guildId,
    ]);
    const guild_config = rows[0];
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not configured yet.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "pause");
    if (!interaction.member.voice.channel) {
      await interaction.reply({
        content: t("not_in_voice_channel"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const timeline = useTimeline();
    if (!timeline) {
      await interaction.reply({
        content: t("no_song_playing"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const filter = interaction.member.voice.channel.members.filter(
      (member) =>
        !member.user.bot && !member.voice.selfDeaf && !member.voice.serverDeaf && member.id !== interaction.member.id,
    );
    if (
      filter.size > 0 &&
      !(
        interaction.member.roles.cache.has(toStringId(guild_config.dj_role_id)) ||
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      )
    ) {
      let requiredVotes: number;
      const totalUsers = filter.size;
      if (totalUsers <= 2) {
        // For 1 or 2 people, just 1 vote needed
        requiredVotes = 1;
      } else {
        // Otherwise, 60% rounded up
        requiredVotes = Math.ceil(totalUsers * 0.6);
      }
      const message = await interaction.reply({
        content: timeline.paused
          ? t("resume_vote", {
              user: interaction.user.toString(),
              track: timeline.track?.title,
              count: requiredVotes,
            })
          : t("pause_vote", {
              user: interaction.user.toString(),
              track: timeline.track?.title,
              count: requiredVotes,
            }),
        withResponse: true,
      });
      const result = await vote(interaction, filter, message.resource!.message!);
      if (result) {
        if (timeline.paused) {
          await interaction.followUp({
            content: t("resumed"),
          });
          timeline.resume();
        } else {
          await interaction.followUp({
            content: t("paused"),
          });
          timeline.pause();
        }
      } else {
        await interaction.followUp({
          content: t("pause_vote_fail"),
        });
      }
    } else {
      if (timeline.paused) {
        timeline.resume();
        await interaction.reply({
          content: t("resumed"),
        });
      } else {
        timeline.pause();
        await interaction.reply({
          content: t("paused"),
        });
      }
    }
  },
} as SlashCommandBase;
