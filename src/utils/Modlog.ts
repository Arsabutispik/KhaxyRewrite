import dayjs, { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import "dayjs/locale/en.js";
import "dayjs/locale/tr.js";
import { ChannelType, Client, Guild, User } from "discord.js";
import type { PartialUser } from "discord.js";
import { logger } from "@lib";
import { toStringId } from "@utils";
import { createGuildConfig, getGuildConfig, updateGuildConfig } from "@database";

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

export async function modlog(
  data: {
    guild: Guild;
    user: User | PartialUser;
    action: actions;
    moderator: User | PartialUser;
    reason?: string;
    duration?: Dayjs;
    caseID?: number;
  },
  client: Client,
) {
  const { guild, user, action, moderator, reason, duration, caseID } = data;
  // Fetch guild configuration from the database
  const guild_data = await getGuildConfig(guild.id);
  // If no guild configuration is found, create a new one
  if (!guild_data) {
    try {
      logger.log({
        level: "warning",
        message: `No guild config found for ${guild.id}. Creating a new one.`,
        discord: false,
      });
      await createGuildConfig(guild.id, {});
      logger.log({
        level: "info",
        message: `Guild config for ${guild.id} created successfully.`,
        discord: false,
      });
    } catch (error) {
      logger.log({
        level: "error",
        message: `Error creating guild config for ${guild.id}`,
        error: error,
        meta: {
          guildID: guild.id,
        },
      });
    }
    return { message: client.i18next.getFixedT("en")("mod_log.function_errors.no_guild_config"), type: "WARNING" };
  }
  const lang = guild_data.language || "en";
  const t = client.i18next.getFixedT(lang);
  // If mod log channel is not configured, exit the function
  if (!guild_data.mod_log_channel_id) {
    return { message: t("mod_log.function_errors.no_modlog_channel"), type: "WARNING" };
  }

  const caseNumber = caseID || guild_data.case_id;
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
    const channel = await guild.channels.fetch(toStringId(guild_data.mod_log_channel_id));
    if (channel && channel.isTextBased() && channel.type === ChannelType.GuildText) {
      await channel.send({ content: message });
    }
  } catch (error) {
    logger.log({
      level: "error",
      message: `Modlog channel for ${guild.name} (${guild.id}) not found. Deleting the modlog channel id from the database...`,
      error: error,
    });
    try {
      await updateGuildConfig(guild.id, { mod_log_channel_id: null });
      logger.log({
        level: "info",
        message: `Modlog channel ID deleted for ${guild.name} (${guild.id})`,
        discord: false,
      });
    } catch (error) {
      logger.error(error);
    }
    return { message: t("mod_log.function_errors.channel_error"), type: "ERROR" };
  }

  // Update the case ID in the database if the action is not "CHANGES"
  if (action !== "CHANGES") {
    try {
      await updateGuildConfig(guild.id, { case_id: caseNumber + 1 });
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
}
