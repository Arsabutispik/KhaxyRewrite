import { EventBase } from "../../@types/types";
import { AuditLogEvent, Events, PermissionsBitField } from "discord.js";
import modLog from "../utils/modLog.js";
import logger from "../lib/Logger.js";
import { toStringId } from "../utils/utils.js";
import { Guilds } from "../../@types/DatabaseTypes";

export default {
  name: Events.GuildBanAdd,
  async execute(ban) {
    // Fetch guild data from the database
    const { rows } = await ban.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [ban.guild.id]);
    // Extract the guild configuration from the database result
    const guild_config = rows[0];

    // If no guild data is found, exit the function
    if (!guild_config) return;

    // If mod log channel is configured but does not exist, exit the function
    if (guild_config.mod_log_channel_id && !ban.guild.channels.cache.has(toStringId(guild_config.mod_log_channel_id)))
      return;

    // If the bot does not have permission to view audit logs, log the ban without audit log details
    if (!ban.guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
      await modLog(
        {
          guild: ban.guild,
          action: "BAN",
          user: ban.user,
          moderator: ban.client.user,
          reason: ban.client.i18next.getFixedT(guild_config.language)("events:guildBanAdd.noPermission"),
        },
        ban.client,
      );
      return;
    }

    try {
      // Fetch the most recent audit log entry for MemberBanAdd
      const auditLog = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = auditLog.entries.first();

      // If no audit log entry is found or the executor is the bot itself, exit the function
      if (!entry || entry.executor?.id === ban.client.user.id) return;

      // If the target of the audit log entry does not match the banned user, log the ban with a mismatch reason
      if (entry.target?.id !== ban.user.id) {
        await modLog(
          {
            guild: ban.guild,
            action: "BAN",
            user: ban.user,
            moderator: ban.client.user,
            reason: ban.client.i18next.getFixedT(guild_config.language)("events:guildBanAdd.executorNotMatch"),
          },
          ban.client,
        );
        return;
      }

      // Log the ban with details from the audit log entry
      await modLog(
        {
          guild: ban.guild,
          action: "BAN",
          user: ban.user,
          moderator: entry.executor!,
          reason: entry.reason || ban.client.i18next.getFixedT(guild_config.language)("events:guildBanAdd.noReason"),
        },
        ban.client,
      );
    } catch (error) {
      // If an error occurs while fetching audit logs, log the ban with an error reason
      await modLog(
        {
          guild: ban.guild,
          action: "BAN",
          user: ban.user,
          moderator: ban.client.user,
          reason: ban.client.i18next.getFixedT(guild_config.language)("events:guildBanAdd.errorOnFetchAuditLogs"),
        },
        ban.client,
      );
      logger.log({
        level: "error",
        message: "Error fetching audit logs",
        error: error,
        meta: {
          guildID: ban.guild.id,
          userID: ban.user.id,
        },
      });
    }
  },
} satisfies EventBase<Events.GuildBanAdd>;
