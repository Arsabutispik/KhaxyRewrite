import {Client, Collection, IntentsBitField} from "discord.js";
import {KhaxyClient} from "../@types/types";
import 'dotenv/config.js';
import path from "path";
import fs from "fs";
import {fileURLToPath, pathToFileURL} from "url";
import {RegisterSlashCommands} from "./utils/registry.js";
import i18next from "i18next";
import FsBackend from "i18next-fs-backend";
import pg from "pg"
import {CronJob} from "cron";
import colorOfTheDay from "./utils/colorOfTheDay.js";
import {log} from "./utils/utils.js";
const { Client: PgClient } = pg
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildModeration,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.DirectMessages,
    ]
}) as KhaxyClient

const pgClient = new PgClient({
  user: "postgres",
    password: "54465446",
    host: "host.docker.internal",
    port: 5432,
    database: "postgres"
});
(async () => {
    await pgClient.connect();
    const res = await pgClient.query('SELECT $1::text as connected', ['Connection to postgres successful!']);
    console.log(res.rows[0].connected);
})();

i18next.use(FsBackend).init({
    initAsync: false,
    lng: 'en',
    fallbackLng: 'en',
    preload: ['en', 'tr'],
    ns: ['translation', 'events'],
    defaultNS: 'translation',
    backend: {
        loadPath: 'locales/{{lng}}/{{ns}}.json'
    }
}, (err) => {
    if (err) return console.error(err)
    console.log('i18next is ready...')
    client.i18next = i18next;
});
client.slashCommands = new Collection();
client.pgClient = pgClient;
await RegisterSlashCommands(client);
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = (await import(pathToFileURL(filePath).href)).default;
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

CronJob.from({
    cronTime: '0 0 0 * * *',
    onTick: () => colorOfTheDay(client),
    onComplete: () => log("INFO", "src/index.ts", "Color of the day cronjob has been completed."),
    start: true,
    timeZone: 'UTC'
})

await client.login(process.env.TOKEN);