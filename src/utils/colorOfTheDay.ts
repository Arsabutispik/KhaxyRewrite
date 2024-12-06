import {KhaxyClient} from "../../@types/types";
import {ColorResolvable, PermissionsBitField} from "discord.js";
import ntc from "./ntc.js";
import dayjs from "dayjs";

export default async (client: KhaxyClient) => {
    const result = await client.pgClient.query('SELECT color_id_of_the_day, color_name_of_the_day, id FROM guilds');
    const rows = result.rows;
    for(const row of rows) {
        const {color_id_of_the_day, color_name_of_the_day, id} = row;
        const guild = client.guilds.cache.get(id);
        if(!guild) continue;
        if(!guild.members.me) continue;
        if(!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) continue;
        const role = guild.roles.cache.find(role => role.id === color_id_of_the_day);
        if(!role) continue;
        if(role.position >= guild.members.me.roles.highest.position) continue;
        const name = role.name.replace(color_name_of_the_day, "");
        const x = Math.round(0xffffff * Math.random()).toString(16);
        const y = 6 - x.length;
        const z = "000000";
        const z1 = z.substring(0, y);
        const color = `#${z1 + x}` as ColorResolvable;
        const result = ntc.name(color);
        const colorName = result[1];
        try {
            await client.pgClient.query('UPDATE guilds SET color_name_of_the_day = $1 WHERE id = $2', [colorName, id]);
            await role.edit({
                name: `${colorName} ${name}`,
                color: color,
                reason: "Color of the day has been updated."
            })
            const query = `
            UPDATE colorcronjobs 
            SET colortime = $1
            WHERE id = $2`
            await client.pgClient.query(query, [dayjs().add(1, 'day').toISOString(), id]);
        } catch (error) {
            console.error(error);
        }
    }
}

export async function specificGuildColorUpdate(client: KhaxyClient, guildId: string) {
    const result = await client.pgClient.query('SELECT color_id_of_the_day, color_name_of_the_day, id FROM guilds WHERE id = $1', [guildId]);
    const row = result.rows[0];
    const {color_id_of_the_day, color_name_of_the_day, id} = row;
    const guild = client.guilds.cache.get(id);
    if (!guild) return;
    if (!guild.members.me) return;
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;
    const role = guild.roles.cache.find(role => role.id === color_id_of_the_day);
    if (!role) return;
    if (role.position >= guild.members.me.roles.highest.position) return;
    const name = role.name.replace(color_name_of_the_day, "");
    const x = Math.round(0xffffff * Math.random()).toString(16);
    const y = 6 - x.length;
    const z = "000000";
    const z1 = z.substring(0, y);
    const color = `#${z1 + x}` as ColorResolvable;
    const cresult = ntc.name(color);
    const colorName = cresult[1];
    try {
        await client.pgClient.query('UPDATE guilds SET color_name_of_the_day = $1 WHERE id = $2', [colorName, id]);
        await role.edit({
            name: `${colorName} ${name}`,
            color: color,
            reason: "Color of the day has been updated."
        })
        const query = `
            UPDATE colorcronjobs 
            SET colortime = $1
            WHERE id = $2`
        await client.pgClient.query(query, [dayjs().add(1, 'day').toISOString(), id]);
    } catch (error) {
        console.error(error);
    }
}