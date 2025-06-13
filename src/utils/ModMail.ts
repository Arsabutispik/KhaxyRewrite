import { AttachmentBuilder, ChannelType, Client, TextChannel, User } from "discord.js";
import { toStringId } from "@utils";
import dayjs from "dayjs";
import { getGuildConfig, getModMailMessages, getModMailThreads } from "@database";

/**
 * Logs mod mail messages to a specified channel.
 * @param client - The Discord client instance.
 * @param channel - The channel where the mod mail is being sent.
 * @param user - The user who sent the mod mail.
 * @param closer - The user who closed the mod mail thread.
 */
export async function modMailLog(client: Client, channel: TextChannel, user: User | null, closer: User) {
  const guild_data = await getGuildConfig(channel.guildId);
  if (!guild_data) return;
  const t = client.i18next.getFixedT(guild_data.language, null, "mod_mail_log");
  if (!user) return;
  const mod_mail_log_channel = channel.guild.channels.cache.get(toStringId(guild_data.mod_mail_channel_id));
  if (!mod_mail_log_channel) return;
  if (mod_mail_log_channel.type !== ChannelType.GuildText) return;
  const mod_mail_messages = await getModMailMessages(channel.id);
  if (!mod_mail_messages) return;
  const threads = await getModMailThreads(channel.guildId);
  let messages: string[] = [
    t("initial", {
      thread_id: threads.length,
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
      thread_id: threads.length,
      user,
      closer,
      messages: thread_messages,
    }),
    allowedMentions: { parse: [] },
    files: [attachment],
  });
}
