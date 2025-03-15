import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import "dayjs/locale/tr.js";
import logger from "../../lib/Logger.js";
import { Guilds, Mod_mail_threads } from "../../../@types/DatabaseTypes";
export default {
  memberPermissions: [PermissionsBitField.Flags.ModerateMembers],
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close the mod mail thread")
    .setContexts(0)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addNumberOption((option) =>
      option
        .setName("duration")
        .setNameLocalizations({
          tr: "süre",
        })
        .setDescription("Duration of the ban (only numbers 1-99)")
        .setDescriptionLocalizations({
          tr: "Yasaklanma süresi (sadece sayılar 1-99)",
        })
        .setMinValue(1)
        .setMaxValue(99)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setNameLocalizations({
          tr: "vakit",
        })
        .setDescription("Time unit of the ban duration")
        .setDescriptionLocalizations({
          tr: "Yasaklanma süresinin birimi",
        })
        .setRequired(false)
        .addChoices(
          { name: "Second(s)", value: "second" },
          { name: "Minute(s)", value: "minute" },
          { name: "Hour(s)", value: "hour" },
          { name: "Day(s)", value: "day" },
          { name: "Week(s)", value: "week" },
        ),
    ),
  async execute(interaction) {
    const client = interaction.client as KhaxyClient;
    const { rows: guild_rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guild!.id,
    ]);
    if (guild_rows.length === 0) return interaction.reply("This guild is not in the database");
    const t = client.i18next.getFixedT(guild_rows[0].language, "commands", "close");
    const { rows } = await client.pgClient.query<Mod_mail_threads>(
      "SELECT * FROM mod_mail_threads WHERE channel_id = $1",
      [interaction.channel!.id],
    );
    if (rows.length === 0) return interaction.reply(t("no_thread"));
    const duration = interaction.options.getNumber("duration");
    const time = interaction.options.getString("time");
    if (duration && !time) return interaction.reply(t("no_time"));
    if (time && !duration) return interaction.reply(t("no_duration"));
    if (duration && time) {
      dayjs.extend(dayjsduration);
      dayjs.extend(relativeTime);
      const dayjs_duration = dayjs.duration(duration, time as dayjsduration.DurationUnitType);
      const long_duration = dayjs(dayjs().add(dayjs_duration))
        .locale(guild_rows[0].language || "en")
        .fromNow(true);
      try {
        await client.pgClient.query("UPDATE mod_mail_threads SET close_date = $1 WHERE channel_id = $2", [
          dayjs().add(dayjs_duration).toISOString(),
          interaction.channel!.id,
        ]);
      } catch (e) {
        await interaction.reply(t("error"));
        logger.error({
          message: e.message,
          stack: e.stack,
        });
        return;
      }
      await interaction.reply(t("close_duration", { duration: long_duration }));
    } else {
      await client.pgClient.query("UPDATE mod_mail_threads SET status = 'closed' WHERE channel_id = $1", [
        interaction.channel!.id,
      ]);
      await interaction.reply(t("close"));
      await interaction.channel!.delete();
      try {
        await interaction.guild.members.cache
          .get(rows[0].user_id.toString())
          ?.send(t("thread_closed_dm", { guild: interaction.guild!.name }));
      } catch {
        return;
      }
    }
  },
} as SlashCommandBase;
