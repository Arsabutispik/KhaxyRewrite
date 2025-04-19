import { ActivityType, Events } from "discord.js";
import { EventBase } from "../../@types/types";
import { loadEmojis } from "../lib/PlayerConfig.js";
import logger from "../lib/Logger.js";
import recoverMissedCronjob from "../utils/recoverMissedCronjob.js";
export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await recoverMissedCronjob(client);
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
    ];
    await loadEmojis(client, emojis);
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
    logger.log({
      level: "info",
      message: `Logged in as ${client.user!.tag}`,
      discord: false,
    });
  },
} satisfies EventBase<Events.ClientReady>;
