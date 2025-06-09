import dayjs from "dayjs";
import { logger } from "@lib";
import { toStringId, modLog } from "./index";
import { Client } from "discord.js";
import { deleteExpiredPunishments, getExpiredPunishments, getGuildConfig } from "@database";
import { PunishmentType } from "@constants";
export async function checkPunishments(client: Client) {
  // Fetch punishments that have expired
  const punishments = await getExpiredPunishments();
  for (const punishment of punishments) {
    const guild = client.guilds.cache.get(toStringId(punishment.guild_id));
    if (!guild) {
      logger.log({
        level: "warn",
        message: `Guild ${punishment.guild_id} not found in cache`,
        discord: false,
      });
      continue;
    }
    await guild.members.fetch();
    // Fetch guild configuration
    const guild_config = await getGuildConfig(guild.id);
    if (!guild_config) {
      logger.log({
        level: "warn",
        message: `Guild ${punishment.guild_id} not found in database`,
        discord: false,
      });
      continue;
    }

    const user = await client.users.fetch(toStringId(punishment.user_id));

    const staff = await client.users.fetch(toStringId(punishment.staff_id));
    const expiresDate = dayjs(punishment.expires_at);
    const createdAtDate = dayjs(punishment.created_at);
    const duration = dayjs(expiresDate.diff(createdAtDate));

    if (punishment.type === PunishmentType.BAN) {
      // If the punishment is a ban, unban the user
      if (!guild.bans.cache.get(user.id)) {
        logger.log({
          level: "warn",
          message: `User ${user.tag} is not banned in guild ${guild.name}`,
          discord: false,
        });
        continue;
      }
      await guild.members.unban(user, client.i18next.getFixedT(guild_config.language)("commands:ban.expired"));
      await modLog(
        {
          guild,
          user: user,
          action: "BAN_EXPIRED",
          moderator: staff,
          reason: client.i18next.getFixedT(guild_config.language)("commands:ban.expired"),
          duration,
        },
        client,
      );
    } else if (punishment.type === PunishmentType.MUTE) {
      const member = guild.members.cache.get(user.id);
      // If the punishment is a mute, remove the mute role and restore previous roles
      if (!member) {
        logger.log({
          level: "warn",
          message: `Member ${user.tag} not found in guild ${guild.name}`,
          discord: false,
        });
        continue;
      }
      if (punishment.previous_roles) {
        for (const role of [...punishment.previous_roles]) {
          // spread operator to clone the array
          if (!member.guild.roles.cache.get(toStringId(role))) {
            const idx = punishment.previous_roles.indexOf(role);
            if (idx !== -1) punishment.previous_roles.splice(idx, 1);
          }
        }
        await member.roles.add(punishment.previous_roles.map((role) => toStringId(role)));
      }

      if (guild_config.mute_role_id && guild.roles.cache.has(toStringId(guild_config.mute_role_id)))
        await member.roles.remove(toStringId(guild_config.mute_role_id));
    }
  }
  // Delete expired punishments from the database
  await deleteExpiredPunishments();
}
