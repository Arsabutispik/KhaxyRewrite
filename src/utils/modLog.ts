import dayjs, {Dayjs} from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import "dayjs/locale/en.js";
import "dayjs/locale/tr.js";
import {Guild, ChannelType, User} from "discord.js";
import {GuildConfig, KhaxyClient} from "../../@types/types";
import {log} from "./utils.js";
type actions =
    | "WARNING"
    | "BAN"
    | "KICK"
    | "MUTE"
    | "FORCED_BAN"
    | "TIMED_BAN"
    | "CHANGES"
    | "UNBAN"
    | "BAN_EXPIRED"
    | "FORCED_TIMED_BAN"
    | "TIMEOUT"
    | "UNMUTE";

export default async (
    data: {
        guild: Guild,
        user: User,
        action: actions,
        moderator: User,
        reason?: string,
        duration?: Dayjs,
        caseID?: number
    },
    client: KhaxyClient
) => {
    const {guild, user, action, moderator, reason, duration, caseID} = data;
    const {rows} = await client.pgClient.query('SELECT language, mod_log_channel, case_id FROM guilds WHERE id = $1', [guild.id]);
    const guildConfig = rows[0] as GuildConfig | null;
    const lang = guildConfig?.language || "en";
    const t = client.i18next.getFixedT(lang);
    if(!guildConfig) {
        log("WARNING", "modLog.ts", `Guild config for ${guild.id} not found. Creating...`);
        await client.pgClient.query('INSERT INTO guilds  (id, language) VALUES ($1, $2)', [guild.id, 'en']);
        log("INFO", "modLog.ts", `Guild config for ${guild.id} created successfully.`);
        return {message: t("mod_log.function_errors.no_guild_config"), type: "WARNING"};
    }
    if(!guildConfig.mod_log_channel) return;
    const caseNumber = caseID || guildConfig!.case_id
    let message = `<t:${Math.floor(Date.now() / 1000)}> \`[${caseNumber}]\``;

    dayjs.extend(relativeTime);
    dayjs.locale(lang);
    switch (action) {
        case "WARNING":
            message += t("mod_log.warning", {moderator, user, reason});
            break;
        case "BAN":
            message += t("mod_log.ban", {moderator, user, reason, emoji: "🔨"});
            break;
        case "KICK":
            message += t("mod_log.kick", {moderator, user, reason});
            break;
        case "MUTE":
            message += t("mod_log.mute", {moderator, user, reason, duration: dayjs(duration).fromNow(true)});
            break;
        case "FORCED_BAN":
            message += t("mod_log.forced_ban", {moderator, user, reason});
            break;
        case "TIMED_BAN":
            message += t("mod_log.timed_ban", {moderator, user, reason, duration: dayjs(duration).fromNow(true)});
            break;
        case "CHANGES":
            message += t("mod_log.changes", {moderator, user, reason, case: caseID, time: `${Math.floor(Date.now() / 1000)}`});
            break;
        case "UNBAN":
            message += t("mod_log.unban", {moderator, user, reason});
            break;
        case "BAN_EXPIRED":
            message += t("mod_log.ban_expired", {moderator, user, reason});
            break;
        case "FORCED_TIMED_BAN":
            message += t("mod_log.forced_timed_ban", {moderator, user, reason, duration: dayjs(duration).fromNow(true)});
            break;
        case "TIMEOUT":
            message += t("mod_log.timeout", {moderator, user, reason, duration: dayjs(duration).fromNow(true)});
            break;
        case "UNMUTE":
            message += t("mod_log.unmute", {moderator, user, reason});
            break;
    }
    try {
        const channel = await guild.channels.fetch(guildConfig.mod_log_channel);
        if(channel && channel.isTextBased() && channel.type === ChannelType.GuildText) {
            await channel.send({content: message});
        }
    } catch (error) {
        log(
            "ERROR",
            "modLog.ts",
            `An error occurred while sending modlog message to ${guild.name} (${guild.id}): ${error.message}`,
        );
        log("INFO", "modLog.ts", "Deleting the modlog channel id to prevent this issue in the future...");
        try {
            await client.pgClient.query('UPDATE guilds SET mod_log_channel = NULL WHERE id = $1', [guild.id]);
            log("INFO", "modLog.ts", `Modlog channel id for ${guild.id} deleted successfully.`);
        } catch (error) {
            log("ERROR", "modLog.ts", `An error occurred while deleting the modlog channel id from the database: ${error.message}`);
        }
        return {message: t("mod_log.function_errors.channel_error"), type: "ERROR"};
    }
    if(action !== "CHANGES") {
        try {
            await client.pgClient.query('UPDATE guilds SET case_id = $1 WHERE id = $2', [caseNumber + 1, guild.id]);
        } catch (error) {
            log("ERROR", "modLog.ts", `An error occurred while updating the case id for ${guild.id}: ${error.message}`);
            return {message: t("mod_log.function_errors.case_id_error"), type: "ERROR"};
        }
    }
}