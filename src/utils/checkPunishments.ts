import { KhaxyClient } from "../../@types/types";
import modlog from "./modLog.js";
import { User } from "discord.js";
import dayjs from "dayjs";
export default async (client: KhaxyClient) => {
    const check = async () => {
        const { rows } = await client.pgClient.query('SELECT * FROM punishments WHERE  expires < $1', [new Date()]) as { rows: { userId: string; type: string; previousRoles: string[]; staffId: string; expires: string; createdAt: string; guildID: string }[] };

        for (const result of rows) {
            // @ts-ignore
            const { userId, type, previousRoles, staffId, expires, createdAt, guildID } = result;
            const guild = client.guilds.cache.get(guildID!);
            if (!guild) continue;
            const {rows} = await client.pgClient.query('SELECT language, mute_get_all_roles, mute_role FROM guilds WHERE id = $1', [guild.id]) as { rows: { language: string; mute_get_all_roles: boolean, mute_role: string }[] };
            const member = guild.members.cache.get(userId!);
            if (!member) continue;
            const staff = await guild.members.fetch(staffId!);
            const expiresDate = dayjs(expires!);
            const createdAtDate = dayjs(createdAt);
            const duration = dayjs(expiresDate.diff(createdAtDate));
            if (type === "ban") {
                if (!guild.bans.cache.get(userId!)) continue;
                await guild.members.unban(userId!, "Ban Duration Expired");
                await modlog(
                    {
                        guild,
                        user: member.user,
                        action: "BAN_EXPIRED",
                        moderator: (staff ? staff : staffId) as unknown as User,
                        reason: client.i18next.getFixedT(rows[0].language)("ban.expired"),
                        duration
                    },
                    client,
                );
            } else if (type === "mute") {
                if (!member) {
                    continue;
                }
                if (rows[0].mute_get_all_roles) {
                    if (!previousRoles) continue;
                    for (const role of previousRoles) {
                        if (!member.guild.roles.cache.get(role)) previousRoles?.splice(previousRoles?.indexOf(role), 1);
                    }
                    await member.roles.add(previousRoles!);
                }
                await member.roles.remove(rows[0].mute_role);
            }
        }
        await client.pgClient.query('DELETE FROM punishments WHERE expires < $1', [new Date()]);
        setTimeout(check, 1000 * 60 * 5);
    };
    await check();
};