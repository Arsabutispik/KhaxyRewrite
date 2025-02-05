import { EventBase, KhaxyClient } from "../../@types/types";
import { Events, GuildBan, PermissionsBitField, AuditLogEvent } from "discord.js";
import { GuildTypes } from "../../@types/PostgreTypes";
import modLog from "../utils/modLog.js";
import logger from "../lib/logger.js";

export default {
  name: Events.GuildBanAdd,
  once: false,
  async execute(ban: GuildBan) {
    // Fetch guild data from the database
    const { rows } = (await (ban.client as KhaxyClient).pgClient.query("SELECT * FROM guilds WHERE id = $1", [
      ban.guild.id,
    ])) as { rows: GuildTypes[] };

    // If no guild data is found, exit the function
    if (rows.length === 0) return;

    // If mod log channel is configured but does not exist, exit the function
    if (rows[0].mod_log_channel && !ban.guild.channels.cache.has(rows[0].mod_log_channel)) return;

    // If the bot does not have permission to view audit logs, log the ban without audit log details
    if (!ban.guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
      await modLog(
        {
          guild: ban.guild,
          action: "BAN",
          user: ban.user,
          moderator: ban.client.user,
          reason: (ban.client as KhaxyClient).i18next.getFixedT(rows[0].language)("events:guildBanAdd.noPermission"),
        },
        ban.client as KhaxyClient,
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
            reason: (ban.client as KhaxyClient).i18next.getFixedT(rows[0].language)(
              "events:guildBanAdd.executorNotMatch",
            ),
          },
          ban.client as KhaxyClient,
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
          reason:
            entry.reason ||
            (ban.client as KhaxyClient).i18next.getFixedT(rows[0].language)("events:guildBanAdd.noReason"),
        },
        ban.client as KhaxyClient,
      );
    } catch (error) {
      // If an error occurs while fetching audit logs, log the ban with an error reason
      await modLog(
        {
          guild: ban.guild,
          action: "BAN",
          user: ban.user,
          moderator: ban.client.user,
          reason: (ban.client as KhaxyClient).i18next.getFixedT(rows[0].language)(
            "events:guildBanAdd.errorOnFetchAuditLogs",
          ),
        },
        ban.client as KhaxyClient,
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
} as EventBase;
