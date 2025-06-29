import { Client } from "discord.js";
import { getExpiredModmailBlacklists, getGuildConfig, removeExpiredModmailBlacklists } from "@database";
export async function CheckExpiredModMailBlacklists(client: Client) {
  const expired_blacklists = await getExpiredModmailBlacklists();
  if (expired_blacklists.length === 0) return;
  for (const blacklist of expired_blacklists) {
    const guild = client.guilds.cache.get(blacklist.guild_id.toString());
    if (!guild) continue;
    const guild_config = await getGuildConfig(guild.id);
    if (!guild_config) continue;
    const t = client.i18next.getFixedT(guild_config.language, null, "check_expired_modmail_blacklists");
    const user = await guild.members.fetch(blacklist.user_id.toString()).catch(() => null);
    if (!user) continue;

    // Notify the user about the expiration
    await user.send(t("expired_modmail_blacklist_notification", { guild: guild.name })).catch(() => null);
  }
  await removeExpiredModmailBlacklists();
}
