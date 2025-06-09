import { EventBase } from "@customTypes";
import { ChannelType, Events } from "discord.js";
import { toStringId } from "@utils";
import { getModMailThreadByUser } from "@database";
import { ModMailThreadStatus } from "@constants";

export default {
  name: Events.TypingStart,
  async execute(typing) {
    const client = typing.client;
    if (typing.channel.type === ChannelType.DM) {
      const thread = await getModMailThreadByUser(typing.user.id, ModMailThreadStatus.OPEN);
      if (!thread) return;
      const guild = client.guilds.cache.get(toStringId(thread.guild_id));
      if (!guild) return;
      const channel = guild.channels.cache.get(toStringId(thread.channel_id));
      if (!channel) return;
      if (channel.type !== ChannelType.GuildText) return;
      if (channel.isThread()) return;
      await channel.sendTyping();
    }
  },
} satisfies EventBase<Events.TypingStart>;
