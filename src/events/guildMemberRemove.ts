import { EventBase } from "../../@types/types";
import { AuditLogEvent, Events, PermissionsBitField } from "discord.js";
import { replacePlaceholders, toStringId } from "../utils/utils.js";
import dayjs from "dayjs";
import modLog from "../utils/modLog.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { Mod_mail_threads } from "../../@types/DatabaseTypes";
import { ModMailThreadStatus } from "../lib/Enums.js";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    // Fetch guild data from the database
    const { rows } = await member.client.pgClient.query("SELECT * FROM guilds WHERE id = $1", [member.guild.id]);
    // Extract the guild configuration from the database result
    const guild_config = rows[0];
    dayjs.extend(relativeTime);
    const replacements = {
      "{user}": member.toString(),
      "{server}": member.guild.name,
      "{memberCount}": member.guild.memberCount.toString(),
      "{name}": member.user.username,
      "{joinPosition}": (member.guild.memberCount - 1).toString(),
      "{createdAt}": dayjs(member.user.createdAt).format("DD/MM/YYYY"),
      "{createdAgo}": dayjs(member.user.createdAt).fromNow(),
    };
    // If no guild data is found, exit the function
    if (!guild_config) return;

    // If a goodbye message and channel are configured, send the goodbye message to the channel
    if (
      guild_config.leave_message &&
      guild_config.leave_channel_id &&
      member.guild.channels.cache.has(toStringId(guild_config.leave_channel_id))
    ) {
      const goodbye_channel = member.guild.channels.cache.get(toStringId(guild_config.leave_channel_id))!;
      if (!goodbye_channel.isTextBased()) return;
      if (!goodbye_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages))
        return;
      await goodbye_channel.send(replacePlaceholders(guild_config.leave_message, replacements));
    }

    if (
      guild_config.mod_log_channel_id &&
      member.guild.channels.cache.has(toStringId(guild_config.mod_log_channel_id))
    ) {
      if (!member.guild.members.me?.permissions.has("ViewAuditLog")) return;
      const auditLogs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
      const log = auditLogs.entries.first();
      if (!log) return;
      const { executor, target, reason, createdTimestamp } = log;
      if (dayjs().diff(createdTimestamp, "seconds") > 5) return;
      if (executor?.id === member.client.user?.id) return;
      if (target?.id !== member.id) return;
      await modLog(
        {
          guild: member.guild,
          action: "KICK",
          user: member.user,
          moderator: executor!,
          reason:
            reason ?? member.client.i18next.getFixedT(guild_config.language)("events:guildMemberRemove.no_reason"),
        },
        member.client,
      );
    }
    const { rows: thread_rows } = await member.client.pgClient.query<Mod_mail_threads>(
      "SELECT * FROM mod_mail_threads WHERE user_id = $1 and status in ($2, $3)",
      [member.id, ModMailThreadStatus.OPEN, ModMailThreadStatus.SUSPENDED],
    );
    for (const thread of thread_rows) {
      await member.client.pgClient.query(
        "UPDATE mod_mail_threads SET status = $1, close_date = $2 WHERE channel_id = $3",
        [ModMailThreadStatus.CLOSED, new Date(), thread.channel_id],
      );
      const channel = member.guild.channels.cache.get(toStringId(thread.channel_id));
      if (channel?.isTextBased()) {
        await channel.send(
          member.client.i18next.getFixedT(guild_config.language)("events:guildMemberRemove.user_left", {
            guild: member.guild.name,
          }),
        );
      }
    }
  },
} satisfies EventBase<Events.GuildMemberRemove>;
