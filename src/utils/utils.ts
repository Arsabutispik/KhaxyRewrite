import {GuildConfig, KhaxyClient} from "../../@types/types";
import {Snowflake, TextChannel, User, time} from "discord.js";

const consoleColors = {
    SUCCESS: "\u001b[32m",
    WARNING: "\u001b[33m",
    ERROR: "\u001b[31m",
    INFO: "\u001b[36m",
};
/**
 * Logs a message to the console with a specific type and path.
 *
 * @param type - The type of the log message (SUCCESS, ERROR, WARNING, INFO).
 * @param path - The path or context of the log message.
 * @param text - The text of the log message.
 */
function log(type: "SUCCESS" | "ERROR" | "WARNING" | "INFO", path: string, text: string) {
    console.log(
        `\u001b[36;1m<bot-prefab>\u001b[0m\u001b[34m [${path}]\u001b[0m - ${consoleColors[type]}${text}\u001b[0m`,
    );
}
/**
 * Pauses execution for a specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified time.
 */
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Updates or sends a bump leaderboard message in the specified guild's bump leaderboard channel.
 *
 * @param client - The KhaxyClient instance.
 * @param guildID - The ID of the guild where the leaderboard should be updated.
 * @param lastBump - (Optional) The User who performed the last bump.
 * @returns An object with an error message if the task is aborted, otherwise undefined.
 */
async function bumpLeaderboard(client: KhaxyClient, guildID: Snowflake, lastBump?: User) {
    // Fetch the guild from the client's cache
    const guild = client.guilds.cache.get(guildID);
    if (!guild) return;

    // Fetch the guild configuration from the database
    const { rows } = await client.pgClient.query("SELECT * FROM guilds WHERE id = $1", [guildID]);
    const guildConfig = rows[0] as GuildConfig || null;
    const lang = guildConfig.language || "en";
    const t = client.i18next.getFixedT(lang);
    if (!guildConfig) return;

    // Fetch the bump leaderboard channel from the guild's cache
    const channel = guild.channels.cache.get(guildConfig.bumpLeaderboardChannel) as TextChannel;
    if (!channel) return;

    // Fetch the bump leaderboard data from the database
    const { rows: rows2 } = await client.pgClient.query("SELECT users, winner FROM bumpleaderboard WHERE id = $1", [guildID]) as { rows: { users: { userID: Snowflake; bumps: number }[]; winner: { user: { userID: Snowflake; bumps: number } | null; totalBumps: number } }[] };
    const result = rows2[0];
    if (!result) return;

    // Fetch the messages from the bump leaderboard channel
    const messages = await channel.messages.fetch();
    const message = messages.first();

    // If a message exists, update it
    if (message) {
        // Check if the message was sent by the bot
        if (message.author.id !== client.user!.id) {
            log("WARNING", "src/utils.ts", `bumpLeaderboard: The message in ${guild.id} is not sent by the bot. Aborting the task`);
            return { error: t("bump_leaderboard.message_not_sent_by_bot") };
        }

        // Construct the leaderboard message
        let leaderBoardMessage = t("bump_leaderboard.initial");
        let count = 1;
        result.users
            .sort((a, b) => b.bumps - a.bumps)
            .forEach((user) => {
                leaderBoardMessage += `\n${count}. <@${user.userID}> - **${user.bumps}** bumps`;
                count++;
            });

        // Add the last bump information if available
        if (lastBump) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_bump", { time: time(new Date(), "R"), user: lastBump.toString() })}`;
        }

        // Add the last winner information if available
        if (result.winner?.totalBumps) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_winner", { totalBump: result.winner.totalBumps, user: `<@${result.winner.user!.userID}>`, count: result.winner.user!.bumps! })}`;
        }

        // Edit the existing message with the updated leaderboard
        await message.edit({ content: leaderBoardMessage });
    } else {
        // If no message exists, send a new one
        let leaderBoardMessage = t("bump_leaderboard.initial");
        let count = 1;
        result.users
            .sort((a, b) => b.bumps - a.bumps)
            .forEach((user) => {
                leaderBoardMessage += `\n${count}. <@${user.userID}> - **${user.bumps}** bumps`;
                count++;
            });

        // Add the last bump information if available
        if (lastBump) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_bump", { time: time(new Date(), "R"), user: lastBump.toString() })}`;
        }

        // Add the last winner information if available
        if (result.winner?.totalBumps) {
            leaderBoardMessage += `\n\n${t("bump_leaderboard.last_winner", { totalBump: result.winner.totalBumps, user: `<@${result.winner.user!.userID}>`, count: result.winner.user!.bumps! })}`;
        }

        // Send the new leaderboard message
        await channel.send({ content: leaderBoardMessage });
    }
}

/**
 * Replaces placeholders in the given template with corresponding values from the provided contexts.
 * Placeholders are in the format `#{context.property}` and support nested properties.
 *
 * @param template - The template string containing placeholders.
 * @param contexts - An object containing multiple contexts for resolving placeholders.
 * @param defaultValue - (Optional) A default value to use if a placeholder cannot be resolved.
 * @returns The template string with placeholders replaced by their corresponding values.
 */
function replacePlaceholders(
    template: string,
    contexts: Record<string, any>, // Supports multiple contexts as objects
    defaultValue: string = ""
): string {
    return template.replace(/#{([\w.]+)}/g, (match, key) => {
        // Split the placeholder key into context and property path (e.g., "user.profile.name")
        const [contextName, ...propertyPath] = key.split(".");
        const context = contexts[contextName]; // Access the corresponding context by its name

        // If the context doesn't exist, return the default value or keep the placeholder
        if (!context) return defaultValue || match;

        // Traverse the property path to get the nested value
        let value: any = context;
        for (const prop of propertyPath) {
            value = value?.[prop]; // Safely access the next property in the path
            if (value === undefined) break; // Stop if the property doesn't exist
        }

        // Return the resolved value, or use the default value or original placeholder if unresolved
        return value !== undefined ? value : defaultValue || match;
    });
}

export {log, sleep, bumpLeaderboard, replacePlaceholders}