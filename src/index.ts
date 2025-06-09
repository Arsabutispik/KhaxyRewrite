import { Client, Collection, EmbedBuilder, GatewayIntentBits, Partials, PermissionsBitField } from "discord.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import i18next, { initI18n } from "./i18n/index.js";
import { logger } from "@lib";
import { Player } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { SoundcloudExtractor } from "discord-player-soundcloud";
import process from "node:process";
import { CronJob } from "cron";
import { checkPunishments, colorUpdate, checkExpiredThreads, RegisterSlashCommands } from "@utils";
import { getGuildConfig } from "@database";

dotenv.config();
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
await initI18n();
client.i18next = i18next;
const player = new Player(client);
await player.extractors.register(YoutubeiExtractor, {
  streamOptions: {
    useClient: "WEB_EMBEDDED",
  },
  generateWithPoToken: true,
});
await player.extractors.register(SoundcloudExtractor, {});
client.slashCommands = new Collection();
client.allEmojis = new Collection();
client.config = (await import("@lib")).Config;
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
  const guild_config = await getGuildConfig(queue.guild.id);
  if (!guild_config) return;
  const t = client.i18next.getFixedT(guild_config.language);
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
  const guild_config = await getGuildConfig(queue.guild.id);
  if (!guild_config) return;
  const t = client.i18next.getFixedT(guild_config.language, "events", "emptyChannel");
  const embed = new EmbedBuilder().setDescription(t("embed.description")).setTitle(t("embed.title")).setColor("Red");
  queue.metadata.channel.send({ embeds: [embed] });
});

player.events.on("emptyQueue", async (queue) => {
  const guild_config = await getGuildConfig(queue.guild.id);
  if (!guild_config) return;
  const t = client.i18next.getFixedT(guild_config.language, "events", "emptyQueue");
  const embed = new EmbedBuilder().setDescription(t("embed.description")).setTitle(t("embed.title")).setColor("Red");
  queue.metadata.channel.send({ embeds: [embed] });
});
await client.login(process.env.TOKEN);

player.events.on("playerError", async (queue, error) => {
  const guild_config = await getGuildConfig(queue.guild.id);
  if (!guild_config) return;
  const t = client.i18next.getFixedT(guild_config.language, "events", "playerError");
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
  onTick: () => colorUpdate(client),
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
