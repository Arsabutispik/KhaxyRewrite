import { AttachmentBuilder, ChannelType, Client, TextChannel, time, User } from "discord.js";
import { Client as PgClient } from "pg";
import { Bump_leaderboard, Guilds, Mod_mail_messages } from "../../@types/DatabaseTypes";
import { Buffer } from "node:buffer";
import crypto from "crypto";
import dayjs from "dayjs";
import process from "node:process";
/**
 * Pauses execution for a specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified time.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Replaces placeholders in a string with the values from an object.
 * @param template - The string with placeholders.
 * @param replacements - The object with the values to replace.
 * @returns The string with the placeholders replaced.
 */
function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{(\w+)}/g, (match, key) => {
    return key in replacements ? replacements[key] : match;
  });
}

/**
 * Returns a string of missing permissions in a human-readable format.
 * @param client - Client instance
 * @param missing - Array of missing permissions
 * @param language - The language code
 * @returns A string of missing permissions in a human-readable format.
 */
function missingPermissionsAsString(client: Client, missing: string[], language: string) {
  const t = client.i18next.getFixedT(language);
  return missing.map((perm) => t(`permissions:${perm}`)).join(", ");
}
/**
 * Converts a bigint or string to a string.
 * @param id - The bigint or string to convert.
 * @returns The string representation of the bigint or string.
 */
function toStringId(id: bigint | string | null): string | "0" {
  if (!id) return "0";
  return id.toString();
}

async function modMailLog(client: Client, channel: TextChannel, user: User | null, closer: User) {
  const { rows: guild_rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
    channel.guild.id,
  ]);
  if (guild_rows.length === 0) return;
  const t = client.i18next.getFixedT(guild_rows[0].language, null, "mod_mail_log");
  if (!user) return;
  const mod_mail_log_channel = channel.guild.channels.cache.get(toStringId(guild_rows[0].mod_mail_channel_id));
  if (!mod_mail_log_channel) return;
  if (mod_mail_log_channel.type !== ChannelType.GuildText) return;
  const { rows: mod_mail_messages_rows } = await client.pgClient.query<Mod_mail_messages>(
    "SELECT * FROM mod_mail_messages WHERE channel_id = $1",
    [channel.id],
  );
  if (mod_mail_messages_rows.length === 0) return;
  let messages: string[] = [
    t("initial", {
      thread_id: mod_mail_messages_rows[0].thread_id,
      user,
      time: dayjs(mod_mail_messages_rows[0].sent_at),
    }),
  ];
  for (const row of mod_mail_messages_rows) {
    if (row.author_type === "client" && row.sent_to === "thread") {
      messages.push(`[${dayjs(row.sent_at)}] [BOT] ${row.content}`);
    }
    if (row.author_type === "client" && row.sent_to === "user") {
      messages.push(`[${dayjs(row.sent_at)}] ${t("bot_to_user")} ${row.content}`);
    }
    if (row.author_type === "staff" && row.sent_to === "user") {
      const author = await client.users.fetch(toStringId(row.author_id)).catch(() => null);
      messages.push(
        `[${dayjs(row.sent_at)}] ${t("command")} [${author ? author.tag : "Unknown"}] /reply ${row.content}`,
      );
      messages.push(`[${dayjs(row.sent_at)}] ${t("to_user")} [${author ? author.tag : "Unknown"}] ${row.content}`);
    }
    if (row.author_type === "user" && row.sent_to === "thread") {
      messages.push(`[${dayjs(row.sent_at)}] ${t("from_user")} ${row.content}`);
    }
    if (row.author_type === "staff" && row.sent_to === "thread") {
      const author = await client.users.fetch(toStringId(row.author_id)).catch(() => null);
      messages.push(`[${dayjs(row.sent_at)}] ${t("to_thread")} [${author ? author.tag : "Unknown"}] ${row.content}`);
    }
  }
  const buffer = Buffer.from(messages.join("\n"), "utf-8");
  const id = crypto.randomUUID();
  const attachment = new AttachmentBuilder(buffer, { name: id + ".txt" });
  const thread_messages = {
    user: mod_mail_messages_rows.filter((row) => row.author_type === "user" && row.sent_to === "thread").length,
    staff: mod_mail_messages_rows.filter((row) => row.author_type === "staff" && row.sent_to === "user").length,
    internal: mod_mail_messages_rows.filter((row) => row.author_type === "staff" && row.sent_to === "thread").length,
  };
  await mod_mail_log_channel.send({
    content: t("close_message", {
      thread_id: mod_mail_messages_rows[0].thread_id,
      user,
      closer,
      messages: thread_messages,
    }),
    allowedMentions: { parse: [] },
    files: [attachment],
  });
}

async function bumpLeaderboard(client: Client, guildId: string, lastBump?: User) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const guild_config = await client.getGuildConfig(guildId);
  if (!guild_config) return;
  const channel = guild.channels.cache.get(guild_config.bump_leaderboard_channel_id);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const { rows } = await client.pgClient.query<Bump_leaderboard>(
    "SELECT bump_leaderboard.*, pgp_sym_decrypt(user_id, $2) as user_id, pgp_sym_decrypt(bump_count, $2) as bump_count FROM bump_leaderboard WHERE pgp_sym_decrypt(guild_id, $2) = $1",
    [guildId, process.env.PASSPHRASE],
  );
  if (rows.length === 0) return;
  const leaderboard = rows
    .map((row) => ({
      user: row.user_id,
      bump_count: row.bump_count,
    }))
    .sort((a, b) => b.bump_count - a.bump_count)
    .slice(0, 10);
  const messages = await channel.messages.fetch();
  const message = messages.first();
  const t = client.i18next.getFixedT(guild_config.language, null, "bump_leaderboard");
  if (message) {
    if (message.author.id !== client.user?.id) {
      return { error: t("message_not_sent_by_bot") };
    }
    let initial = t("initial");
    let count = 1;
    for (const leader of leaderboard) {
      initial += `\n${count}. <@${leader.user}> - ${leader.bump_count} bumps`;
      count++;
    }
    if (lastBump) {
      initial += `\n${t("last_bump", { user: lastBump.toString(), time: time(new Date(), "R") })}`;
    }
    if (guild_config.last_bump_winner) {
      initial += `\n\n${t("last_winner", { user: `<@${guild_config.last_bump_winner}>`, count: guild_config.last_bump_winner_count, totalBumps: guild_config.last_bump_winner_total_count })}`;
    }
    await message.edit(initial);
  } else {
    let initial = t("initial");
    let count = 1;
    for (const leader of leaderboard) {
      initial += `\n${count}. <@${leader.user}> - ${leader.bump_count} bumps`;
      count++;
    }
    if (lastBump) {
      initial += `\n${t("last_bump", { user: lastBump, time: time(new Date(), "R") })}`;
    }
    if (guild_config.last_bump_winner) {
      initial += `\n\n${t("last_winner", { user: `<@${guild_config.last_bump_winner}>`, count: guild_config.last_bump_winner_count, totalBumps: guild_config.last_bump_winner_total_count })}`;
    }
    await channel.send(initial);
  }
}
async function decryptValue(encryptedValue: string, pgClient: PgClient) {
  try {
    // Execute the decryption query
    const decrypted = await pgClient.query("SELECT pgp_sym_decrypt($1::bytea, $2) AS decrypted", [
      Buffer.from(encryptedValue, "base64"),
      process.env.PASSPHRASE,
    ]);

    // Check if the decryption was successful
    if (decrypted.rows.length === 0 || !decrypted.rows[0].decrypted) {
      console.error("Decryption failed for:", encryptedValue);
      return null; // Decryption failed
    }
    return decrypted.rows[0].decrypted;
  } catch (error) {
    console.error("Error during decryption:", error);
    return null;
  }
}

export {
  sleep,
  missingPermissionsAsString,
  replacePlaceholders,
  toStringId,
  modMailLog,
  bumpLeaderboard,
  decryptValue,
};
