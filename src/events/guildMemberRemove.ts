import { EventBase } from "../../@types/types";
import { AuditLogEvent, Events, PermissionsBitField } from "discord.js";
import { replacePlaceholders, toStringId } from "../utils/utils.js";
import dayjs from "dayjs";
import modLog from "../utils/modLog.js";
import relativeTime from "dayjs/plugin/relativeTime.js";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    // Fetch guild data from the database
    const guild_config = await member.client.getGuildConfig(member.guild.id);
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
          reason: reason ?? member.client.i18next.getFixedT(guild_config.language)("events:guildMemberRemove.noReason"),
        },
        member.client,
      );
    }
  },
} satisfies EventBase<Events.GuildMemberRemove>;
