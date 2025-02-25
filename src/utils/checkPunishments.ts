import { KhaxyClient } from "../../@types/types";
import modlog from "./modLog.js";
import dayjs from "dayjs";
import { Guilds, Punishments } from "../../@types/DatabaseTypes";
import logger from "../lib/Logger.js";

export default async (client: KhaxyClient) => {
  const check = async () => {
    // Fetch punishments that have expired
    const { rows } = await client.pgClient.query<Punishments>("SELECT * FROM punishments WHERE expires < $1", [
      new Date(),
    ]);
    for (const result of rows) {
      // Destructure punishment details
      const { user_id, type, previous_roles, staff_id, expires, created_at, guild_id } = result;
      const guild = client.guilds.cache.get(guild_id);
      if (!guild) {
        logger.info(`Guild ${guild_id} not found`);
        continue;
      }
      await guild.members.fetch();
      // Fetch guild configuration
      const { rows } = await client.pgClient.query<Guilds>(
        "SELECT language, mute_get_all_roles, mute_role FROM guilds WHERE id = $1",
        [guild.id],
      );
      if (!rows[0]) {
        logger.info(`Guild ${guild.name} not found in database`);
        continue;
      }

      const user = await client.users.fetch(user_id);

      const staff = await client.users.fetch(staff_id);
      const expiresDate = dayjs(expires);
      const createdAtDate = dayjs(created_at);
      const duration = dayjs(expiresDate.diff(createdAtDate));

      if (type === "ban") {
        // If the punishment is a ban, unban the user
        if (!guild.bans.cache.get(user_id)) {
          logger.info(`User ${user.tag} not found in guild ${guild.name}`);
          continue;
        }
        await guild.members.unban(user_id, client.i18next.getFixedT(rows[0].language)("commands:ban.expired"));
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
      } else if (type === "mute") {
        const member = guild.members.cache.get(user_id);
        // If the punishment is a mute, remove the mute role and restore previous roles
        if (!member) {
          logger.info(`Member ${user.tag} not found in guild ${guild.name}`);
          continue;
        }
        if (rows[0].mute_get_all_roles) {
          if (!previous_roles) {
            logger.info(`Member ${user.tag} has no previous roles`);
            continue;
          }
          for (const role of previous_roles) {
            if (!member.guild.roles.cache.get(role)) previous_roles?.splice(previous_roles?.indexOf(role), 1);
          }
          await member.roles.add(previous_roles!);
        }
        if (rows[0].mute_role && guild.roles.cache.has(rows[0].mute_role)) await member.roles.remove(rows[0].mute_role);
      }
    }
    // Delete expired punishments from the database
    await client.pgClient.query("DELETE FROM punishments WHERE expires < $1", [new Date()]);
    // Schedule the next check in 5 minutes
    setTimeout(check, 1000 * 60 * 5);
  };
  await check();
};
