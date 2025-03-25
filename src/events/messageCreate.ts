import { EventBase, KhaxyClient } from "../../@types/types";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ChannelType,
  ComponentType,
  Events,
  Message,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  ButtonStyle,
  EmbedBuilder,
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
      const hasOpenThread = rows.some((thread) => thread.status === "open");
      if (rows.length === 0 || !hasOpenThread) {
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
        if (shared_guilds.size === 1) {
          const guild = shared_guilds.first()!;
          const { rows: guild_data } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
            guild.id,
          ]);
          if (!guild_data.length) return message.reply("The server data is unavailable.");
          const t = client.i18next.getFixedT(guild_data[0].language, "events", "messageCreate.mod_mail");
          const member = await guild.members.fetch(message.author.id).catch(() => null);
          if (!member) return message.reply(t("not_member"));

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("modmail_confirm").setLabel(t("confirm")).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("modmail_cancel").setLabel(t("cancel")).setStyle(ButtonStyle.Danger),
          );
          const confirm_embed = new EmbedBuilder()
            .setTitle(t("confirm_title"))
            .setDescription(t("confirm_description", { guild: guild.name }))
            .setColor("Blurple");
          const prompt = await message.reply({
            embeds: [confirm_embed],
            components: [row],
          });
          let confirmation;
          try {
            confirmation = await prompt.awaitMessageComponent({
              filter: (interaction) => interaction.user.id === message.author.id,
              time: 30000,
              componentType: ComponentType.Button,
            });
          } catch {
            await prompt.edit({ content: t("timeout"), components: [], embeds: [] });
            return;
          }
          confirmation.deferUpdate();
          if (confirmation.customId === "modmail_cancel") {
            const cancel_embed = new EmbedBuilder()
              .setTitle(t("cancelled_title"))
              .setDescription(t("cancelled_description", { guild: guild.name }))
              .setColor("Red");
            await prompt.edit({ embeds: [cancel_embed], components: [] });
            return;
          }
          const confirmed_embed = new EmbedBuilder()
            .setTitle(t("confirmed_title"))
            .setDescription(t("confirmed_description", { guild: guild.name }))
            .setColor("Green");
          const mod_mail_parent_channel = guild.channels.cache.get(
            toStringId(guild_data[0].mod_mail_parent_channel_id),
          );
          if (!mod_mail_parent_channel) return message.reply(t("parent_channel_missing"));

          const mod_mail_channel = guild.channels.cache.get(toStringId(guild_data[0].mod_mail_channel_id));
          if (!mod_mail_channel) return message.reply(t("channel_missing"));

          const permission_overwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }];

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
            topic: t("topic", { user: message.author.tag }),
            permissionOverwrites: permission_overwrites,
          });
          dayjs.extend(relativeTime);

          let bot_message;
          try {
            bot_message = await channel.send(
              t("initial", {
                user: message.author,
                account_age: dayjs(message.author.createdAt).fromNow(),
                join_date: dayjs(member.joinedAt).fromNow(),
              }),
            );
          } catch {
            return message.reply(t("error_sending"));
          }

          let thread_rows;
          try {
            thread_rows = await client.pgClient.query<Mod_mail_threads>(
              `INSERT INTO mod_mail_threads (thread_id, channel_id, guild_id, user_id, status, created_at)
               SELECT COALESCE((SELECT MAX(thread_id) FROM mod_mail_threads WHERE guild_id = $2), 0) + 1, $1, $2, $3, $4, $5
               RETURNING thread_id;`,
              [channel.id, guild.id, message.author.id, "open", new Date().toISOString()],
            );
          } catch (e) {
            logger.error({ message: "Error inserting mod mail thread", error: e });
            return message.reply(t("error_inserting"));
          }

          try {
            await client.pgClient.query(
              "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
              [
                message.author.id,
                new Date().toISOString(),
                "user",
                message.content,
                message.attachments?.map((a) => a.url),
                thread_rows.rows[0].thread_id,
                "thread",
                channel.id,
              ],
            );

            await client.pgClient.query(
              "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
              [
                client.user!.id,
                new Date().toISOString(),
                "client",
                bot_message.content,
                bot_message.attachments?.map((a) => a.url),
                thread_rows.rows[0].thread_id,
                "thread",
                channel.id,
              ],
            );
          } catch (e) {
            logger.error({ message: "Error inserting mod mail message", error: e });
            return message.reply(t("error_inserting"));
          }
          await prompt.edit({ content: guild_data[0].mod_mail_message, embeds: [confirmed_embed], components: [] });
          await channel.send(
            `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((a) => a.url).join("\n")}`,
          );
          await channel.send(
            `${client.allEmojis.get(client.config.Emojis.gearSpinning)?.format} **(${client.user!.username})** ${guild_data[0].mod_mail_message}`,
          );
          return;
        }
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
        message_component.deferUpdate();
        const guild_id = message_component.values[0];
        const guild = client.guilds.cache.get(guild_id);
        if (!guild) {
          message_component.editReply({ content: "The server you selected is not available", components: [] });
          return;
        }
        const { rows: guild_data } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
          guild_id,
        ]);
        if (!guild_data.length) {
          message_component.editReply({ content: "The server you selected is not available", components: [] });
          return;
        }
        const t = client.i18next.getFixedT(guild_data[0].language, "events", "messageCreate.mod_mail");
        let member;
        try {
          member = await guild.members.fetch(message.author.id);
        } catch {
          message_component.editReply({ content: t("not_member"), components: [] });
          return;
        }
        if (!member) {
          message_component.editReply({ content: t("not_member"), components: [] });
          return;
        }
        const mod_mail_parent_channel = guild.channels.cache.get(toStringId(guild_data[0].mod_mail_parent_channel_id));
        if (!mod_mail_parent_channel) {
          message_component.editReply({ content: t("parent_channel_missing"), components: [] });
          return;
        }
        const mod_mail_channel = guild.channels.cache.get(toStringId(guild_data[0].mod_mail_channel_id));
        if (!mod_mail_channel) {
          message_component.editReply({ content: t("channel_missing"), components: [] });
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
          topic: t("topic", { user: message.author.tag }),
          permissionOverwrites: permission_overwrites,
        });
        dayjs.extend(relativeTime);
        let bot_message;
        try {
          bot_message = await channel.send(
            t("initial", {
              user: message.author,
              account_age: dayjs(message.author.createdAt).fromNow(),
              join_date: dayjs(member.joinedAt).fromNow(),
            }),
          );
        } catch {
          message_component.editReply({
            content: t("error_sending"),
            components: [],
          });
          return;
        }
        let thread_rows;
        try {
          thread_rows = await client.pgClient.query<Mod_mail_threads>(
            `INSERT INTO mod_mail_threads (thread_id, channel_id, guild_id, user_id, status, created_at) 
            SELECT COALESCE((SELECT MAX(thread_id) FROM mod_mail_threads WHERE guild_id = $2), 0) + 1, $1, $2, $3, $4, $5 RETURNING thread_id;`,
            [channel.id, guild.id, message.author.id, "open", new Date().toISOString()],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail thread",
            error: e,
          });
          message_component.editReply({ content: t("error_inserting"), components: [] });
          return;
        }
        message_component.editReply({ content: guild_data[0].mod_mail_message, components: [] });
        await channel.send(
          `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((attachment) => attachment.url).join("\n")}`,
        );
        try {
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [
              message.author.id,
              new Date().toISOString(),
              "user",
              message.content,
              message.attachments?.map((attachment) => attachment.url),
              thread_rows.rows[0].thread_id,
              "thread",
              channel.id,
            ],
          );
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [
              client.user!.id,
              new Date().toISOString(),
              "client",
              bot_message.content,
              bot_message.attachments?.map((attachment) => attachment.url),
              thread_rows.rows[0].thread_id,
              "thread",
              channel.id,
            ],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail message",
            error: e,
          });
          message_component.followUp({ content: t("error_inserting"), components: [] });
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
        const { rows: guild_data } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
          guild.id,
        ]);
        if (!guild_data.length) {
          return await message.reply("The server data is unavailable.");
        }
        const t = client.i18next.getFixedT(guild_data[0].language, "events", "messageCreate.mod_mail");
        try {
          await channel.send(
            `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((attachment) => attachment.url).join("\n")}`,
          );
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [
              message.author.id,
              new Date().toISOString(),
              "user",
              message.content,
              message.attachments?.map((attachment) => attachment.url),
              rows[0].thread_id,
              "thread",
              channel.id,
            ],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail message",
            error: e,
          });
          return await message.reply(t("error_inserting"));
        }
        await message.react(client.allEmojis.get(client.config.Emojis.confirm)!.format);
      }
    } else if (message.channel.type === ChannelType.GuildText) {
      const client = message.client as KhaxyClient;
      const { rows: guild_rows } = await client.pgClient.query<Guilds>("SELECT language FROM guilds WHERE id = $1", [
        message.guild!.id,
      ]);
      if (!guild_rows.length) {
        return await message.reply("This server is not in the database.");
      }
      const t = client.i18next.getFixedT(guild_rows[0].language, "events", "messageCreate.mod_mail");
      const { rows } = await client.pgClient.query<Mod_mail_threads>(
        "SELECT * FROM mod_mail_threads WHERE channel_id = $1",
        [message.channel.id],
      );
      if (!rows[0]) return;
      try {
        await client.pgClient.query(
          "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [
            message.author.id,
            new Date().toISOString(),
            message.author.bot ? "client" : "staff",
            message.content,
            message.attachments?.map((attachment) => attachment.url),
            rows[0].thread_id,
            "thread",
            message.channel.id,
          ],
        );
      } catch (e) {
        logger.error({
          message: "Error upon inserting mod mail message",
          error: e,
        });
        return await message.reply(t("error_inserting"));
      }
    }
  },
} as EventBase;
