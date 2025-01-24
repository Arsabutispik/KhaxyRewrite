import {GuildConfig, KhaxyClient} from "../../@types/types";
import {Snowflake, TextChannel, time, User} from "discord.js";
import _ from "lodash";
import logger from "../lib/logger.js";

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
            logger.warn(`The message in ${guild.id} is not sent by the bot. Aborting the task`);
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
 * Recursively sanitizes an object to include only read-only properties.
 * Limits the depth of recursion to avoid maximum call stack size exceeded errors.
 *
 * @param obj - The object to sanitize.
 * @param depth - The current depth of recursion.
 * @param maxDepth - The maximum allowed depth of recursion.
 * @param seen - A set to track seen objects and avoid circular references.
 * @returns A sanitized object with only the allowed properties.
 */
function sanitizeObject(obj: Record<string, any>, depth: number = 0, maxDepth: number = 10, seen: Set<any> = new Set()): Record<string, any> {
    if (depth > maxDepth || seen.has(obj)) {
        return {};
    }
    seen.add(obj);

    const sanitized: Record<string, any> = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                sanitized[key] = sanitizeObject(value, depth + 1, maxDepth, seen);
            } else if (typeof value !== "function") {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
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
    // Sanitize all contexts to ensure only read-only properties are accessible
    const sanitizedContexts = _.mapValues(contexts, context => sanitizeObject(context));

    return template.replace(/#{([\w.]+)}/g, (match, key) => {
        // Split the placeholder key into context and property path (e.g., "user.profile.name")
        const [, ...propertyPath] = key.split(".");
        // Safely access the nested value using lodash's get method
        const value = _.get(sanitizedContexts, [...propertyPath].join("."), defaultValue);

        // Log the resolved value for debugging
        console.log(`Resolved value for ${key}:`, value);

        // Return the resolved value, or use the default value or original placeholder if unresolved
        return value !== undefined ? String(value) : defaultValue || match;
    });
}
/**
 * Returns a string of missing permissions in a human-readable format.
 * @param client - KhaxyClient instance
 * @param missing - Array of missing permissions
 * @param language - The language code
 */
function missingPermissionsAsString(client: KhaxyClient, missing: string[], language: string) {
    const t = client.i18next.getFixedT(language);
    return missing.map((perm) => t(`permissions:${perm}`)).join(", ");
}

export {sleep, bumpLeaderboard, replacePlaceholders, missingPermissionsAsString};