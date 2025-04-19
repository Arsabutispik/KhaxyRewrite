import modlog from "./modLog.js";
import dayjs from "dayjs";
import { Guilds, Punishments } from "../../@types/DatabaseTypes";
import logger from "../lib/Logger.js";
import { decryptValue, toStringId } from "./utils.js";
import { Client } from "discord.js";

export default async (client: Client) => {
  const check = async () => {
    // Fetch punishments that have expired
    const { rows } = await client.pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE pgp_sym_decrypt(expires, $2)::timestamp < $1",
      [new Date(), process.env.PASSPHRASE],
    );
    for (const result of rows) {
      // Destructure punishment details
      const user_id = await decryptValue(result.user_id, client.pgClient);
      const type = await decryptValue(result.type, client.pgClient);
      const previous_roles = result.previous_roles
        ? JSON.parse(await decryptValue(result.previous_roles, client.pgClient))
        : null;
      const staff_id = await decryptValue(result.staff_id, client.pgClient);
      const expires = await decryptValue(result.expires, client.pgClient);
      const created_at = await decryptValue(result.created_at, client.pgClient);
      const guild_id = await decryptValue(result.guild_id, client.pgClient);
      if (!user_id || !type || !expires || !guild_id) {
        logger.error("Failed to decrypt necessary fields for punishment:", result);
        continue;
      }
      const guild = client.guilds.cache.get(toStringId(guild_id));
      if (!guild) {
        logger.info(`Guild ${guild_id} not found`);
        continue;
      }
      await guild.members.fetch();
      // Fetch guild configuration
      const { rows } = await client.pgClient.query<Guilds>(
        "SELECT language, mute_get_all_roles, mute_role_id FROM guilds WHERE id = $1",
        [guild.id],
      );
      if (!rows[0]) {
        logger.info(`Guild ${guild.name} not found in database`);
        continue;
      }

      const user = await client.users.fetch(toStringId(user_id));

      const staff = await client.users.fetch(toStringId(staff_id));
      const expiresDate = dayjs(expires);
      const createdAtDate = dayjs(created_at);
      const duration = dayjs(expiresDate.diff(createdAtDate));

      if (type === "ban") {
        // If the punishment is a ban, unban the user
        if (!guild.bans.cache.get(toStringId(user_id))) {
          logger.info(`User ${user.tag} not found in guild ${guild.name}`);
          continue;
        }
        await guild.members.unban(
          toStringId(user_id),
          client.i18next.getFixedT(rows[0].language)("commands:ban.expired"),
        );
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
        const member = guild.members.cache.get(toStringId(user_id));
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
        if (rows[0].mute_role_id && guild.roles.cache.has(toStringId(rows[0].mute_role_id)))
          await member.roles.remove(toStringId(rows[0].mute_role_id));
      }
    }
    // Delete expired punishments from the database
    await client.pgClient.query("DELETE FROM punishments WHERE expires < $1", [new Date()]);
    // Schedule the next check in 5 minutes
    setTimeout(check, 1000 * 60 * 5);
  };
  await check();
};
