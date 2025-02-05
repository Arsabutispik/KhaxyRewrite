import { KhaxyClient } from "../../@types/types";
import { specificGuildColorUpdate } from "./colorOfTheDay.js";
import logger from "../lib/logger.js";
export default async (client: KhaxyClient) => {
  // Fetch all cron jobs from the database
  const { rows } = await client.pgClient.query(
    "SELECT * FROM colorcronjobs",
  );

  for (const cronjob of rows) {
    // Check if the color cron job has been missed
    if (new Date(cronjob.colortime).getTime() < Date.now()) {
      logger.info(`Missed colorCron job, recovering...`);
      // Recover the missed color cron job
      await specificGuildColorUpdate(client, cronjob.id);
    }
  }
};
