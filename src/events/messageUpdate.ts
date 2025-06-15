import { EventBase } from "@customTypes";
import { Events } from "discord.js";
import { getGuildConfig, getModMailThreadByUser, updateModMailMessage } from "@database";
import { ModMailThreadStatus } from "@constants";
import { toStringId } from "@utils";

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (oldMessage.content !== newMessage.content && !oldMessage.inGuild()) {
      if (oldMessage.partial) oldMessage = await oldMessage.fetch();
      if (oldMessage.author.bot) return;
      const thread = await getModMailThreadByUser(oldMessage.author.id, ModMailThreadStatus.OPEN);
      if (!thread) return;
      const guild = newMessage.client.guilds.cache.get(toStringId(thread.guild_id));
      if (!guild) return;
      const channel = await guild.channels.fetch(toStringId(thread.channel_id)).catch(() => null);
      if (!channel || !channel.isTextBased()) return;
      const guild_config = await getGuildConfig(toStringId(thread.guild_id));
      if (!guild_config) return;
      const t = oldMessage.client.i18next.getFixedT(guild_config.language, "events", "messageUpdate");
      await channel.send(
        t("message_edit", {
          oldContent: oldMessage.content,
          newContent: newMessage.content,
        }),
      );
      const confirmEmoji = newMessage.client.allEmojis.get(newMessage.client.config.Emojis.confirm);
      newMessage.reactions.cache
        .get(confirmEmoji!.id || confirmEmoji!.format)
        ?.users?.remove(newMessage.client.user.id);
      await newMessage.react(newMessage.client.allEmojis.get(newMessage.client.config.Emojis.edit)!.format);
      await updateModMailMessage(oldMessage.id, {
        content: `**${t("message_edit", {
          oldContent: oldMessage.content,
          newContent: newMessage.content,
        })}**`,
      });
    }
  },
} satisfies EventBase<Events.MessageUpdate>;
