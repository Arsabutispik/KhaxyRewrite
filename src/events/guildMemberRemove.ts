import type { EventBase } from "@customTypes";
import { AuditLogEvent, Events, PermissionsBitField } from "discord.js";
import { replacePlaceholders, toStringId, modLog } from "@utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { ModMailThreadStatus } from "@constants";
import { getGuildConfig, getModMailThreadsByUser, updateModMailThread } from "@database";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    // Fetch guild data from the database
    const guild_config = await getGuildConfig(member.guild.id);
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
    const thread_rows = await getModMailThreadsByUser(member.user.id);
    for (const thread of thread_rows) {
      await updateModMailThread(thread.channel_id, {
        status: ModMailThreadStatus.CLOSED,
      });
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
