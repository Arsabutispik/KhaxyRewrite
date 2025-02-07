import { KhaxyClient } from "../../@types/types";
import { specificGuildColorUpdate } from "./colorOfTheDay.js";
import logger from "../lib/Logger.js";
import { specificGuildUnregisteredPeopleUpdate } from "./checkUnregisteredPeople.js";
export default async (client: KhaxyClient) => {
  // Fetch all cron jobs from the database
  const { rows } = await client.pgClient.query(
    "SELECT * FROM cronjobs",
  );

  for (const cronjob of rows) {
    // Check if the color cron job has been missed
    if (new Date(cronjob.colortime).getTime() < Date.now()) {
      logger.info(`Missed colorCron job, recovering...`);
      // Recover the missed color cron job
      await specificGuildColorUpdate(client, cronjob.id);
    }
    if(new Date(cronjob.unregistered_people_time).getTime() < Date.now()) {
      logger.info(`Missed unregistered people cron job, recovering...`);
      // Recover the missed unregistered people cron job
      await specificGuildUnregisteredPeopleUpdate(client, cronjob.id);
    }
  }
};
