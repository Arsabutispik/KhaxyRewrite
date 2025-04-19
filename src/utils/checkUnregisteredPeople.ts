import { Client, PermissionsBitField } from "discord.js";
import modLog from "./modLog.js";
import dayjs from "dayjs";
import { Guilds } from "../../@types/DatabaseTypes";
import logger from "../lib/Logger.js";
import { toStringId } from "./utils.js";
import process from "node:process";

export default async (client: Client) => {
  // Fetch guild configurations from the database
  const { rows } = await client.pgClient.query<Guilds>(
    "SELECT id, pgp_sym_decrypt(days_to_kick, $1)::INTEGER as days_to_kick, pgp_sym_decrypt(register_channel_id, $1) as register_channel_id, pgp_sym_decrypt(member_role_id, $1) as member_role_id, pgp_sym_decrypt(mute_role_id, $1) as mute_role_id, pgp_sym_decrypt(language, $1) as language FROM guilds",
    [process.env.PASSPHRASE],
  );

  for (const row of rows) {
    const { id, days_to_kick, register_channel_id, member_role_id, mute_role_id, language } = row;
    const guild = client.guilds.cache.get(toStringId(id));
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
    if (!register_channel_id || !guild.channels.cache.has(toStringId(register_channel_id))) {
      logger.info(`Skipping guild ${guild.id} because register_channel is not configured or does not exist`);
      continue;
    }

    // Skip if member_role is not configured or does not exist
    if (!member_role_id || !guild.roles.cache.has(toStringId(member_role_id))) {
      logger.info(`Skipping guild ${guild.id} because member_role is not configured or does not exist`);
      continue;
    }

    try {
      // Fetch all members of the guild
      const members = await guild.members.fetch();

      // Filter members who should be kicked
      members
        .filter((member) => {
          if (member.roles.cache.has(toStringId(member_role_id))) return false;
          if (mute_role_id && member.roles.cache.has(toStringId(mute_role_id))) return false;
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

export async function specificGuildUnregisteredPeopleUpdate(client: Client, guildId: string) {
  // Fetch guild configuration for the specific guild
  const { rows } = await client.pgClient.query<Guilds>(
    "SELECT days_to_kick, register_channel_id, member_role_id, mute_role_id, language from guilds WHERE id = $1",
    [guildId],
  );
  if (rows.length === 0) {
    logger.warn(`Guild config for ${guildId} not found.`);
    return;
  }
  const { days_to_kick, register_channel_id, member_role_id, mute_role_id, language } = rows[0];
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
  if (!register_channel_id || !guild.channels.cache.has(toStringId(register_channel_id))) {
    logger.info(`Skipping guild ${guild.id} because register_channel is not configured or does not exist`);
    return;
  }

  // Skip if member_role is not configured or does not exist
  if (!member_role_id || !guild.roles.cache.has(toStringId(member_role_id))) {
    logger.info(`Skipping guild ${guild.id} because member_role is not configured or does not exist`);
    return;
  }

  try {
    // Fetch all members of the guild
    const members = await guild.members.fetch();

    // Filter members who should be kicked
    members
      .filter((member) => {
        if (member.roles.cache.has(toStringId(member_role_id))) return false;
        if (mute_role_id && member.roles.cache.has(toStringId(mute_role_id))) return false;
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
