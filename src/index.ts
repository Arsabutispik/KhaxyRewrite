import { Client, Collection, EmbedBuilder, GatewayIntentBits, Partials, PermissionsBitField } from "discord.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { RegisterSlashCommands } from "./utils/registry.js";
import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import pg from "pg";
import logger from "./lib/Logger.js";
import { Player } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { SoundcloudExtractor } from "discord-player-soundcloud";
import process from "node:process";
import { CronJob } from "cron";
import checkPunishments from "./utils/checkPunishments.js";
import colorOfTheDay from "./utils/colorOfTheDay.js";
import checkExpiredThreads from "./utils/checkExpiredThreads.js";
import { Guilds } from "../@types/DatabaseTypes";

dotenv.config();
const { Client: PgClient } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});
const player = new Player(client);
await player.extractors.register(YoutubeiExtractor, {
  streamOptions: {
    useClient: "WEB_EMBEDDED",
  },
  generateWithPoToken: true,
});
await player.extractors.register(SoundcloudExtractor, {});
const pgClient = new PgClient({
  user: process.env.DB_USER,
  host: "localhost",
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});
(async () => {
  await pgClient.connect();
  const res = await pgClient.query("SELECT $1::text as connected", ["Connection to postgres successful!"]);
  logger.log({
    level: "info",
    message: res.rows[0].connected,
    discord: false,
  });
})();
await i18next.use(FsBackend).init(
  {
    initAsync: false,
    fallbackLng: "en-GB",
    lng: "en-GB",
    preload: ["en-GB", "tr-TR"],
    ns: ["translation", "events", "permissions", "commands"],
    defaultNS: "translation",
    backend: {
      loadPath: "locales/{{lng}}/{{ns}}.json",
    },
    interpolation: { escapeValue: false },
    load: "currentOnly",
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
client.config = (await import("./lib/PlayerConfig.js")).default;
client.allEmojis = new Collection();
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
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [queue.metadata.guild.id]);
  if (!rows.length) return;
  const t = client.i18next.getFixedT(rows[0].language);
  const embed = new EmbedBuilder()
    .setAuthor({ name: t("events:playerStart.embed.author"), url: track.url })
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
  if (track.thumbnail.length) embed.setThumbnail(track.thumbnail);
  if (
    queue.metadata.channel.isSendable() &&
    queue.metadata.channel.permissionsFor(queue.metadata.guild.members.me).has(PermissionsBitField.Flags.SendMessages)
  )
    queue.metadata.channel.send({ embeds: [embed] });
});

player.events.on("emptyChannel", async (queue) => {
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [queue.metadata.guild.id]);
  if (!rows.length) return;
  const t = client.i18next.getFixedT(rows[0].language, "events", "emptyChannel");
  const embed = new EmbedBuilder().setDescription(t("embed.description")).setTitle(t("embed.title")).setColor("Red");
  queue.metadata.channel.send({ embeds: [embed] });
});

player.events.on("emptyQueue", async (queue) => {
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [queue.metadata.guild.id]);
  if (!rows.length) return;
  const t = client.i18next.getFixedT(rows[0].language, "events", "emptyQueue");
  const embed = new EmbedBuilder().setDescription(t("embed.description")).setTitle(t("embed.title")).setColor("Red");
  queue.metadata.channel.send({ embeds: [embed] });
});
await client.login(process.env.TOKEN);

player.events.on("playerError", async (queue, error) => {
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [queue.metadata.guild.id]);
  if (!rows.length) return;
  const t = client.i18next.getFixedT(rows[0].language, "events", "playerError");
  const embed = new EmbedBuilder()
    .setDescription(t("embed.description"))
    .setTitle(t("embed.title"))
    .setColor("Red")
    .addFields([
      {
        name: t("embed.fieldName0"),
        value: error.message,
      },
    ]);
  queue.metadata.channel.send({ embeds: [embed] });
});

CronJob.from({
  cronTime: "*/5 * * * *",
  onTick: () => checkPunishments(client),
  start: true,
  timeZone: "UTC",
});

// Run every minute
CronJob.from({
  cronTime: "* * * * *",
  onTick: async () => await checkExpiredThreads(client),
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
