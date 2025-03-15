import { KhaxyClient } from "../../@types/types";
import logger from "../lib/Logger.js";
import { TextChannel } from "discord.js";
import { Guilds } from "../../@types/DatabaseTypes";

// Function to listen for notifications from PostgreSQL
export default async function listenForNotifications(client: KhaxyClient) {
  logger.info({
    message: "Listening for database notifications...",
    discord: false,
  });

  // Listen for PostgreSQL notifications
  await client.pgClient.query("LISTEN thread_closed");

  client.pgClient.on("notification", async (msg) => {
    if (msg.channel !== "thread_closed") return;
    try {
      // Parse payload with a custom reviver for BigInt handling
      const payload = JSON.parse(msg.payload as string, (_key, value) => {
        // Convert strings of large numbers into BigInt
        if (typeof value === "string" && !isNaN(Number(value)) && value.length > 15) {
          return BigInt(value); // Safely convert the large number (as string) to BigInt
        }
        return value; // Return other values as they are
      });
      await threadClosed(client, payload);
    } catch (error) {
      logger.error("Failed to process thread_closed notification", error);
    }
  });
}

// Function to handle thread closure logic
async function threadClosed(client: KhaxyClient, payload: { thread_id: bigint; user_id: bigint; guild_id: bigint }) {
  const guild = client.guilds.cache.get(payload.guild_id.toString()); // Convert BigInt to string
  if (!guild) return;

  const { rows } = await client.pgClient.query<Guilds>("SELECT language FROM guilds WHERE id = $1", [guild.id]);
  const t = client.i18next.getFixedT(rows[0].language, null, "listen_for_notifications");

  const thread = guild.channels.cache.get(payload.thread_id.toString()) as TextChannel; // Convert BigInt to string
  if (!thread) return;

  let user;
  try {
    user = await client.users.fetch(payload.user_id.toString()); // Convert BigInt to string
  } catch {
    user = null;
  }

  await thread.send({ content: t("preparing_close") });
  if (user) {
    await user.send({ content: t("thread_closed_dm", { guild: guild.name }) });
  }

  try {
    await thread.delete();
  } catch {
    await thread.send({ content: t("could_not_close") });
  }
}
