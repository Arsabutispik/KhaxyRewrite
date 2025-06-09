import { logger } from "@lib";
import { toStringId, specificGuildUnregisteredPeopleUpdate, specificGuildColorUpdate } from "@utils";
import { Client } from "discord.js";
import { getCronJobs } from "@database";

export async function recoverMissedCronjob(client: Client) {
  // Fetch all cron jobs from the database
  const cronjobs = await getCronJobs();

  for (const cronjob of cronjobs) {
    // Check if the color cron job has been missed
    if (cronjob.color_time && new Date(cronjob.color_time).getTime() < Date.now()) {
      logger.log({
        level: "info",
        message: `Missed color cron job, recovering...`,
        discord: false,
      });
      // Recover the missed color cron job
      await specificGuildColorUpdate(client, toStringId(cronjob.id));
    }
    if (cronjob.unregistered_people_time && new Date(cronjob.unregistered_people_time).getTime() < Date.now()) {
      logger.log({
        level: "info",
        message: `Missed unregistered people cron job for ${cronjob.id}, recovering...`,
        discord: false,
      });
      // Recover the missed unregistered people cron job
      await specificGuildUnregisteredPeopleUpdate(client, toStringId(cronjob.id));
    }
  }
}
