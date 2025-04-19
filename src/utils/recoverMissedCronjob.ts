import { specificGuildColorUpdate } from "./colorOfTheDay.js";
import logger from "../lib/Logger.js";
import { specificGuildUnregisteredPeopleUpdate } from "./checkUnregisteredPeople.js";
import { Cronjobs } from "../../@types/DatabaseTypes";
import { toStringId } from "./utils.js";
import { Client } from "discord.js";
import process from "node:process";

export default async (client: Client) => {
  // Fetch all cron jobs from the database
  const { rows } = await client.pgClient.query<Cronjobs>(
    "SELECT pgp_sym_decrypt(id, $1) as id, pgp_sym_decrypt(color_time, $1) as color_time, pgp_sym_decrypt(unregistered_people_time, $1) as unregistered_people_time FROM cronjobs",
    [process.env.PASSPHRASE],
  );

  for (const cronjob of rows) {
    // Check if the color cron job has been missed
    if (new Date(cronjob.color_time).getTime() < Date.now()) {
      logger.log({
        level: "info",
        message: `Missed color cron job, recovering...`,
        discord: false,
      });
      // Recover the missed color cron job
      await specificGuildColorUpdate(client, toStringId(cronjob.id));
    }
    if (new Date(cronjob.unregistered_people_time ?? new Date()).getTime() < Date.now()) {
      logger.log({
        level: "info",
        message: `Missed unregistered people cron job for ${cronjob.id}, recovering...`,
        discord: false,
      });
      // Recover the missed unregistered people cron job
      await specificGuildUnregisteredPeopleUpdate(client, toStringId(cronjob.id));
    }
  }
};
