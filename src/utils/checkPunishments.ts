import modlog from "./modLog.js";
import dayjs from "dayjs";
import { Guilds, Punishments } from "../../@types/DatabaseTypes";
import logger from "../lib/Logger.js";
import { toStringId } from "./utils.js";
import { Client } from "discord.js";

export default async (client: Client) => {
  // Fetch punishments that have expired
  const { rows } = await client.pgClient.query<Punishments>("SELECT * FROM punishments WHERE expires < NOW()");
  for (const result of rows) {
    const guild = client.guilds.cache.get(toStringId(result.guild_id));
    if (!guild) {
      logger.log({
        level: "warn",
        message: `Guild ${result.guild_id} not found in cache`,
        discord: false,
      });
      continue;
    }
    await guild.members.fetch();
    // Fetch guild configuration
    const { rows } = await client.pgClient.query<Guilds>(
      "SELECT language, mute_get_all_roles, mute_role_id FROM guilds WHERE id = $1",
      [guild.id],
    );
    if (!rows[0]) {
      logger.log({
        level: "warn",
        message: `Guild ${result.guild_id} not found in database`,
        discord: false,
      });
      continue;
    }

    const user = await client.users.fetch(toStringId(result.user_id));

    const staff = await client.users.fetch(toStringId(result.staff_id));
    const expiresDate = dayjs(result.expires);
    const createdAtDate = dayjs(result.created_at);
    const duration = dayjs(expiresDate.diff(createdAtDate));

    if (result.type === "ban") {
      // If the punishment is a ban, unban the user
      if (!guild.bans.cache.get(user.id)) {
        logger.log({
          level: "warn",
          message: `User ${user.tag} is not banned in guild ${guild.name}`,
          discord: false,
        });
        continue;
      }
      await guild.members.unban(user, client.i18next.getFixedT(rows[0].language)("commands:ban.expired"));
      await modlog(
        {
          guild,
          user: user,
          action: "BAN_EXPIRED",
          moderator: staff,
          reason: client.i18next.getFixedT(rows[0].language)("commands:ban.expired"),
          duration,
        },
        client,
      );
    } else if (result.type === "mute") {
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
      if (rows[0].mute_get_all_roles) {
        if (result.previous_roles) {
          for (const role of result.previous_roles) {
            if (!member.guild.roles.cache.get(toStringId(role)))
              result.previous_roles?.splice(result.previous_roles?.indexOf(role), 1);
          }
          await member.roles.add(result.previous_roles.map((role) => toStringId(role)));
        }
      }
      if (rows[0].mute_role_id && guild.roles.cache.has(toStringId(rows[0].mute_role_id)))
        await member.roles.remove(toStringId(rows[0].mute_role_id));
    }
  }
  // Delete expired punishments from the database
  await client.pgClient.query("DELETE FROM punishments WHERE expires < $1", [new Date()]);
};
