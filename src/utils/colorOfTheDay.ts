import {KhaxyClient} from "../../@types/types";
import {ColorResolvable, PermissionsBitField} from "discord.js";
import ntc from "./ntc.js";
import dayjs from "dayjs";
import {GuildTypes} from "../../@types/PostgreTypes";
import logger from "../lib/logger.js";

export default async (client: KhaxyClient) => {
    // Fetch guild configurations from the database
    const result = await client.pgClient.query('SELECT color_id_of_the_day, color_name_of_the_day, id FROM guilds');
    const rows = result.rows;
    for(const row of rows) {
        const {color_id_of_the_day, color_name_of_the_day, id} = row;
        const guild = client.guilds.cache.get(id);
        if(!guild) continue;
        if(!guild.members.me) continue;
        // Check if the bot has permission to manage roles
        if(!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) continue;
        const role = guild.roles.cache.find(role => role.id === color_id_of_the_day);
        if(!role) continue;
        // Check if the bot's highest role is higher than the target role
        if(role.position >= guild.members.me.roles.highest.position) continue;
        const name = role.name.replace(color_name_of_the_day, "");
        // Generate a random color
        const x = Math.round(0xffffff * Math.random()).toString(16);
        const y = 6 - x.length;
        const z = "000000";
        const z1 = z.substring(0, y);
        const color = `#${z1 + x}` as ColorResolvable;
        const result = ntc.name(color);
        const colorName = result[1];
        try {
            // Update the color name in the database
            await client.pgClient.query('UPDATE guilds SET color_name_of_the_day = $1 WHERE id = $2', [colorName, id]);
            // Edit the role with the new color and name
            await role.edit({
                name: `${colorName} ${name}`,
                color: color,
                reason: "Color of the day has been updated."
            });
            // Update the color change time in the database
            const query = `
            UPDATE colorcronjobs
            SET colortime = $1
            WHERE id = $2`;
            await client.pgClient.query(query, [dayjs().add(1, 'day').toISOString(), id]);
        } catch (error) {
            logger.log({
                level: "error",
                message: "Error updating color of the day",
                error: error,
                meta: {
                    guildID: id
                }
            })
        }
    }
}

export async function specificGuildColorUpdate(client: KhaxyClient, guildId: string) {
    // Fetch guild configuration for the specific guild
    const {rows} = await client.pgClient.query('SELECT color_id_of_the_day, color_name_of_the_day, id FROM guilds WHERE id = $1', [guildId]) as {rows: GuildTypes[]};
    if(rows.length === 0) {
        logger.warn(`Guild config for ${guildId} not found.`);
        return;
    }
    const {color_id_of_the_day, color_name_of_the_day, id} = rows[0];
    const guild = client.guilds.cache.get(id);
    if (!guild) return;
    if (!guild.members.me) return;
    // Check if the bot has permission to manage roles
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;
    const role = guild.roles.cache.find(role => role.id === color_id_of_the_day);
    if (!role) return;
    // Check if the bot's highest role is higher than the target role
    if (role.position >= guild.members.me.roles.highest.position) return;
    const name = role.name.replace(color_name_of_the_day || "", "");
    // Generate a random color
    const x = Math.round(0xffffff * Math.random()).toString(16);
    const y = 6 - x.length;
    const z = "000000";
    const z1 = z.substring(0, y);
    const color = `#${z1 + x}` as ColorResolvable;
    const cresult = ntc.name(color);
    const colorName = cresult[1];
    try {
        // Update the color name in the database
        await client.pgClient.query('UPDATE guilds SET color_name_of_the_day = $1 WHERE id = $2', [colorName, id]);
        // Edit the role with the new color and name
        await role.edit({
            name: `${colorName} ${name}`,
            color: color,
            reason: "Color of the day has been updated."
        });
        // Update the color change time in the database
        const query = `
            UPDATE colorcronjobs
            SET colortime = $1
            WHERE id = $2`;
        await client.pgClient.query(query, [dayjs().add(1, 'day').toISOString(), id]);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Error updating color of the day",
            error: error,
            meta: {
                guildID: id
            }
        })
    }
}