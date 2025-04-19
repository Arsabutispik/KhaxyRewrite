//TODO: Handle emojis
import { Client, Collection, EmbedBuilder, IntentsBitField, Partials, PermissionsBitField } from "discord.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { RegisterSlashCommands } from "./utils/registry.js";
import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import pg from "pg";
import { Redis } from "ioredis";
import logger from "./lib/Logger.js";
import { Player } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import process from "node:process";
import { CronJob } from "cron";
import checkPunishments from "./utils/checkPunishments.js";
import { Guilds, Mod_mail_threads, Punishments } from "../@types/DatabaseTypes";
import colorOfTheDay from "./utils/colorOfTheDay.js";
import { decryptValue } from "./utils/utils.js";
dotenv.config();
const { Client: PgClient } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildModeration,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.MessageContent,
  ],
  partials: [Partials.Channel],
});
const player = new Player(client);
await player.extractors.loadMulti(DefaultExtractors);
const pgClient = new PgClient({
  user: process.env.DB_USER,
  host: "localhost",
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});
const redis = new Redis();
(async () => {
  await pgClient.connect();
  const res = await pgClient.query("SELECT $1::text as connected", ["Connection to postgres successful!"]);
  logger.log({
    level: "info",
    message: res.rows[0].connected,
    discord: false,
  });
})();
redis
  .ping()
  .then(() => {
    logger.log({
      level: "info",
      message: "Connected to Redis successfully!",
      discord: false,
    });
  })
  .catch((e) => {
    logger.log({
      level: "error",
      message: e,
      discord: false,
    });
  });
await i18next.use(FsBackend).init(
  {
    initAsync: false,
    lng: "en",
    fallbackLng: "en",
    preload: ["en", "tr"],
    ns: ["translation", "events", "permissions", "commands"],
    defaultNS: "translation",
    backend: {
      loadPath: "locales/{{lng}}/{{ns}}.json",
    },
    interpolation: { escapeValue: false },
  },
  (err) => {
    if (err)
      return logger.log({
        level: "error",
        message: err,
        discord: false,
      });
    logger.log({
      level: "info",
      message: "i18next has been initialized.",
      discord: false,
    });
    client.i18next = i18next;
  },
);
client.slashCommands = new Collection();
client.pgClient = pgClient;
client.redis = redis;
client.config = (await import("./lib/PlayerConfig.js")).default;
client.allEmojis = new Collection();
client.getGuildConfig = async (guildId) => {
  // Check if the guild config is already in Redis
  const exists = await client.redis.exists(`guild:${guildId}`);
  if (exists) {
    // If it exists, return the cached value
    const guildConfig = await client.redis.get(`guild:${guildId}`);
    if (!guildConfig) return null;
    return JSON.parse(guildConfig) as Guilds;
  } else {
    // If it doesn't exist, fetch from the database
    const res = await pgClient.query<Guilds>("SELECT * FROM guilds WHERE pgp_sym_decrypt(id, $2) = $1", [
      guildId,
      process.env.PASSPHRASE,
    ]);
    if (res.rows.length === 0) return null;
    const guild = res.rows[0];
    const decryptedGuild: Guilds = { ...guild };
    // Decrypt the fields
    for (const field in decryptedGuild) {
      //@ts-expect-error - Typescript doesn't know that guild[field] is a string
      if (guild[field]) {
        //@ts-expect-error - Typescript doesn't know that guild[field] is a string
        decryptedGuild[field] = await decryptValue(guild[field]);
      }
    }
    // Cache the decrypted guild config in Redis
    await client.redis.set(`guild:${guildId}`, JSON.stringify(decryptedGuild), "EX", 60 * 60 * 24); // Cache for 24 hours
    // Return the decrypted guild config
    return decryptedGuild;
  }
};
client.setGuildConfig = async (guildId, config) => {
  const cachedConfig = await client.getGuildConfig(guildId);
  await client.redis.set(`guild:${guildId}`, JSON.stringify({ ...cachedConfig, ...config }), "EX", 60 * 60 * 24); // Cache for 24 hours
};
client.getPunishments = async (guildId, userId, type) => {
  const exists = await client.redis.exists(`punishments:${guildId}:${userId}`);
  if (exists) {
    const punishments = await client.redis.get(`punishments:${guildId}:${userId}`);
    if (!punishments) return null;
    return JSON.parse(punishments) as Punishments;
  } else {
    const res = await pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE pgp_sym_decrypt(guild_id, $4) = $1 AND pgp_sym_decrypt(user_id, $4) = $2 AND pgp_sym_decrypt(type, $4) = $3",
      [guildId, userId, type, process.env.PASSPHRASE],
    );
    if (res.rows.length === 0) return null;
    const punishment = res.rows[0];
    const decryptedPunishment: Punishments = { ...punishment };
    for (const field in decryptedPunishment) {
      //@ts-expect-error - Typescript doesn't know that guild[field] is a string
      if (punishment[field]) {
        //@ts-expect-error - Typescript doesn't know that guild[field] is a string
        decryptedPunishment[field] = await decryptValue(punishment[field]);
      }
    }
    await client.redis.set(`punishments:${guildId}:${userId}`, JSON.stringify(decryptedPunishment), "EX", 60 * 60 * 24); // Cache for 24 hours
    return decryptedPunishment;
  }
};
client.getModmailThread = async (guildId, channelId) => {
  const exists = await client.redis.exists(`modmail:${guildId}:${channelId}`);
  if (exists) {
    const thread = await client.redis.get(`modmail:${guildId}:${channelId}`);
    if (!thread) return null;
    return JSON.parse(thread) as Mod_mail_threads;
  } else {
    const res = await pgClient.query<Mod_mail_threads>(
      "SELECT * FROM mod_mail_threads WHERE pgp_sym_decrypt(guild_id, $3) = $1 AND pgp_sym_decrypt(channel_id, $3) = $2",
      [guildId, channelId, process.env.PGCRYPTO_PASSPHRASE],
    );
    if (res.rows.length === 0) return null;
    const thread = res.rows[0];
    const decryptedThread: Mod_mail_threads = { ...thread };
    for (const field in decryptedThread) {
      //@ts-expect-error - Typescript doesn't know that guild[field] is a string
      if (thread[field]) {
        //@ts-expect-error - Typescript doesn't know that guild[field] is a string
        decryptedThread[field] = await decryptValue(thread[field]);
      }
    }
    await client.redis.set(`modmail:${guildId}:${channelId}`, JSON.stringify(decryptedThread), "EX", 60 * 60 * 24); // Cache for 24 hours
    return decryptedThread;
  }
};
await RegisterSlashCommands(client);
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = (await import(pathToFileURL(filePath).href)).default;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}
player.events.on("playerStart", async (queue, track) => {
  const config = await client.getGuildConfig(queue.metadata.guild.id);
  if (!config) return;
  const t = client.i18next.getFixedT(config.language);
  const embed = new EmbedBuilder()
    .setThumbnail(track.thumbnail)
    .setAuthor({ name: t("events:playerStart.embed.author"), iconURL: client.config.IconURL })
    .setColor("Random")
    .setDescription(t("events:playerStart.embed.description", { track }))
    .setFields([
      {
        name: t("events:playerStart.embed.fieldName0"),
        value: track.requestedBy?.toString() || "Unknown",
        inline: true,
      },
      {
        name: t("events:playerStart.embed.fieldName1"),
        value: track.duration,
        inline: true,
      },
    ]);
  if (
    queue.metadata.channel.isSendable() &&
    queue.metadata.channel.permissionsFor(queue.metadata.guild.members.me).has(PermissionsBitField.Flags.SendMessages)
  )
    queue.metadata.channel.send({ embeds: [embed] });
});

player.events.on("emptyChannel", async (queue) => {
  const config = await client.getGuildConfig(queue.metadata.guild.id);
  if (!config) return;
  const t = client.i18next.getFixedT(config.language);
  const embed = new EmbedBuilder()
    .setDescription(t("events:emptyChannel.embed.description"))
    .setTitle(t("events:emptyChannel.embed.title"))
    .setColor("Red");
  queue.metadata.channel.send({ embeds: [embed] });
});

await client.login(process.env.TOKEN);
CronJob.from({
  cronTime: "0 0 0 * * *",
  onTick: () => checkPunishments(client),
  start: true,
  timeZone: "UTC",
});
async function closeExpiredThreads() {
  try {
    await pgClient.query(
      `UPDATE mod_mail_threads
       SET status = pgp_sym_encrypt('closed', $1), closed_at = pgp_sym_encrypt(NOW()::text, $1)
       WHERE pgp_sym_decrypt(close_date, $1)::timestamp <= NOW()
         AND status != 'closed';`,
      [process.env.PGCRYPTO_PASSPHRASE],
    );
  } catch (error) {
    console.error("Error closing expired threads:", error);
  }
}

// Run every minute
CronJob.from({
  cronTime: "* * * * *",
  onTick: async () => await closeExpiredThreads(),
  start: true,
  timeZone: "UTC",
});
CronJob.from({
  cronTime: "0 0 0 * * *",
  onTick: () => colorOfTheDay(client),
  onComplete: () => {
    logger.log({
      level: "info",
      message: "Color of the day cronjob has been completed.",
      discord: false,
    });
  },
  start: true,
  timeZone: "UTC",
});
