import { EventBase } from "@customTypes";
import { AuditLogEvent, Events, PermissionsBitField } from "discord.js";
import { logger } from "@lib";
import { toStringId, modLog } from "@utils";
import { getGuildConfig } from "@database";

export default {
  name: Events.GuildBanRemove,
  async execute(ban) {
    // Fetch guild data from the database
    const guild_config = await getGuildConfig(ban.guild.id);

    // If no guild data is found, exit the function
    if (!guild_config) return;

    // If mod log channel is configured but does not exist, exit the function
    if (guild_config.mod_log_channel_id && !ban.guild.channels.cache.has(toStringId(guild_config.mod_log_channel_id)))
      return;

    // If the bot does not have permission to view audit logs, log the unban without audit log details
    if (!ban.guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
      await modLog(
        {
          guild: ban.guild,
          action: "UNBAN",
          user: ban.user,
          moderator: ban.client.user,
          reason: ban.client.i18next.getFixedT(guild_config.language)("events:guildBanRemove.noPermission"),
        },
        ban.client,
      );
      return;
    }

    try {
      // Fetch the most recent audit log entry for MemberBanRemove
      const auditLog = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
      const entry = auditLog.entries.first();

      // If no audit log entry is found or the executor is the bot itself, exit the function
      if (!entry || entry.executor?.id === ban.client.user.id) return;

      // If the target of the audit log entry does not match the unbanned user, log the unban with a mismatch reason
      if (entry.target?.id !== ban.user.id) {
        await modLog(
          {
            guild: ban.guild,
            action: "UNBAN",
            user: ban.user,
            moderator: ban.client.user,
            reason: ban.client.i18next.getFixedT(guild_config.language)("events:guildBanRemove.executorNotMatch"),
          },
          ban.client,
        );
        return;
      }

      // Log the unban with details from the audit log entry
      await modLog(
        {
          guild: ban.guild,
          action: "UNBAN",
          user: ban.user,
          moderator: entry.executor!,
          reason: entry.reason || ban.client.i18next.getFixedT(guild_config.language)("events:guildBanRemove.noReason"),
        },
        ban.client,
      );
    } catch (error) {
      // If an error occurs while fetching audit logs, log the unban with an error reason
      await modLog(
        {
          guild: ban.guild,
          action: "UNBAN",
          user: ban.user,
          moderator: ban.client.user,
          reason: ban.client.i18next.getFixedT(guild_config.language)("events:guildBanRemove.errorOnFetchAuditLogs"),
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
} satisfies EventBase<Events.GuildBanRemove>;
