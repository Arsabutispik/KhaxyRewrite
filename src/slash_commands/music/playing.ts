import { SlashCommandBase } from "../../../@types/types";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import { useQueue } from "discord-player";
import ProgressBar from "string-progressbar";
import { formatDuration } from "../../utils/utils.js";
export default {
  data: new SlashCommandBuilder()
    .setName("playing")
    .setNameLocalizations({
      tr: "çalıyor",
    })
    .setDescription("Get the currently playing song.")
    .setDescriptionLocalizations({
      tr: "Şu anda çalan şarkıyı gösterir.",
    })
    .setContexts(0),
  async execute(interaction) {
    const { rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guildId,
    ]);
    const guild_config = rows[0];
    if (!guild_config) {
      return interaction.editReply({
        content: "This server is not configured yet.",
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "playing");
    const queue = useQueue();

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({
        content: t("no_song_playing"),
      });
    }
    const timestamp = queue.node.getTimestamp();
    if (!timestamp) {
      return interaction.editReply({
        content: t("no_song_playing"),
      });
    }
    const track = queue.currentTrack;
    const embed = new EmbedBuilder()
      .setColor("Random")
      .setAuthor({
        name: t("embed.author"),
        url: track.url,
      })
      .setDescription(t("embed.description", { track }))
      .setThumbnail(track.thumbnail)
      .setFields([
        {
          name: t("embed.fieldName0"),
          value: track.requestedBy?.toString() || "Unknown",
          inline: true,
        },
        {
          name: t("embed.fieldName1"),
          value: `${ProgressBar.splitBar(timestamp.total.value, timestamp.current.value, 15)[0]} ${formatDuration(timestamp.current.value)}/${formatDuration(timestamp.total.value)}`,
          inline: true,
        },
      ]);
    await interaction.reply({ embeds: [embed] });
  },
} as SlashCommandBase;
