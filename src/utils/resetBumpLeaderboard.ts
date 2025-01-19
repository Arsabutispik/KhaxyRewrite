import { KhaxyClient } from "../../@types/types";
import dayjs from "dayjs";
import { bumpLeaderboard } from "./utils.js";
import { BumpLeaderboardTypes } from "../../@types/PostgreTypes";

export default async (client: KhaxyClient) => {
    // Fetch bump leaderboard data from the database
    const { rows } = await client.pgClient.query('SELECT id, users FROM bumpleaderboard') as { rows: BumpLeaderboardTypes[] };

    for (const row of rows) {
        const { id, users } = row;

        // Determine the user with the most bumps
        const winner = users.sort((a, b) => b.bumps - a.bumps)[0];
        const totalbumps = users.reduce((acc, user) => acc + user.bumps, 0);

        // Create a new winner object
        const newWinner = {
            userID: winner.id,
            bumps: winner.bumps,
            totalbumps
        };

        // Update the winner in the database
        await client.pgClient.query('UPDATE bumpleaderboard SET winner = $1 WHERE id = $2', [newWinner, id]);

        // Update the reset bump time in the database
        const query = `
            UPDATE resetbumpleaderboardcronjobs
            SET resetbumptime = $1
            WHERE id = $2`;
        await client.pgClient.query(query, [dayjs().add(1, 'month').toISOString(), id]);

        // Update the bump leaderboard
        await bumpLeaderboard(client, id);
    }
};

export async function specificGuildBumpLeaderboardUpdate(client: KhaxyClient, guildId: string) {
    // Fetch bump leaderboard data for the specific guild
    const { rows } = await client.pgClient.query('SELECT id, users FROM bumpleaderboard WHERE id = $1', [guildId]);
    const row = rows[0];
    const { id, users } = row as { id: string, users: { id: string, bumps: number }[] };

    // Determine the user with the most bumps
    const winner = users.sort((a, b) => b.bumps - a.bumps)[0];
    const totalbumps = users.reduce((acc, user) => acc + user.bumps, 0);

    // Create a new winner object
    const newWinner = {
        userID: winner.id,
        bumps: winner.bumps,
        totalbumps
    };

    // Update the winner in the database
    await client.pgClient.query('UPDATE bumpleaderboard SET winner = $1 WHERE id = $2', [newWinner, id]);

    // Update the reset bump time in the database
    const query = `
        UPDATE resetbumpleaderboardcronjobs
        SET resetbumptime = $1
        WHERE id = $2`;
    await client.pgClient.query(query, [dayjs().add(1, 'month').toISOString(), id]);

    // Update the bump leaderboard
    await bumpLeaderboard(client, id);
}