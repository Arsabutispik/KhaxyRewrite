import { EventBase, KhaxyClient } from "../../@types/types";
import { ChannelType, Events, Typing } from "discord.js";
import { Mod_mail_threads } from "../../@types/DatabaseTypes";
import { toStringId } from "../utils/utils.js";

export default {
  name: Events.TypingStart,
  once: false,
  async execute(typing: Typing) {
    const client = typing.client as KhaxyClient;
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
      channel.sendTyping();
    }
  },
} as EventBase;
