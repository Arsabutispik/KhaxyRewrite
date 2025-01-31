import {Events, ActivityType} from "discord.js";
import {EventBase, KhaxyClient} from "../../@types/types";
import {loadEmojis} from "../lib/PlayerConfig.js";
import {CronJob} from "cron";
import colorOfTheDay from "../utils/colorOfTheDay.js";
import logger from "../lib/logger.js";
import checkPunishments from "../utils/checkPunishments.js";
import recoverMissedCronjob from "../utils/recoverMissedCronjob.js";

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: KhaxyClient) {
        const emojis: Array<{ name: string; id: string; fallBack: string }> = [
            {
                name: "searchEmoji",
                id: client.config.Emojis.searchEmoji,
                fallBack: "🔍",
            },
            {
                name: "gearSpinning",
                id: client.config.Emojis.gearSpinning,
                fallBack: "⚙️",
            },
            {
                name: "mailSent",
                id: client.config.Emojis.mailSent,
                fallBack: "📩",
            },
            {
                name: "confirm",
                id: client.config.Emojis.confirm,
                fallBack: "✅",
            },
            {
                name: "reject",
                id: client.config.Emojis.reject,
                fallBack: "❌",
            },
            {
                name: "ban",
                id: client.config.Emojis.ban,
                fallBack: "🔨",
            },
            {
                name: "forceban",
                id: client.config.Emojis.forceban,
                fallBack: "🔨",
            },
        ];
        await loadEmojis(client, emojis);
        CronJob.from({
            cronTime: '0 0 0 * * *',
            onTick: () => colorOfTheDay(client),
            onComplete: () => {logger.info("Color of the day cronjob has been completed.")},
            start: true,
            timeZone: 'UTC'
        })
        CronJob.from({
            cronTime: '0 0 0 * * *',
            onTick: () => checkPunishments(client),
            onComplete: () => {logger.info("Check punishments cronjob has been completed.")},
            start: true,
            timeZone: 'UTC'
        })
        await checkPunishments(client)
        await recoverMissedCronjob(client)

        const messages: { message: string; type: ActivityType.Custom | undefined }[] = [
            {
                message: `Use /invite to add me!`,
                type: ActivityType.Custom,
            },
            {
                message: `${client.guilds.cache.size} Guilds are under my protection.`,
                type: ActivityType.Custom,
            },
            {
                message: "/play What about listening to some music?",
                type: ActivityType.Custom,
            },
        ];

        const status = messages[Math.floor(Math.random() * messages.length)];
        client.user!.setActivity(status.message, { type: status.type });
        setInterval(() => {
            messages[1] = {
                message: `${client.guilds.cache.size} Guilds are under my protection.`,
                type: ActivityType.Custom,
            };
            const status = messages[Math.floor(Math.random() * messages.length)];
            client.user!.setActivity(status.message, { type: status.type });
        }, 60000);
    }
} as EventBase