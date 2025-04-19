import { Client, ColorResolvable, PermissionsBitField } from "discord.js";
import ntc from "./ntc.js";
import dayjs from "dayjs";
import { Guilds } from "../../@types/DatabaseTypes";
import logger from "../lib/Logger.js";
import { toStringId } from "./utils.js";
import process from "node:process";

export default async (client: Client) => {
  // Fetch guild configurations from the database
  const result = await client.pgClient.query<Guilds>(
    "SELECT pgp_sym_decrypt(color_id_of_the_day, $1), pgp_sym_decrypt(color_name_of_the_day, $1), pgp_sym_decrypt(id, $1) FROM guilds",
    [process.env.PASSPHRASE],
  );
  const rows = result.rows;
  for (const row of rows) {
    const { color_id_of_the_day, color_name_of_the_day, id } = row;
    const guild = client.guilds.cache.get(toStringId(id));
    if (!guild) continue;
    if (!guild.members.me) continue;
    // Check if the bot has permission to manage roles
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) continue;
    const role = guild.roles.cache.find((role) => role.id === toStringId(color_id_of_the_day));
    if (!role) continue;
    // Check if the bot's highest role is higher than the target role
    if (role.position >= guild.members.me.roles.highest.position) continue;
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
      await client.pgClient.query(
        "UPDATE guilds SET color_name_of_the_day = pgp_sym_encrypt($1, $3) WHERE pgp_sym_decrypt(id, $3) = $2",
        [colorName, id, process.env.PASSPHRASE],
      );
      // Edit the role with the new color and name
      await role.edit({
        name: `${colorName} ${name}`,
        color: color,
        reason: "Color of the day has been updated.",
      });
      // Update the color change time in the database
      const query = `
            UPDATE cronjobs
            SET color_time = pgp_sym_encrypt($1::text, $3)
            WHERE pgp_sym_decrypt(id, $3) = $2`;
      await client.pgClient.query(query, [dayjs().add(1, "day").toISOString(), id, process.env.PASSPHRASE]);
    } catch (error) {
      logger.log({
        level: "error",
        message: "Error updating color of the day",
        error: error,
        meta: {
          guildID: id,
        },
      });
    }
  }
};

export async function specificGuildColorUpdate(client: Client, guildId: string) {
  // Fetch guild configuration for the specific guild
  const { rows } = await client.pgClient.query<Guilds>(
    "SELECT pgp_sym_decrypt(color_id_of_the_day, $2), pgp_sym_decrypt(color_name_of_the_day, $2), pgp_sym_decrypt(id, $2) FROM guilds WHERE pgp_sym_decrypt(id, $2) = $1",
    [guildId, process.env.PASSPHRASE],
  );
  if (rows.length === 0) {
    logger.warn(`Guild config for ${guildId} not found.`);
    return;
  }
  const { color_id_of_the_day, color_name_of_the_day, id } = rows[0];
  const guild = client.guilds.cache.get(toStringId(id));
  if (!guild) {
    logger.warn(`Guild ${id} not found.`);
    return;
  }
  if (!guild.members.me) {
    logger.warn(`Bot is not in guild ${id}.`);
    return;
  }
  // Check if the bot has permission to manage roles
  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    logger.warn(`Bot doesn't have permission to manage roles in guild ${id}.`);
    return;
  }
  const role = guild.roles.cache.find((role) => role.id === toStringId(color_id_of_the_day));
  if (!role) {
    logger.warn(`Role ${color_id_of_the_day} not found in guild ${id}.`);
    return;
  }
  // Check if the bot's highest role is higher than the target role
  if (role.position >= guild.members.me.roles.highest.position) {
    logger.warn(`Bot's highest role is lower than the target role in guild ${id}.`);
    return;
  }
  const name = role.name.replace(color_name_of_the_day || "", " ");
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
    await client.pgClient.query(
      "UPDATE guilds SET color_name_of_the_day = pgp_sym_encrypt($1, $3) WHERE pgp_sym_decrypt(id, $3) = $2",
      [colorName, id, process.env.PASSPHRASE],
    );
    // Edit the role with the new color and name
    await role.edit({
      name: `${name}${colorName}`,
      color: color,
      reason: "Color of the day has been updated.",
    });
    // Update the color change time in the database
    const query = `
      UPDATE cronjobs
      SET color_time = pgp_sym_encrypt($1::text, $3)
      WHERE pgp_sym_decrypt(id, $3) = $2`;
    await client.pgClient.query(query, [dayjs().add(1, "day").toISOString(), id]);
  } catch (error) {
    logger.log({
      level: "error",
      message: "Error updating color of the day",
      error: error,
      meta: {
        guildID: id,
      },
    });
  }
}
