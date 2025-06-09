import { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { QueueRepeatMode, useQueue } from "discord-player";
import { toStringId, vote } from "@utils";
import { getGuildConfig } from "@database";

export default {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setNameLocalizations({
      tr: "döngü",
    })
    .setDescription("Loop the current track or queue.")
    .setDescriptionLocalizations({
      tr: "Şu anki parçayı veya sırayı döngüye al.",
    })
    .setContexts(InteractionContextType.Guild)
    .addNumberOption((option) =>
      option
        .setName("mode")
        .setNameLocalizations({
          tr: "mod",
        })
        .setDescription("Select a loop mode")
        .setDescriptionLocalizations({
          tr: "Bir döngü modu seçin",
        })
        .setRequired(true)
        .addChoices(
          {
            name: "OFF",
            value: QueueRepeatMode.OFF,
            name_localizations: {
              tr: "KAPAT",
            },
          },
          {
            name: "TRACK",
            value: QueueRepeatMode.TRACK,
            name_localizations: {
              tr: "PARÇA",
            },
          },
          {
            name: "QUEUE",
            value: QueueRepeatMode.QUEUE,
            name_localizations: {
              tr: "SIRA",
            },
          },
        ),
    ),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      return interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlags.Ephemeral, // MessageFlags.Ephemeral
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "loop");
    const queue = useQueue(interaction.guild.id);
    if (!queue) {
      return interaction.reply({
        content: t("no_queue"),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (interaction.member.voice.channel?.id !== interaction.guild.members.me!.voice.channel!.id) {
      return interaction.reply({
        content: t("not_in_same_voice"),
        flags: MessageFlags.Ephemeral,
      });
    }
    const loopMode = interaction.options.getNumber("mode", true) as 0 | 1 | 2;
    const filter = interaction.member.voice.channel.members.filter(
      (member) =>
        !member.user.bot && !member.voice.selfDeaf && !member.voice.serverDeaf && member.id !== interaction.member.id,
    );
    if (
      filter.size > 0 &&
      (!interaction.member.roles.cache.has(toStringId(guild_config.dj_role_id)) ||
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
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
        content: t("loop_vote", {
          user: interaction.user.toString(),
          count: requiredVotes,
          state: t(`state.${loopMode}`),
        }),
        withResponse: true,
      });
      const result = await vote(interaction, filter, message.resource!.message!);
      if (result) {
        await interaction.followUp({
          content: t("loop_vote_success"),
        });
        queue.tracks.shuffle();
      } else {
        await interaction.followUp({
          content: t("loop_vote_fail"),
        });
      }
    } else {
      await interaction.reply({
        content: t("loop_vote_success"),
        flags: MessageFlags.Ephemeral,
      });
      queue.tracks.shuffle();
    }
  },
} as SlashCommandBase;
