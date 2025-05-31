import { SlashCommandBase } from "../../../@types/types";
import { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionsBitField } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import { useQueue } from "discord-player";
import { toStringId, vote } from "../../utils/utils.js";

export default {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setNameLocalizations({
      tr: "karıştır",
    })
    .setDescription("Shuffle the current queue.")
    .setDescriptionLocalizations({
      tr: "Şu anki sırayı karıştır.",
    })
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const { rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guild.id,
    ]);
    const guild_config = rows[0];
    if (!guild_config) {
      return interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlags.Ephemeral,
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "shuffle");
    const queue = useQueue();
    if (!queue) {
      return interaction.reply({
        content: t("no_queue"),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (queue.tracks.size < 2) {
      return interaction.reply({
        content: t("not_enough_tracks"),
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
        content: t("shuffle_vote", {
          user: interaction.user.toString(),
          count: requiredVotes,
        }),
        withResponse: true,
      });
      const result = await vote(interaction, filter, message.resource!.message!);
      if (result) {
        await interaction.followUp({
          content: t("shuffle_vote_success"),
        });
        queue.tracks.shuffle();
      } else {
        await interaction.followUp({
          content: t("shuffle_vote_fail"),
        });
      }
    } else {
      await interaction.reply({
        content: t("shuffle_vote_success"),
        flags: MessageFlags.Ephemeral,
      });
      queue.tracks.shuffle();
    }
  },
} as SlashCommandBase;
