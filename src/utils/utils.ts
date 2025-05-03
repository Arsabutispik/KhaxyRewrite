import { AttachmentBuilder, ChannelType, Client, TextChannel, time, User } from "discord.js";
import { Bump_leaderboard, Guilds, Mod_mail_messages, Mod_mail_threads } from "../../@types/DatabaseTypes";
import { Buffer } from "node:buffer";
import crypto from "crypto";
import dayjs from "dayjs";
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

/**
 * Logs mod mail messages to a specified channel.
 * @param client - The Discord client instance.
 * @param channel - The channel where the mod mail is being sent.
 * @param user - The user who sent the mod mail.
 * @param closer - The user who closed the mod mail thread.
 */
async function modMailLog(client: Client, channel: TextChannel, user: User | null, closer: User) {
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [channel.guild.id]);
  const guild_data = rows[0];
  if (!guild_data) return;
  const t = client.i18next.getFixedT(guild_data.language, null, "mod_mail_log");
  if (!user) return;
  const mod_mail_log_channel = channel.guild.channels.cache.get(toStringId(guild_data.mod_mail_channel_id));
  if (!mod_mail_log_channel) return;
  if (mod_mail_log_channel.type !== ChannelType.GuildText) return;
  const { rows: mod_mail_messages } = await client.pgClient.query<Mod_mail_messages>(
    "SELECT * FROM mod_mail_messages WHERE channel_id = $1",
    [channel.id],
  );
  if (!mod_mail_messages) return;
  const threads = await client.pgClient.query<Mod_mail_threads>(
    "SELECT * FROM mod_mail_threads WHERE mod_mail_threads.guild_id = $1",
    [channel.guild.id],
  );
  let messages: string[] = [
    t("initial", {
      thread_id: threads.rowCount,
      user,
      time: dayjs(mod_mail_messages[0].sent_at),
    }),
  ];
  for (const row of mod_mail_messages) {
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
      messages.push(`[${dayjs(row.sent_at)}] ${t("from_user")} [${user.tag}] ${row.content}`);
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
    user: mod_mail_messages.filter((row) => row.author_type === "user" && row.sent_to === "thread").length,
    staff: mod_mail_messages.filter((row) => row.author_type === "staff" && row.sent_to === "user").length,
    internal: mod_mail_messages.filter((row) => row.author_type === "staff" && row.sent_to === "thread").length,
  };
  await mod_mail_log_channel.send({
    content: t("close_message", {
      thread_id: threads.rowCount,
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
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [guildId]);
  const guild_config = rows[0];
  if (!guild_config) return;
  const channel = guild.channels.cache.get(toStringId(guild_config.bump_leaderboard_channel_id));
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const { rows: bump_rows } = await client.pgClient.query<Bump_leaderboard>(
    "SELECT * FROM bump_leaderboard WHERE guild_id = $1",
    [guildId],
  );
  if (rows.length === 0) return;
  const leaderboard = bump_rows
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

export { sleep, missingPermissionsAsString, replacePlaceholders, toStringId, modMailLog, bumpLeaderboard };
