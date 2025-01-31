import {EventBase, KhaxyClient} from "../../@types/types";
import {Events, GuildMember, AuditLogEvent} from "discord.js";
import {sleep} from "../utils/utils.js";
import modlog from "../utils/modLog.js";
import dayjs from "dayjs";
export default {
    name: Events.GuildMemberUpdate,
    once: false,
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        const {rows} = await (oldMember.client as KhaxyClient).pgClient.query('SELECT language FROM guilds WHERE id = $1', [oldMember.guild.id]) as {rows: {language: string}[]};
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
                        reason: (oldMember.client as KhaxyClient).i18next.getFixedT(rows[0].language)("events:guildMemberUpdate.noReason"),
                        duration: dayjs(newMember.communicationDisabledUntilTimestamp! - Date.now()),
                    },
                    oldMember.client as KhaxyClient,
                );
            } else {
                await modlog(
                    {
                        guild: oldMember.guild,
                        user: newMember.user,
                        action: "TIMEOUT",
                        moderator: log.executor!,
                        reason: log.reason || (oldMember.client as KhaxyClient).i18next.getFixedT(rows[0].language)("events:guildMemberUpdate.noReason"),
                        duration: dayjs(newMember.communicationDisabledUntilTimestamp! - Date.now()),
                    },
                    oldMember.client as KhaxyClient,
                );
            }
        }
    }
} as EventBase