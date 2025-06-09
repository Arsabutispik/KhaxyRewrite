import { Client, Guild, PermissionsBitField } from "discord.js";
import dayjs from "dayjs";
import { logger } from "@lib";
import { toStringId, modLog } from "@utils";
import { getGuildConfig, getGuilds, updateCronJob } from "@database";
import type { guilds as Guilds } from "@prisma/client";

export async function unregisteredPeopleUpdate(client: Client) {
  // Fetch guild configurations from the database
  const guilds = await getGuilds();

  for (const guild_data of guilds) {
    const guild = client.guilds.cache.get(toStringId(guild_data.id));
    if (!guild) {
      logger.warn(`Guild with ID ${guild_data.id} not found.`);
      continue;
    }
    await processUnregisteredPeople(guild, guild_data, client);
  }
}

export async function specificGuildUnregisteredPeopleUpdate(client: Client, guildId: string) {
  // Fetch guild configuration for the specific guild
  const guild_config = await getGuildConfig(guildId);
  if (!guild_config) {
    logger.warn(`Guild config for ${guildId} not found.`);
    return;
  }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.warn(`Guild ${guildId} not found.`);
    return;
  }
  await processUnregisteredPeople(guild, guild_config, client);
}

/**
 * Processes unregistered people for a given guild.
 * @param guild The Discord guild.
 * @param config The guild configuration.
 * @param client The Discord client.
 */
async function processUnregisteredPeople(guild: Guild, config: Guilds, client: Client) {
  const { days_to_kick, register_channel_id, member_role_id, mute_role_id, language } = config;
  const t = client.i18next.getFixedT(language);

  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    logger.warn(`Missing permissions to moderate members in guild ${guild.id}`);
    return;
  }
  if (days_to_kick === 0) {
    logger.info(`Skipping guild ${guild.id} because days_to_kick is set to 0`);
    return;
  }
  if (!register_channel_id || !guild.channels.cache.has(toStringId(register_channel_id))) {
    logger.info(`Skipping guild ${guild.id} because register_channel is not configured or does not exist`);
    return;
  }
  if (!member_role_id || !guild.roles.cache.has(toStringId(member_role_id))) {
    logger.info(`Skipping guild ${guild.id} because member_role is not configured or does not exist`);
    return;
  }

  try {
    const members = await guild.members.fetch();
    members
      .filter((member) => {
        if (member.roles.cache.has(toStringId(member_role_id))) return false;
        if (mute_role_id && member.roles.cache.has(toStringId(mute_role_id))) return false;
        if (member.user.bot) return false;
        if (!member.kickable) return false;
        return member.joinedTimestamp! + (days_to_kick || 0) * 86400000 < Date.now();
      })
      .forEach((member) => {
        member.send(t("unregistered_member.kick_dm", { guild: guild.name, days: days_to_kick })).catch(() => {});
        member.kick(t("unregistered_member.initial", { days: days_to_kick })).catch(() => {});
        modLog(
          {
            guild,
            user: member.user,
            action: "KICK",
            moderator: client.user!,
            reason: t("unregistered_member.initial", { days: days_to_kick }),
          },
          client,
        );
      });
    await updateCronJob(guild.id, {
      unregistered_people_time: dayjs().add(1, "day").toDate(),
    });
  } catch (e) {
    logger.log({
      level: "error",
      message: "Error updating color of the day",
      error: e,
      meta: {
        guildID: guild.id,
      },
    });
  }
}
