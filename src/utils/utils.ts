import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonComponent,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  Message,
  MessageComponentInteraction,
  MessageFlags,
  TextChannel,
  time,
  User,
} from "discord.js";
import { Bump_leaderboard, Guilds, Mod_mail_messages, Mod_mail_threads } from "../../@types/DatabaseTypes";
import { Buffer } from "node:buffer";
import crypto from "crypto";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import { TFunction } from "i18next";
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
dayjs.extend(duration);
/**
 * Formats a duration in milliseconds to a string.
 * @param ms - The duration in milliseconds.
 * @returns A formatted string representing the duration.
 */
function formatDuration(ms: number): string {
  const d = dayjs.duration(ms);
  const hours = d.hours();
  const minutes = d.minutes().toString().padStart(2, "0");
  const seconds = d.seconds().toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${minutes}:${seconds}` // e.g., 1:02:15
    : `${minutes}:${seconds}`; // e.g., 02:15
}

/**
 * Handles the voting process for a message.
 * @param interaction - The interaction object.
 * @param users - The collection of users who can vote.
 * @param message - The message to be voted on.
 * @returns A boolean indicating whether the voting was successful.
 */
async function vote(
  interaction: ChatInputCommandInteraction<"cached">,
  users: Collection<string, GuildMember>,
  message: Message,
): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const { rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guildId,
    ]);
    const guild_config = rows[0];
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not configured yet.",
        flags: MessageFlags.Ephemeral,
      });
      reject();
    }
    const validButtonIds = ["accept", "reject"];

    let allButtons = message.components
      .filter((rows) => rows.type === ComponentType.ActionRow)
      .flatMap((row) => row.components)
      .filter((comp) => comp.type === ComponentType.Button);

    const buttonIds = allButtons.map((btn) => (btn as ButtonComponent).customId);
    // If buttons are incorrect or missing, auto-generate them
    const needsFixing = buttonIds.length !== 2 || !validButtonIds.every((id) => buttonIds.includes(id));

    if (needsFixing) {
      const acceptButton = new ButtonBuilder()
        .setCustomId("accept")
        .setEmoji(interaction.client.allEmojis.get(interaction.client.config.Emojis.confirm)!.format)
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId("reject")
        .setEmoji(interaction.client.allEmojis.get(interaction.client.config.Emojis.reject)!.format)
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButton, rejectButton);

      await message.edit({ components: [row] });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, null, "vote");
    const totalUsers = users.size;

    let requiredVotes: number;
    if (totalUsers <= 2) {
      // For 1 or 2 people, just 1 vote needed
      requiredVotes = 1;
    } else {
      // Otherwise, 60% rounded up
      requiredVotes = Math.ceil(totalUsers * 0.6);
    }
    let yesVotes = 0;
    let noVotes = 0;
    let votedUsers = 0;
    await message.edit(
      generateVoteEmbed({
        totalUsers: users.size,
        requiredVotes,
        votedUsers,
        yesVotes,
        noVotes,
        t,
      }),
    );
    const data = users.map((user) => ({ id: user.id, voted: false, vote: false }));
    const filter = (i: MessageComponentInteraction) => users.has(i.user.id);
    const collector = message.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 1000 * 60 * 5,
    });
    collector.on("ignore", async (collected) => {
      await collected.reply({ content: t("not_eligible"), flags: MessageFlags.Ephemeral });
    });
    collector.on("collect", async (collected) => {
      const user = users.get(collected.user.id);
      if (!user) return;
      const userVote = data.find((d) => d.id === collected.user.id);
      if (!userVote) return;
      if (userVote.voted) {
        await collected.reply({ content: t("already_voted"), flags: MessageFlags.Ephemeral });
        return;
      }
      if (collected.customId === "accept") {
        userVote.vote = true;
        yesVotes++;
        await collected.reply({ content: t("voted_yes"), flags: MessageFlags.Ephemeral });
      } else if (collected.customId === "reject") {
        userVote.vote = false;
        noVotes++;
        await collected.reply({ content: t("voted_no"), flags: MessageFlags.Ephemeral });
      }
      userVote.voted = true;
      votedUsers++;
      await message.edit(
        generateVoteEmbed({
          totalUsers: users.size,
          requiredVotes,
          votedUsers,
          yesVotes,
          noVotes,
          t,
        }),
      );
      const currentYesVotes = data.filter((d) => d.vote).length;
      if (currentYesVotes >= requiredVotes) {
        collector.stop();
      }
      if (data.every((d) => d.voted)) {
        collector.stop();
      }
    });
    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction.followUp({ content: t("no_votes"), flags: MessageFlags.Ephemeral });
        return;
      }
      const votes = data.filter((d) => d.voted);
      const yesVotes = votes.filter((d) => d.vote).length;
      resolve(yesVotes >= requiredVotes);
    });
  });
}
function generateVoteEmbed({
  totalUsers,
  requiredVotes,
  votedUsers,
  yesVotes,
  noVotes,
  t,
}: {
  totalUsers: number;
  requiredVotes: number;
  votedUsers: number;
  yesVotes: number;
  noVotes: number;
  t: TFunction;
}) {
  return {
    embeds: [
      {
        title: t("embed.title"),
        description: t("embed.description", {
          totalUsers,
          requiredVotes,
          votedUsers,
          yesVotes,
          noVotes,
        }),
        color: 0x00b0f4,
        fields: [
          { name: t("embed.fields.yes"), value: `${yesVotes}`, inline: true },
          { name: t("embed.fields.no"), value: `${noVotes}`, inline: true },
          { name: t("embed.fields.voted"), value: `${votedUsers}/${totalUsers}`, inline: true },
          { name: t("embed.fields.required"), value: `${requiredVotes}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
/**
 * Paginates through a list of embeds with buttons for navigation.
 * @param message - The interaction message to reply to.
 * @param pages - An array of EmbedBuilder objects to paginate through.
 * @param timeout - The time in milliseconds before the pagination times out (default is 60000ms).
 */
async function paginate(
  message: ChatInputCommandInteraction<"cached">,
  pages: EmbedBuilder[],
  timeout: number = 60000,
) {
  if (!message) throw new Error("Channel is inaccessible.");
  if (!pages) throw new Error("Pages are not given.");
  const nextPage = new ButtonBuilder()
    .setCustomId("next")
    .setEmoji("▶️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const prevPage = new ButtonBuilder()
    .setCustomId("prev")
    .setEmoji("◀️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const lastPage = new ButtonBuilder()
    .setCustomId("last")
    .setEmoji("⏩")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const firstPage = new ButtonBuilder()
    .setCustomId("first")
    .setEmoji("⏪")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false);
  const closePage = new ButtonBuilder()
    .setCustomId("close")
    .setEmoji("✖️")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(false);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([lastPage, nextPage, closePage, prevPage, firstPage]);
  let page = 0;
  await message.reply({
    embeds: [pages[page]],
    components: [row],
  });
  const currPage = await message.fetchReply();
  const filter = (button: ButtonInteraction) =>
    button.user.id === message.user.id &&
    (button.customId === "next" ||
      button.customId === "prev" ||
      button.customId === "close" ||
      button.customId === "first" ||
      button.customId === "last");
  const collector = currPage.createMessageComponentCollector({
    filter,
    time: timeout,
    componentType: ComponentType.Button,
  });
  collector.on("collect", async (button) => {
    if (button.customId === "close") return collector.stop();
    if (button.customId === "prev") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = page > 0 ? --page : pages.length - 1;
    } else if (button.customId === "next") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = page + 1 < pages.length ? ++page : 0;
    } else if (button.customId === "first") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = 0;
    } else if (button.customId === "last") {
      if (pages.length < 2) {
        await button.reply({ content: "No page available", flags: MessageFlags.Ephemeral });
        return;
      }
      page = pages.length - 1;
    }
    await currPage.edit({
      embeds: [pages[page]],
      components: [row],
    });
  });
  collector.on("end", async () => {
    await currPage.edit({ components: [] });
  });
}

export {
  sleep,
  missingPermissionsAsString,
  replacePlaceholders,
  toStringId,
  modMailLog,
  bumpLeaderboard,
  formatDuration,
  vote,
  paginate,
};
