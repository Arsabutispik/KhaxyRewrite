//TODO: Handle emojis
import { Client, Collection, EmbedBuilder, IntentsBitField, Partials, PermissionsBitField } from "discord.js";
import "dotenv/config.js";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { RegisterSlashCommands } from "./utils/registry.js";
import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import pg from "pg";
import logger from "./lib/Logger.js";
import { Player } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import process from "node:process";
import { CronJob } from "cron";
import checkPunishments from "./utils/checkPunishments.js";
import listenForNotifications from "./utils/listenForNotifications.js";
import recoverMissedCronjob from "./utils/recoverMissedCronjob.js";

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
  const { rows } = (await client.pgClient.query("SELECT language FROM guilds WHERE id = $1", [
    queue.metadata.guild.id,
  ])) as { rows: { language: string }[] };
  const t = client.i18next.getFixedT(rows[0].language);
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
  const { rows } = (await client.pgClient.query("SELECT language FROM guilds WHERE id = $1", [
    queue.metadata.guild.id,
  ])) as { rows: { language: string }[] };
  const t = client.i18next.getFixedT(rows[0].language);
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
await listenForNotifications(client);
async function closeExpiredThreads() {
  try {
    await pgClient.query(
      `UPDATE mod_mail_threads 
       SET status = 'closed', closed_at = NOW()
       WHERE close_date <= NOW() AND status != 'closed';`,
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
  cronTime: "* * * * *",
  onTick: async () => await recoverMissedCronjob(client),
  start: true,
  timeZone: "UTC",
});
