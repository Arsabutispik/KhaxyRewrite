import { KhaxyClient } from "../../@types/types";
import { PermissionsBitField } from "discord.js";
import modLog from "./modLog.js";
import dayjs from "dayjs";
import { Guilds } from "../../@types/DatabaseTypes";
import logger from "../lib/Logger.js";

export default async (client: KhaxyClient) => {
  // Fetch guild configurations from the database
  const { rows } = await client.pgClient.query<Guilds>(
    "SELECT id, days_to_kick, register_channel, member_role, mute_role, language from guilds",
  );

  for (const row of rows) {
    const { id, days_to_kick, register_channel, member_role, mute_role, language } = row;
    const guild = client.guilds.cache.get(id);
    if (!guild) {
      logger.warn(`Guild with ID ${id} not found.`);
      continue;
    }
    const t = client.i18next.getFixedT(language);
    // Check if the bot has permission to moderate members
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      logger.warn(`Missing permissions to moderate members in guild ${guild.id}`);
      continue;
    }

    // Skip if days_to_kick is set to 0
    if (days_to_kick === 0) {
      logger.info(`Skipping guild ${guild.id} because days_to_kick is set to 0`);
      continue;
    }

    // Skip if register_channel is not configured or does not exist
    if (!register_channel || !guild.channels.cache.has(register_channel)) {
      logger.info(`Skipping guild ${guild.id} because register_channel is not configured or does not exist`);
      continue;
    }

    // Skip if member_role is not configured or does not exist
    if (!member_role || !guild.roles.cache.has(member_role)) {
      logger.info(`Skipping guild ${guild.id} because member_role is not configured or does not exist`);
      continue;
    }

    try {
      // Fetch all members of the guild
      const members = await guild.members.fetch();

      // Filter members who should be kicked
      members
        .filter((member) => {
          if (member.roles.cache.has(member_role)) return false;
          if (mute_role && member.roles.cache.has(mute_role)) return false;
          if (member.user.bot) return false;
          if (!member.kickable) return false;
          return member.joinedTimestamp! + (days_to_kick || 0) * 86400000 < Date.now();
        })
        .forEach((member) => {
          // Send a DM to the member before kicking
          member.send(t("unregistered_member.kick_dm", { guild: guild.name, days: days_to_kick })).catch(() => {});

          // Kick the member from the guild
          member.kick(t("unregistered_member.initial", { days: days_to_kick })).catch(() => {});

          // Log the kick action using the modLog utility
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

      // Update the check time for the guild in the database
      const query = `
                UPDATE cronjobs
                SET unregistered_people_time = $1
                WHERE id = $2`;
      await client.pgClient.query(query, [dayjs().add(1, "day").toISOString(), id]);
    } catch (e) {
      console.error(e);
    }
  }
};

export async function specificGuildUnregisteredPeopleUpdate(client: KhaxyClient, guildId: string) {
  // Fetch guild configuration for the specific guild
  const { rows } = await client.pgClient.query<Guilds>(
    "SELECT days_to_kick, register_channel, member_role, mute_role, language from guilds WHERE id = $1",
    [guildId],
  );
  if (rows.length === 0) {
    logger.warn(`Guild config for ${guildId} not found.`);
    return;
  }
  const { days_to_kick, register_channel, member_role, mute_role, language } = rows[0];
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.warn(`Guild ${guildId} not found.`);
    return;
  }
  const t = client.i18next.getFixedT(language);
  // Check if the bot has permission to moderate members
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    logger.warn(`Missing permissions to moderate members in guild ${guild.id}`);
    return;
  }

  // Skip if days_to_kick is set to 0
  if (days_to_kick === 0) {
    logger.info(`Skipping guild ${guild.id} because days_to_kick is set to 0`);
    return;
  }

  // Skip if register_channel is not configured or does not exist
  if (!register_channel || !guild.channels.cache.has(register_channel)) {
    logger.info(`Skipping guild ${guild.id} because register_channel is not configured or does not exist`);
    return;
  }

  // Skip if member_role is not configured or does not exist
  if (!member_role || !guild.roles.cache.has(member_role)) {
    logger.info(`Skipping guild ${guild.id} because member_role is not configured or does not exist`);
    return;
  }

  try {
    // Fetch all members of the guild
    const members = await guild.members.fetch();

    // Filter members who should be kicked
    members
      .filter((member) => {
        if (member.roles.cache.has(member_role)) return false;
        if (mute_role && member.roles.cache.has(mute_role)) return false;
        if (member.user.bot) return false;
        if (!member.kickable) return false;
        return member.joinedTimestamp! + (days_to_kick || 0) * 86400000 < Date.now();
      })
      .forEach((member) => {
        // Send a DM to the member before kicking
        member.send(t("unregistered_member.kick_dm", { guild: guild.name, days: days_to_kick })).catch(() => {});

        // Kick the member from the guild
        member.kick(t("unregistered_member.initial", { days: days_to_kick })).catch(() => {});

        // Log the kick action using the modLog utility
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
