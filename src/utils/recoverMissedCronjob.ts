import { KhaxyClient } from "../../@types/types";
import { specificGuildColorUpdate } from "./colorOfTheDay.js";
import { specificGuildBumpLeaderboardUpdate } from "./resetBumpLeaderboard.js";
import { log } from "./utils.js";

export default async (client: KhaxyClient) => {
    const { rows } = await client.pgClient.query('SELECT * FROM colorcronjobs C INNER JOIN resetbumpleaderboardcronjobs R ON C.id = R.id');
    for (const cronjob of rows) {
        if(new Date(cronjob.colortime).getTime() < Date.now()) {
            log("ERROR", "src/utils/recoverMissedCronJob.ts", "Missed colorCron job, recovering...");
            await specificGuildColorUpdate(client, cronjob.id);
        }
        if(new Date(cronjob.resetbumptime).getTime() < Date.now()) {
            log("ERROR", "src/utils/recoverMissedCronJob.ts", "Missed resetBumpLeaderboardCron job, recovering...");
            await specificGuildBumpLeaderboardUpdate(client, cronjob.id);
        }
    }
};