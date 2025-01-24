import { KhaxyClient } from "../../@types/types";
import { specificGuildColorUpdate } from "./colorOfTheDay.js";
import { specificGuildBumpLeaderboardUpdate } from "./resetBumpLeaderboard.js";
import logger from "../lib/logger.js";
export default async (client: KhaxyClient) => {
    // Fetch all cron jobs from the database
    const { rows } = await client.pgClient.query('SELECT * FROM colorcronjobs C INNER JOIN resetbumpleaderboardcronjobs R ON C.id = R.id');

    for (const cronjob of rows) {
        // Check if the color cron job has been missed
        if(new Date(cronjob.colortime).getTime() < Date.now()) {
            logger.info(`Missed colorCron job, recovering...`);
            // Recover the missed color cron job
            await specificGuildColorUpdate(client, cronjob.id);
        }

        // Check if the reset bump leaderboard cron job has been missed
        if(new Date(cronjob.resetbumptime).getTime() < Date.now()) {
            logger.info(`Missed resetBumpLeaderboardCron job, recovering...`);
            // Recover the missed reset bump leaderboard cron job
            await specificGuildBumpLeaderboardUpdate(client, cronjob.id);
        }
    }
};