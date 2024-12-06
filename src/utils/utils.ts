import {GuildConfig, KhaxyClient} from "../../@types/types";
import {Snowflake, TextChannel, User, time} from "discord.js";

const consoleColors = {
    SUCCESS: "\u001b[32m",
    WARNING: "\u001b[33m",
    ERROR: "\u001b[31m",
    INFO: "\u001b[36m",
};
function log(type: "SUCCESS" | "ERROR" | "WARNING" | "INFO", path: string, text: string) {
    console.log(
        `\u001b[36;1m<bot-prefab>\u001b[0m\u001b[34m [${path}]\u001b[0m - ${consoleColors[type]}${text}\u001b[0m`,
    );
}
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function bumpLeaderboard(client: KhaxyClient, guildID: Snowflake, lastBump?: User) {
    const guild = client.guilds.cache.get(guildID);
    if (!guild) return;
    const { rows } = await client.pgClient.query("SELECT * FROM guilds WHERE id = $1", [guildID]);
    const guildConfig = rows[0] as GuildConfig || null;
    const lang = guildConfig.language || "en";
    const t = client.i18next.getFixedT(lang);
    if (!guildConfig) return;
    const channel = guild.channels.cache.get(guildConfig.bumpLeaderboardChannel) as TextChannel
    if (!channel) return;
    const { rows: rows2 } = await client.pgClient.query("SELECT users, winner FROM bumpleaderboard WHERE id = $1", [guildID]) as { rows: { users: { userID: Snowflake; bumps: number }[]; winner: { user: { userID: Snowflake; bumps: number } | null; totalBumps: number } }[] };
    const result = rows2[0];
    if (!result) return;
    const messages = await channel.messages.fetch();
    const message = messages.first();
    if (message) {
        if (message.author.id !== client.user!.id) {
            log("WARNING", "src/utils.ts", "bumpLeaderboard: The message is not sent by the bot. Aborting the task");
            return { error: "The message is not sent by the bot. Aborting the task" };
        }
        let leaderBoardMessage = t("bump_leaderboard.initial")
        let count = 1;
        result.users
            .sort((a, b) => b.bumps - a.bumps)
            .forEach((user) => {
                leaderBoardMessage += `\n${count}. <@${user.userID}> - **${user.bumps}** bumps`;
                count++;
            });
        if (lastBump) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_bump", { time: time(new Date(), "R"), user: lastBump.toString() })}`;
        }
        if (result.winner?.totalBumps) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_winner", { totalBump: result.winner.totalBumps,
                user: `<@${result.winner.user!.userID}>`, 
                count: result.winner.user!.bumps! })}`;
        }
        await message.edit({ content: leaderBoardMessage });
    } else if (!message) {
        let leaderBoardMessage = t("bump_leaderboard.initial")
        let count = 1;
        result.users
            .sort((a, b) => b.bumps - a.bumps)
            .forEach((user) => {
                leaderBoardMessage += `\n${count}. <@${user.userID}> - **${user.bumps}** bumps`;
                count++;
            });
        if (lastBump) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_bump", { time: time(new Date(), "R"), user: lastBump.toString() })}`;
        }
        if (result.winner?.totalBumps) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_winner", { totalBump: result.winner.totalBumps,
                user: `<@${result.winner.user!.userID}>`,
                count: result.winner.user!.bumps! })}`;
        }
        await channel.send({ content: leaderBoardMessage });
    }
}

export {log, sleep, bumpLeaderboard}