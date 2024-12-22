import {KhaxyClient} from "../../@types/types";
import {PermissionsBitField} from "discord.js";
import modLog from "./modLog.js";
import dayjs from "dayjs";

export default async (client: KhaxyClient) => {
    const { rows } = await client.pgClient.query('SELECT id, days_to_kick, register_channel, member_role, mute_role, language  from guilds')
    for (const row of rows) {
        const {id, days_to_kick, register_channel, member_role, mute_role, language} = row as {
            id: string,
            days_to_kick: number,
            register_channel: string,
            member_role: string,
            mute_role: string,
            language: string
        };
        const guild = client.guilds.cache.get(id);
        if (!guild) continue;
        if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) continue;
        if (days_to_kick === 0) continue;
        if (!register_channel) continue;
        if (!guild.channels.cache.has(register_channel)) continue;
        if (!member_role) continue;
        if (!guild.roles.cache.has(member_role)) continue;
        try {
            client.i18next.getFixedT(language)
            const members = await guild.members.fetch();
            members.filter((member) => {
                if (member.roles.cache.has(member_role)) return false;
                if (member.roles.cache.has(mute_role)) return false;
                if (member.user.bot) return false;
                if (!member.kickable) return false;
                return member.joinedTimestamp! + days_to_kick * 86400000 < Date.now();
            })
                .forEach((member) => {
                    member.send(
                        client.i18next.t("unregistered_member.kick_dm", {guild: guild.name, days: days_to_kick}))
                        .catch(() => {
                        });
                    member.kick(client.i18next.t("unregistered_member.initial", {days: days_to_kick}))
                        .catch(() => {
                        });
                    modLog({
                        guild,
                        user: member.user,
                        action: "KICK",
                        moderator: client.user!,
                        reason: client.i18next.t("unregistered_member.initial", {days: days_to_kick})
                    }, client)
                });
            const query = `
                UPDATE checkunregisteredpeoplecronjobs
                SET checktime = $1
                WHERE id = $2`
            await client.pgClient.query(query, [dayjs().add(1, 'day').toISOString(), id])
        } catch (e) {
            console.error(e)
        }
    }
}