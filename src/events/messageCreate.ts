import { EventBase } from "../../@types/types";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ChannelType,
  ComponentType,
  Events,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Bump_leaderboard, Guilds, Mod_mail_threads } from "../../@types/DatabaseTypes";
import dayjs from "dayjs";
import logger from "../lib/Logger.js";
import { bumpLeaderboard, toStringId } from "../utils/utils.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import process from "node:process";
export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.channel.type === ChannelType.DM) {
      if (message.author.bot) return;
      const client = message.client;
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
          const guild_config = await client.getGuildConfig(guild.id);
          if (!guild_config) {
            await message.reply("The server data is unavailable.");
            return;
          }
          const t = client.i18next.getFixedT(guild_config.language, "events", "messageCreate.mod_mail");
          const member = await guild.members.fetch(message.author.id).catch(() => null);
          if (!member) {
            await message.reply(t("not_member"));
            return;
          }

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
          await confirmation.deferUpdate();
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
          const mod_mail_parent_channel = guild.channels.cache.get(toStringId(guild_config.mod_mail_parent_channel_id));
          if (!mod_mail_parent_channel) {
            await message.reply(t("parent_channel_missing"));
            return;
          }

          const mod_mail_channel = guild.channels.cache.get(toStringId(guild_config.mod_mail_channel_id));
          if (!mod_mail_channel) {
            await message.reply(t("channel_missing"));
            return;
          }

          const permission_overwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }];

          if (guild.roles.cache.has(toStringId(guild_config.staff_role_id))) {
            permission_overwrites.push({
              id: toStringId(guild_config.staff_role_id)!,
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
            await message.reply(t("error_sending"));
            return;
          }

          let thread_rows;
          try {
            thread_rows = await client.pgClient.query<Mod_mail_threads>(
              "INSERT INTO mod_mail_threads (thread_id, channel_id, guild_id, user_id, status, created_at) VALUES (pgp_sym_encrypt(gen_random_uuid(), $6), pgp_sym_encrypt($1, $6), pgp_sym_encrypt($2, $6), pgp_sym_encrypt($3, $6), pgp_sym_encrypt($4, $6), $5) RETURNING pgp_sym_decrypt(thread_id, $6);",
              [channel.id, guild.id, message.author.id, "open", new Date().toISOString(), process.env.PASSPHRASE],
            );
          } catch (e) {
            logger.error({ message: "Error inserting mod mail thread", error: e });
            await message.reply(t("error_inserting"));
            return;
          }

          try {
            await client.pgClient.query(
              "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES (pgp_sym_encrypt($1, $9), $2, pgp_sym_encrypt($3, $9), pgp_sym_encrypt($4, $9), pgp_sym_encrypt($5, $9), pgp_sym_encrypt($6::text, $9), pgp_sym_encrypt($7, $9), pgp_sym_encrypt($8, $9))",
              [
                message.author.id,
                new Date().toISOString(),
                "user",
                message.content,
                message.attachments?.map((a) => a.url),
                thread_rows.rows[0].thread_id,
                "thread",
                channel.id,
                process.env.PASSPHRASE,
              ],
            );
            await client.pgClient.query(
              "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES (pgp_sym_encrypt($1, $9), $2, pgp_sym_encrypt($3, $9), pgp_sym_encrypt($4, $9), pgp_sym_encrypt($5, $9), pgp_sym_encrypt($6::text, $9), pgp_sym_encrypt($7, $9), pgp_sym_encrypt($8, $9))",
              [
                client.user!.id,
                new Date().toISOString(),
                "client",
                bot_message.content,
                bot_message.attachments?.map((a) => a.url),
                thread_rows.rows[0].thread_id,
                "thread",
                channel.id,
                process.env.PASSPHRASE,
              ],
            );
          } catch (e) {
            logger.error({ message: "Error inserting mod mail message", error: e });
            await message.reply(t("error_inserting"));
            return;
          }
          await prompt.edit({ content: guild_config.mod_mail_message, embeds: [confirmed_embed], components: [] });
          await channel.send(
            `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((a) => a.url).join("\n")}`,
          );
          await channel.send(
            `${client.allEmojis.get(client.config.Emojis.gearSpinning)?.format} **(${client.user!.username})** ${guild_config.mod_mail_message}`,
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
          await msg.edit({ content: "You took too long to select a server", components: [] });
          return;
        }
        await message_component.deferUpdate();
        const guild_id = message_component.values[0];
        const guild = client.guilds.cache.get(guild_id);
        if (!guild) {
          await message_component.editReply({ content: "The server you selected is not available", components: [] });
          return;
        }
        const guild_config = await client.getGuildConfig(guild_id);
        if (!guild_config) {
          await message_component.editReply({ content: "The server you selected is not available", components: [] });
          return;
        }
        const t = client.i18next.getFixedT(guild_config.language, "events", "messageCreate.mod_mail");
        let member;
        try {
          member = await guild.members.fetch(message.author.id);
        } catch {
          await message_component.editReply({ content: t("not_member"), components: [] });
          return;
        }
        if (!member) {
          await message_component.editReply({ content: t("not_member"), components: [] });
          return;
        }
        const mod_mail_parent_channel = guild.channels.cache.get(toStringId(guild_config.mod_mail_parent_channel_id));
        if (!mod_mail_parent_channel) {
          await message_component.editReply({ content: t("parent_channel_missing"), components: [] });
          return;
        }
        const mod_mail_channel = guild.channels.cache.get(toStringId(guild_config.mod_mail_channel_id));
        if (!mod_mail_channel) {
          await message_component.editReply({ content: t("channel_missing"), components: [] });
          return;
        }
        const permission_overwrites = [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
        ];
        if (guild.roles.cache.has(toStringId(guild_config.staff_role_id))) {
          permission_overwrites.push({
            id: toStringId(guild_config.staff_role_id)!,
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
          await message_component.editReply({
            content: t("error_sending"),
            components: [],
          });
          return;
        }
        let thread_rows;
        try {
          thread_rows = await client.pgClient.query<Mod_mail_threads>(
            "INSERT INTO mod_mail_threads (thread_id, channel_id, guild_id, user_id, status, created_at) VALUES (pgp_sym_encrypt(gen_random_uuid(), $6), pgp_sym_encrypt($1, $6), pgp_sym_encrypt($2, $6), pgp_sym_encrypt($3, $6), pgp_sym_encrypt($4, $6), $5) RETURNING pgp_sym_decrypt(thread_id, $6);",
            [channel.id, guild.id, message.author.id, "open", new Date().toISOString(), process.env.PASSPHRASE],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail thread",
            error: e,
          });
          await message_component.editReply({ content: t("error_inserting"), components: [] });
          return;
        }
        await message_component.editReply({ content: guild_config.mod_mail_message, components: [] });
        await channel.send(
          `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((attachment) => attachment.url).join("\n")}`,
        );
        try {
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES (pgp_sym_encrypt($1, $9), $2, pgp_sym_encrypt($3, $9), pgp_sym_encrypt($4, $9), pgp_sym_encrypt($5, $9), pgp_sym_encrypt($6::text, $9), pgp_sym_encrypt($7, $9), pgp_sym_encrypt($8, $9))",
            [
              message.author.id,
              new Date().toISOString(),
              "user",
              message.content,
              message.attachments?.map((attachment) => attachment.url),
              thread_rows.rows[0].thread_id,
              "thread",
              channel.id,
              process.env.PASSPHRASE,
            ],
          );
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES (pgp_sym_encrypt($1, $9), $2, pgp_sym_encrypt($3, $9), pgp_sym_encrypt($4, $9), pgp_sym_encrypt($5, $9), pgp_sym_encrypt($6::text, $9), pgp_sym_encrypt($7, $9), pgp_sym_encrypt($8, $9))",
            [
              client.user!.id,
              new Date().toISOString(),
              "client",
              bot_message.content,
              bot_message.attachments?.map((attachment) => attachment.url),
              thread_rows.rows[0].thread_id,
              "thread",
              channel.id,
              process.env.PASSPHRASE,
            ],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail message",
            error: e,
          });
          await message_component.followUp({ content: t("error_inserting"), components: [] });
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
        const guild_config = await client.getGuildConfig(guild.id);
        if (!guild_config) {
          await message.reply("The server data is unavailable.");
          return;
        }
        const t = client.i18next.getFixedT(guild_config.language, "events", "messageCreate.mod_mail");
        try {
          await channel.send(
            `**[${message.author.tag}]**: ${message.content}\n${message.attachments?.map((attachment) => attachment.url).join("\n")}`,
          );
          await client.pgClient.query(
            "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES (pgp_sym_encrypt($1, $9), $2, pgp_sym_encrypt($3, $9), pgp_sym_encrypt($4, $9), pgp_sym_encrypt($5, $9), pgp_sym_encrypt($6::text, $9), pgp_sym_encrypt($7, $9), pgp_sym_encrypt($8, $9))",
            [
              message.author.id,
              new Date().toISOString(),
              "user",
              message.content,
              message.attachments?.map((attachment) => attachment.url),
              rows[0].thread_id,
              "thread",
              channel.id,
              process.env.PASSPHRASE,
            ],
          );
        } catch (e) {
          logger.error({
            message: "Error upon inserting mod mail message",
            error: e,
          });
          await message.reply(t("error_inserting"));
          return;
        }
        await message.react(client.allEmojis.get(client.config.Emojis.confirm)!.format);
      }
    } else if (message.inGuild() && message.channel.type === ChannelType.GuildText) {
      if (message.author.bot) return;
      const client = message.client;
      const guild_config = await client.getGuildConfig(message.guild.id);
      if (!guild_config) {
        await message.reply("This server is not in the database.");
        return;
      }
      const t = client.i18next.getFixedT(guild_config.language, "events", "messageCreate.mod_mail");
      const { rows } = await client.pgClient.query<Mod_mail_threads>(
        "SELECT * FROM mod_mail_threads WHERE pgp_sym_decrypt(channel_id, $2) = $1",
        [message.channel.id, process.env.PASSPHRASE],
      );
      if (!rows[0]) return;
      try {
        await client.pgClient.query(
          "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES (pgp_sym_encrypt($1, $9), $2, pgp_sym_encrypt($3, $9), pgp_sym_encrypt($4, $9), pgp_sym_encrypt($5, $9), pgp_sym_encrypt($6::text, $9), pgp_sym_encrypt($7, $9), pgp_sym_encrypt($8, $9))",
          [
            message.author.id,
            new Date().toISOString(),
            message.author.bot ? "client" : "staff",
            message.content,
            message.attachments?.map((attachment) => attachment.url),
            rows[0].thread_id,
            "thread",
            message.channel.id,
            process.env.PASSPHRASE,
          ],
        );
      } catch (e) {
        logger.error({
          message: "Error upon inserting mod mail message",
          error: e,
        });
        await message.reply(t("error_inserting"));
        return;
      }
    }
    if (!message.inGuild()) return;
    const guild_config = await message.client.getGuildConfig(message.guild.id);
    if (!guild_config) return;
    const leaderboard = guild_config.bump_leaderboard_channel_id;
    if (
      message.interaction &&
      message.interaction.commandName === "bump" &&
      message.author.id === "302050872383242240" &&
      message.channel.id === leaderboard
    ) {
      const rows = await message.client.pgClient.query<Bump_leaderboard>(
        "SELECT * FROM bump_leaderboard WHERE pgp_sym_decrypt(guild_id, $3) = $1 AND pgp_sym_decrypt(user_id, $3) = $2",
        [message.guild.id, message.author.id, process.env.PASSPHRASE],
      );
      if (rows.rowCount === 0) {
        await message.client.pgClient.query(
          "INSERT INTO bump_leaderboard (guild_id, user_id, bump_count) VALUES (pgp_sym_encrypt($1, $3), pgp_sym_encrypt($2, $3), pgp_sym_encrypt(1::text, $3))",
          [message.guild.id, message.author.id, process.env.PASSPHRASE],
        );
      } else {
        await message.client.pgClient.query(
          "UPDATE bump_leaderboard SET bump_count = pgp_sym_encrypt((pgp_sym_decrypt(bump_count, $3)::int + 1)::text, $3) WHERE pgp_sym_decrypt(guild_id, $3) = $1 AND pgp_sym_decrypt(user_id, $3) = $2",
          [message.guild.id, message.author.id, process.env.PASSPHRASE],
        );
      }
      await message.delete();
      const result = await bumpLeaderboard(message.client, message.guild.id, message.author);
      if (result?.error) {
        await message.reply(result.error);
        return;
      }
    } else if (
      message.inGuild() &&
      message.channel.id === leaderboard &&
      message.author.id !== message.client.user!.id
    ) {
      await message.delete();
      return;
    }
  },
} satisfies EventBase<Events.MessageCreate>;
