import { EventBase } from "../../@types/types";
import { AuditLogEvent, Events } from "discord.js";
import { sleep, toStringId } from "../utils/utils.js";
import modlog from "../utils/modLog.js";
import dayjs from "dayjs";
import { Guilds } from "../../@types/DatabaseTypes";

export default {
  name: Events.GuildMemberUpdate,
  once: false,
  async execute(oldMember, newMember) {
    const { rows } = await oldMember.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      oldMember.guild.id,
    ]);
    const guild_config = rows[0];
    if (!guild_config) return;
    const modlog_channel = await oldMember.guild.channels
      .fetch(toStringId(guild_config.mod_log_channel_id))
      .catch(() => null);
    if (!modlog_channel) return;
    if (!modlog_channel.isTextBased()) return;
    if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
      await sleep(1000);
      const fetchedLogs = await oldMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
      });
      const log = fetchedLogs.entries.first();
      if (Date.now() - log!.createdTimestamp >= 5000) return;
      if (!log) {
        await modlog(
          {
            guild: oldMember.guild,
            user: newMember.user,
            action: "TIMEOUT",
            moderator: oldMember.client.user!,
            reason: oldMember.client.i18next.getFixedT(guild_config.language)("events:guildMemberUpdate.noReason"),
            duration: dayjs(newMember.communicationDisabledUntilTimestamp! - Date.now()),
          },
          oldMember.client,
        );
      } else {
        await modlog(
          {
            guild: oldMember.guild,
            user: newMember.user,
            action: "TIMEOUT",
            moderator: log.executor!,
            reason:
              log.reason ||
              oldMember.client.i18next.getFixedT(guild_config.language)("events:guildMemberUpdate.noReason"),
            duration: dayjs(newMember.communicationDisabledUntilTimestamp! - Date.now()),
          },
          oldMember.client,
        );
      }
    }
  },
} satisfies EventBase<Events.GuildMemberUpdate>;
