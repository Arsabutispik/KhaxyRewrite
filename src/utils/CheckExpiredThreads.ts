import { ChannelType, Client } from "discord.js";
import { modMailLog, toStringId } from "@utils";
import { getExpiredModMailThreads, getGuildConfig } from "@database";

export async function checkExpiredThreads(client: Client) {
  const threads = await getExpiredModMailThreads();
  for (const thread of threads) {
    const guild = client.guilds.cache.get(toStringId(thread.guild_id));
    if (!guild) continue;
    const guild_config = await getGuildConfig(guild.id);
    if (!guild_config) continue;
    const channel = guild.channels.cache.get(toStringId(thread.channel_id));
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    const t = client.i18next.getFixedT(guild_config.language, null, "mod_mail_log");
    await channel.send(t("preparing_close"));
    const user = await client.users.fetch(toStringId(thread.user_id)).catch(() => null);
    if (!user) continue;
    await user.send(t("thread_closed_dm", { guild: guild.name }));
    const closer = await client.users.fetch(toStringId(thread.closer_id));
    await modMailLog(client, channel, user, closer);
  }
}
