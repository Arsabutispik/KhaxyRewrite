import { SlashCommandBase } from "@customTypes";
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import _ from "lodash";
import ProgressBar from "string-progressbar";
import { formatDuration, paginate } from "@utils";
import { getGuildConfig } from "@database";

export default {
  data: new SlashCommandBuilder()
    .setName("list")
    .setNameLocalizations({
      tr: "liste",
    })
    .setDescription("List the current queue.")
    .setDescriptionLocalizations({
      tr: "Şu anki sırasını listele.",
    }),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      return interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlags.Ephemeral,
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "list");
    const queue = useQueue();
    if (!queue) {
      return interaction.reply({
        content: t("no_queue"),
        flags: MessageFlags.Ephemeral,
      });
    }
    const ChunkedTracks = _.chunk(queue.tracks.toArray(), 10);
    const timestamp = queue.node.getTimestamp()!;
    const pages = ChunkedTracks.map((tracks, index) => {
      return new EmbedBuilder()
        .setAuthor({
          name: t("embed.title", { page: index + 1, total: ChunkedTracks.length }),
        })
        .setDescription(
          t("embed.description", {
            track: queue.currentTrack,
            duration: `${ProgressBar.splitBar(timestamp.total.value, timestamp.current.value, 15)[0]} ${formatDuration(timestamp.current.value)}/${formatDuration(timestamp.total.value)}`,
            queue: tracks.map((track, i) => `${i + 1}. [${track.title}](${track.url})`).join("\n"),
          }),
        )
        .setFooter({
          text: t("embed.footer"),
        });
    });
    await paginate(interaction, pages);
  },
} as SlashCommandBase;
