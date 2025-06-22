import { Client, Guild, PermissionsBitField } from "discord.js";
import type { ColorResolvable } from "discord.js";
import { ntc, toStringId } from "@utils";
import dayjs from "dayjs";
import { logger } from "@lib";
import { getGuildConfig, getGuilds, updateCronJob, updateGuildConfig } from "@database";
import type { guilds as Guilds } from "@prisma/client";
export async function colorUpdate(client: Client) {
  // Fetch guild configurations from the database
  const guilds = await getGuilds();
  for (const guild_data of guilds) {
    const guild = client.guilds.cache.get(toStringId(guild_data.id));
    if (!guild) continue;
    await proccesColorUpdate(guild, guild_data);
  }
}

export async function specificGuildColorUpdate(client: Client, guildId: string) {
  // Fetch guild configuration for the specific guild
  const guild_config = await getGuildConfig(guildId);
  if (!guild_config) {
    logger.warn(`Guild config for ${guildId} not found.`);
    return;
  }
  const guild = client.guilds.cache.get(toStringId(guild_config.id));
  if (!guild) {
    logger.warn(`Guild ${guild_config.id} not found.`);
    return;
  }
  await proccesColorUpdate(guild, guild_config);
}

async function proccesColorUpdate(guild: Guild, config: Guilds) {
  const { colour_id_of_the_day, colour_name_of_the_day, id } = config;
  if (!guild.members.me) {
    logger.warn(`Bot is not in guild ${id}.`);
    return;
  }
  // Check if the bot has permission to manage roles
  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    logger.warn(`Bot doesn't have permission to manage roles in guild ${id}.`);
    return;
  }
  if (!colour_id_of_the_day) return;
  const role = guild.roles.cache.get(toStringId(colour_id_of_the_day));
  if (!role) {
    logger.warn(`Role ${colour_id_of_the_day} not found in guild ${id}.`);
    return;
  }
  // Check if the bot's highest role is higher than the target role
  if (role.position >= guild.members.me.roles.highest.position) {
    logger.warn(`Bot's highest role is lower than the target role in guild ${id}.`);
    return;
  }
  const name = role.name.replace(colour_name_of_the_day || "", " ");
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
    await updateGuildConfig(guild.id, {
      colour_name_of_the_day: colorName as string,
    });
    // Edit the role with the new color and name
    await role.edit({
      name: `${name}${colorName}`,
      color: color,
      reason: "Color of the day has been updated.",
    });
    // Update the color change time in the database
    await updateCronJob(guild.id, {
      color_time: dayjs().add(1, "day").toDate(),
    });
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
