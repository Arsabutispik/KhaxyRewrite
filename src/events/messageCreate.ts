import { EventBase, KhaxyClient } from "../../@types/types";
import {
  ActionRowBuilder,
  ChannelType,
  ComponentType,
  Events,
  Message,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from "discord.js";
import { Guilds, Mod_mail_threads } from "../../@types/DatabaseTypes";
import dayjs from "dayjs";
import logger from "../lib/Logger.js";
import { toStringId } from "../utils/utils.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message) {
    if (message.author.bot) return;
    if (message.channel.type === ChannelType.DM) {
      const client = message.client as KhaxyClient;
      const { rows } = await client.pgClient.query<Mod_mail_threads>(
        "SELECT * FROM mod_mail_threads WHERE user_id = $1",
        [message.author.id],
      );
      if (!rows[0] || rows[0].status !== "open") {
        const shared_guilds = client.guilds.cache.filter(
          async (guild) =>
            guild.members.cache.has(message.author.id) &&
            guild.channels.cache.get(
              (
                await client.pgClient.query<Guilds>("SELECT mod_mail_channel_id FROM guilds WHERE id = $1", [guild.id])
              ).rows[0].mod_mail_channel_id.toString(),
            ),
        );
        if (shared_guilds.size === 0) return;
        const string_selection = new StringSelectMenuBuilder()
          .setCustomId("guild_selection")
          .setPlaceholder("Select a server to open a mod mail thread")
          .addOptions(
            shared_guilds.map((guild) => ({
              label: guild.name,
              value: guild.id,
            })),
          );
        const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(string_selection);
        const msg = await message.channel.send({
          content: "Select a server to open a mod mail thread",
          components: [action_row],
        });
        let message_component;
        try {
          const filter = (interaction: StringSelectMenuInteraction) =>
            interaction.user.id === message.author.id && interaction.customId === "guild_selection";
          message_component = await msg.awaitMessageComponent({
            filter,
            time: 60000,
            componentType: ComponentType.StringSelect,
          });
        } catch {
          msg.edit({ content: "You took too long to select a server", components: [] });
          return;
        }
        const guild_id = message_component.values[0];
        const guild = client.guilds.cache.get(guild_id);
        if (!guild) {
          msg.edit({ content: "The server you selected is not available", components: [] });
          return;
        }
        let member;
        try {
          member = await guild.members.fetch(message.author.id);
        } catch {
          msg.edit({ content: "You are not a member of the server you selected", components: [] });
          return;
        }
        if (!member) {
          msg.edit({ content: "You are not a member of the server you selected", components: [] });
          return;
        }
        const { rows: guild_data } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
          guild_id,
        ]);
        if (!guild_data.length) {
          msg.edit({ content: "The server you selected is not available", components: [] });
          return;
        }
        const mod_mail_parent_channel = guild.channels.cache.get(toStringId(guild_data[0].mod_mail_parent_channel_id));
        if (!mod_mail_parent_channel) {
          msg.edit({ content: "The server you selected is not available", components: [] });
          return;
        }
        const mod_mail_channel = guild.channels.cache.get(toStringId(guild_data[0].mod_mail_channel_id));
        if (!mod_mail_channel) {
          msg.edit({ content: "The server you selected is not available", components: [] });
          return;
        }
        const permission_overwrites = [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
        ];
        if (guild.roles.cache.has(toStringId(guild_data[0].staff_role_id))) {
          permission_overwrites.push({
            id: toStringId(guild_data[0].staff_role_id)!,
            // @ts-expect-error - This is a valid permission bitfield
            allow: [PermissionsBitField.Flags.ViewChannel],
          });
        }
        const channel = await guild.channels.create({
          name: Math.random().toString(36).slice(2),
          parent: mod_mail_parent_channel.id,
          type: ChannelType.GuildText,
          topic: `Mod mail thread for ${message.author.tag}`,
          permissionOverwrites: permission_overwrites,
        });
        const t = client.i18next.getFixedT(guild_data[0].language, null, "mod_mail");
        let bot_message;
        dayjs.extend(relativeTime);
        try {
          bot_message = await channel.send(
            t("initial", {
              user: message.author,
              account_age: dayjs(message.author.createdAt).fromNow(),
              join_date: dayjs(member.joinedAt).fromNow(),
            }),
          );
        } catch {
          msg.edit({
            content: "Error upon sending message, the bot might not have permissions to send messages",
            components: [],
          });
          return;
        }
        try {
          await client.pgClient.query(
            "INSERT INTO mod_mail_threads (channel_id, guild_id, user_id, thread_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
            [channel.id, guild.id, message.author.id, channel.id, "open", new Date().toISOString()],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail thread",
            error: e,
          });
        }
        msg.edit({ content: "Mod mail thread opened", components: [] });
        await channel.send(
          `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((attachment) => attachment.url).join("\n")}`,
        );
        await message_component.reply(guild_data[0].mod_mail_message);
        try {
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (thread_id, author_id, sent_at, author_type, content) VALUES ($1, $2, $3, $4, $5)",
            [channel.id, client.user!.id, new Date().toISOString(), "client", bot_message.content],
          );
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (thread_id, author_id, sent_at, author_type, content, attachments) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              channel.id,
              message.author.id,
              new Date().toISOString(),
              "user",
              message.content,
              message.attachments?.map((attachment) => attachment.url),
            ],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail message",
            error: e,
          });
        }
      } else {
        const channel = client.channels.cache.get(toStringId(rows[0].channel_id)) as TextChannel;
        if (!channel) return;
        const guild = client.guilds.cache.get(toStringId(rows[0].guild_id));
        if (!guild) return;
        let member;
        try {
          member = await guild.members.fetch(message.author.id);
        } catch {
          return;
        }
        if (!member) return;
        try {
          await channel.send(
            `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((attachment) => attachment.url).join("\n")}`,
          );
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (thread_id, author_id, sent_at, author_type, content, attachments) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              channel.id,
              message.author.id,
              new Date().toISOString(),
              "user",
              message.content,
              message.attachments?.map((attachment) => attachment.url),
            ],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail message",
            error: e,
          });
        }
        await message.react(client.allEmojis.get(client.config.Emojis.confirm)!.format);
      }
    }
  },
} as EventBase;
