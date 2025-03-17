import { KhaxyClient } from "../../@types/types";
import { ChannelType, TextChannel, User } from "discord.js";
import { Guilds } from "../../@types/DatabaseTypes";

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
 * @param client - KhaxyClient instance
 * @param missing - Array of missing permissions
 * @param language - The language code
 * @returns A string of missing permissions in a human-readable format.
 */
function missingPermissionsAsString(client: KhaxyClient, missing: string[], language: string) {
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

async function modMailLog(client: KhaxyClient, channel: TextChannel, user: User) {
  const { rows: guild_rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
    channel.guild.id,
  ]);
  if (guild_rows.length === 0) return;
  const mod_mail_log_channel = channel.guild.channels.cache.get(toStringId(guild_rows[0].mod_mail_channel_id));
  if (!mod_mail_log_channel) return;
  if (mod_mail_log_channel.type !== ChannelType.GuildText) return;
  mod_mail_log_channel.send({
    content: `Mod mail thread with ${user.tag} (${user.id}) was closed.`,
    allowedMentions: { parse: [] },
  });
}

export { sleep, missingPermissionsAsString, replacePlaceholders, toStringId, modMailLog };
