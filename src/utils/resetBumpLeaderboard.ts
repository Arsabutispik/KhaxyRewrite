import {KhaxyClient} from "../../@types/types";
import dayjs from "dayjs";
import {bumpLeaderboard} from "./utils.js";

export default async (client: KhaxyClient) => {
    const { rows } = await client.pgClient.query('SELECT id, users from bumpleaderboard')
    for (const row of rows) {
        const {id, users} = row as {id: string, users: {id: string, bumps: number}[]};
        const winner = users.sort((a, b) => b.bumps - a.bumps)[0];
        const totalbumps = users.reduce((acc, user) => acc + user.bumps, 0);
        const newWinner = {
            userID: winner.id,
            bumps: winner.bumps,
            totalbumps
        }
        await client.pgClient.query('UPDATE bumpleaderboard SET winner = $1 WHERE id = $2', [newWinner, id]);
        const query = `
            UPDATE resetbumpleaderboardcronjobs 
            SET resetbumptime = $1
            WHERE id = $2`
        await client.pgClient.query(query, [dayjs().add(1, 'month').toISOString(), id])
        await bumpLeaderboard(client, id);
    }
}

export async function specificGuildBumpLeaderboardUpdate(client: KhaxyClient, guildId: string) {
    const { rows } = await client.pgClient.query('SELECT id, users from bumpleaderboard WHERE id = $1', [guildId])
    const row = rows[0];
    const {id, users} = row as {id: string, users: {id: string, bumps: number}[]};
    const winner = users.sort((a, b) => b.bumps - a.bumps)[0];
    const totalbumps = users.reduce((acc, user) => acc + user.bumps, 0);
    const newWinner = {
        userID: winner.id,
        bumps: winner.bumps,
        totalbumps
    }
    await client.pgClient.query('UPDATE bumpleaderboard SET winner = $1 WHERE id = $2', [newWinner, id]);
    const query = `
            UPDATE resetbumpleaderboardcronjobs 
            SET resetbumptime = $1
            WHERE id = $2`
    await client.pgClient.query(query, [dayjs().add(1, 'month').toISOString(), id])
    await bumpLeaderboard(client, id);
}