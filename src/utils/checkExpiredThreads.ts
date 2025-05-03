import { ChannelType, Client } from "discord.js";
import { Guilds, Mod_mail_threads } from "../../@types/DatabaseTypes";
import { modMailLog, toStringId } from "./utils.js";

export default async function checkPunishments(client: Client) {
  const { rows } = await client.pgClient.query<Mod_mail_threads>(
    "UPDATE mod_mail_threads SET status = 'closed' WHERE close_date < NOW() AND status <> 'closed' RETURNING *",
  );
  for (const row of rows) {
    const guild = client.guilds.cache.get(toStringId(row.guild_id));
    if (!guild) continue;
    const { rows: guild_rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      row.guild_id,
    ]);
    const guild_data = guild_rows[0];
    if (!guild_data) continue;
    const channel = guild.channels.cache.get(toStringId(row.channel_id));
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    const t = client.i18next.getFixedT(guild_data.language, null, "mod_mail_log");
    await channel.send(t("preparing_close"));
    const user = await client.users.fetch(toStringId(row.user_id)).catch(() => null);
    if (!user) continue;
    await user.send(t("thread_closed_dm", { guild: guild.name }));
    const closer = await client.users.fetch(toStringId(row.closer_id));
    await modMailLog(client, channel, user, closer);
  }
}
