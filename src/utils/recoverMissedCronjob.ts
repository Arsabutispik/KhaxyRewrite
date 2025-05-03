import { specificGuildColorUpdate } from "./colorOfTheDay.js";
import logger from "../lib/Logger.js";
import { specificGuildUnregisteredPeopleUpdate } from "./checkUnregisteredPeople.js";
import { Cronjobs } from "../../@types/DatabaseTypes";
import { toStringId } from "./utils.js";
import { Client } from "discord.js";

export default async (client: Client) => {
  // Fetch all cron jobs from the database
  const { rows } = await client.pgClient.query<Cronjobs>("SELECT * FROM cronjobs");

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
