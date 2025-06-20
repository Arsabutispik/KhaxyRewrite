import { ActivityType, Events } from "discord.js";
import type { EventBase } from "@customTypes";
import { logger } from "@lib";
import { loadEmojis, recoverMissedCronjob } from "@utils";
export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    if (process.env.NODE_ENV === "development") {
      await client.application.commands
        .fetch({ guildId: process.env.GUILD_ID, withLocalizations: true })
        .catch(() => null);
    } else {
      await client.application.commands.fetch({ withLocalizations: true });
    }
    await recoverMissedCronjob(client);
    const emojis: Array<{ name: string; id: string; fallback: string }> = [
      {
        name: "searchEmoji",
        id: client.config.Emojis.searchEmoji,
        fallback: "🔍",
      },
      {
        name: "gearSpinning",
        id: client.config.Emojis.gearSpinning,
        fallback: "⚙️",
      },
      {
        name: "mailSent",
        id: client.config.Emojis.mailSent,
        fallback: "📩",
      },
      {
        name: "confirm",
        id: client.config.Emojis.confirm,
        fallback: "✅",
      },
      {
        name: "reject",
        id: client.config.Emojis.reject,
        fallback: "❌",
      },
      {
        name: "ban",
        id: client.config.Emojis.ban,
        fallback: "🔨",
      },
      {
        name: "edit",
        id: client.config.Emojis.edit,
        fallback: "✏️",
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
