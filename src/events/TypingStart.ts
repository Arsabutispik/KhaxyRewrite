import { EventBase } from "../../@types/types";
import { ChannelType, Events } from "discord.js";
import { Mod_mail_threads } from "../../@types/DatabaseTypes";
import { toStringId } from "../utils/utils.js";

export default {
  name: Events.TypingStart,
  async execute(typing) {
    const client = typing.client;
    if (typing.channel.type === ChannelType.DM) {
      const { rows } = await client.pgClient.query<Mod_mail_threads>(
        "SELECT * FROM mod_mail_threads WHERE user_id = $1 and status = 'open'",
        [typing.user.id],
      );
      if (!rows[0]) return;
      const guild = client.guilds.cache.get(toStringId(rows[0].guild_id));
      if (!guild) return;
      const channel = guild.channels.cache.get(toStringId(rows[0].channel_id));
      if (!channel) return;
      if (channel.type !== ChannelType.GuildText) return;
      if (channel.isThread()) return;
      await channel.sendTyping();
    }
  },
} satisfies EventBase<Events.TypingStart>;
