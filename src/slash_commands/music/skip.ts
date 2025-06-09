import { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { toStringId, vote } from "@utils";
import { getGuildConfig } from "@database";

export default {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setNameLocalizations({
      tr: "atla",
    })
    .setContexts(InteractionContextType.Guild)
    .setDescription("Skip the current song in the queue.")
    .setDescriptionLocalizations({
      tr: "Sıradaki şarkıyı atla.",
    }),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      return interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlags.Ephemeral,
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "skip");
    const queue = useQueue();
    if (!queue) {
      return interaction.reply({
        content: t("no_queue"),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!queue.isPlaying()) {
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
        content: t("skip_vote", {
          user: interaction.user.toString(),
          track: queue.currentTrack?.title,
          count: requiredVotes,
        }),
        withResponse: true,
      });
      const result = await vote(interaction, filter, message.resource!.message!);
      if (result) {
        await interaction.followUp({
          content: t("skip_vote_success"),
        });
        queue.node.skip();
      } else {
        await interaction.followUp({
          content: t("skip_vote_fail"),
        });
      }
    } else {
      await interaction.reply({
        content: t("skip_vote_success"),
        flags: MessageFlags.Ephemeral,
      });
      queue.node.skip();
    }
  },
} as SlashCommandBase;
