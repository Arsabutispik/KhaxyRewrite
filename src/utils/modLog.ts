import dayjs, { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import "dayjs/locale/en.js";
import "dayjs/locale/tr.js";
import { ChannelType, Client, Guild, User } from "discord.js";
import { GuildConfig } from "../../@types/types";
import logger from "../lib/Logger.js";

// Define the possible actions for the mod log
type actions =
  | "WARNING"
  | "BAN"
  | "KICK"
  | "MUTE"
  | "TIMED_BAN"
  | "CHANGES"
  | "UNBAN"
  | "BAN_EXPIRED"
  | "TIMEOUT"
  | "UNMUTE";

export default async (
  data: {
    guild: Guild;
    user: User;
    action: actions;
    moderator: User;
    reason?: string;
    duration?: Dayjs;
    caseID?: number;
  },
  client: Client,
) => {
  const { guild, user, action, moderator, reason, duration, caseID } = data;
  // Fetch guild configuration from the database
  const { rows } = (await client.pgClient.query(
    "SELECT language, mod_log_channel_id, case_id FROM guilds WHERE id = $1",
    [guild.id],
  )) as { rows: GuildConfig[] };
  const lang = rows[0].language || "en";
  const t = client.i18next.getFixedT(lang);

  // If no guild configuration is found, create a new one
  if (!rows[0]) {
    try {
      logger.warn(`Guild config for ${guild.id} not found. Creating a new one...`);
      await client.pgClient.query("INSERT INTO guilds (id, language) VALUES ($1, $2)", [guild.id, "en"]);
      logger.info(`Guild config for ${guild.id} created successfully.`);
    } catch (error) {
      logger.error(error);
    }
    return { message: t("mod_log.function_errors.no_guild_config"), type: "WARNING" };
  }

  // If mod log channel is not configured, exit the function
  if (!rows[0].mod_log_channel) {
    return { message: t("mod_log.function_errors.no_modlog_channel"), type: "WARNING" };
  }

  const caseNumber = caseID || rows[0].case_id;
  let message = `<t:${Math.floor(Date.now() / 1000)}> \`[${caseNumber}]\``;

  dayjs.extend(relativeTime);

  // Construct the log message based on the action
  switch (action) {
    case "WARNING":
      message += t("mod_log.warning", { moderator, user, reason });
      break;
    case "BAN":
      message += t("mod_log.ban", {
        moderator,
        user,
        reason,
        emoji: client.allEmojis.get(client.config.Emojis.ban)?.format,
      });
      break;
    case "KICK":
      message += t("mod_log.kick", { moderator, user, reason });
      break;
    case "MUTE":
      message += t("mod_log.mute", { moderator, user, reason, duration: dayjs(duration).locale(lang).fromNow(true) });
      break;
    case "TIMED_BAN":
      message += t("mod_log.timed_ban", {
        moderator,
        user,
        reason,
        duration: dayjs(duration).locale(lang).fromNow(true),
        emoji: client.allEmojis.get(client.config.Emojis.ban)?.format,
      });
      break;
    case "CHANGES":
      message += t("mod_log.changes", {
        moderator,
        user,
        reason,
        case: caseID,
        time: `${Math.floor(Date.now() / 1000)}`,
      });
      break;
    case "UNBAN":
      message += t("mod_log.unban", { moderator, user, reason });
      break;
    case "BAN_EXPIRED":
      message += t("mod_log.ban_expired", { moderator, user, reason });
      break;
    case "TIMEOUT":
      message += t("mod_log.timeout", {
        moderator,
        user,
        reason,
        duration: dayjs(duration).locale(lang).fromNow(true),
      });
      break;
    case "UNMUTE":
      message += t("mod_log.unmute", { moderator, user, reason });
      break;
  }

  try {
    // Fetch the mod log channel and send the log message
    const channel = await guild.channels.fetch(rows[0].mod_log_channel);
    if (channel && channel.isTextBased() && channel.type === ChannelType.GuildText) {
      await channel.send({ content: message });
    }
  } catch (error) {
    logger.error(error);
    logger.info(
      `Modlog channel for ${guild.name} (${guild.id}) not found. Deleting the modlog channel id from the database...`,
    );
    try {
      await client.pgClient.query("UPDATE guilds SET mod_log_channel_id = NULL WHERE id = $1", [guild.id]);
      logger.info(`Modlog channel id for ${guild.id} deleted successfully.`);
    } catch (error) {
      logger.error(error);
    }
    return { message: t("mod_log.function_errors.channel_error"), type: "ERROR" };
  }

  // Update the case ID in the database if the action is not "CHANGES"
  if (action !== "CHANGES") {
    try {
      await client.pgClient.query("UPDATE guilds SET case_id = $1 WHERE id = $2", [caseNumber + 1, guild.id]);
    } catch (error) {
      logger.log({
        level: "error",
        message: "Error updating case ID",
        error: error,
        meta: {
          guildID: guild.id,
          oldCaseNumber: caseNumber,
        },
      });
      return { message: t("mod_log.function_errors.case_id_error"), type: "ERROR" };
    }
  }
};
