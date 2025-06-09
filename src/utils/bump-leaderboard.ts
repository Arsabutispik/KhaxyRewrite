import { ChannelType, Client, time, User } from "discord.js";
import { toStringId } from "@utils";
import { getBumpLeaderboard, getGuildConfig } from "@database";

export async function bumpLeaderboard(client: Client, guildId: string, lastBump?: User) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const guild_config = await getGuildConfig(guildId);
  if (!guild_config) return;
  const channel = guild.channels.cache.get(toStringId(guild_config.bump_leaderboard_channel_id));
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const bumps = await getBumpLeaderboard(guildId);
  if (bumps.length === 0) return;
  const leaderboard = bumps
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
      initial += `\n\n${t("last_winner", { user: `<@${guild_config.last_bump_winner}>`, countedBump: guild_config.last_bump_winner_count, totalBumps: guild_config.last_bump_winner_total_count })}`;
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
      initial += `\n\n${t("last_winner", { user: `<@${guild_config.last_bump_winner}>`, countedBump: guild_config.last_bump_winner_count, totalBumps: guild_config.last_bump_winner_total_count })}`;
    }
    await channel.send(initial);
  }
}
