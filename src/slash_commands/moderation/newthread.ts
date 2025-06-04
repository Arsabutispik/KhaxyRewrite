import { SlashCommandBase } from "../../../@types/types";
import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import { toStringId } from "../../utils/utils.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import logger from "../../lib/Logger.js";
import { ModMailMessageSentTo, ModMailMessageType, ModMailThreadStatus } from "../../lib/Enums.js";
export default {
  memberPermissions: [PermissionsBitField.Flags.ManageMessages],
  clientPermissions: [PermissionsBitField.Flags.ManageChannels],
  data: new SlashCommandBuilder()
    .setName("newthread")
    .setNameLocalizations({
      tr: "yeni-modmesaj",
    })
    .setDescription("Create a new thread for moderation messages.")
    .setDescriptionLocalizations({
      tr: "Moderatör mesajları için yeni bir kanal oluştur.",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to create a thread for.")
        .setDescriptionLocalizations({
          tr: "Bir kanal oluşturulacak kullanıcı.",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setNameLocalizations({
          tr: "mesaj",
        })
        .setDescription("The message to send to the user.")
        .setDescriptionLocalizations({
          tr: "Kullanıcıya gönderilecek mesaj.",
        })
        .setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("user", true);
    const { rows: guild_rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guildId,
    ]);
    const guild_config = guild_rows[0];
    if (!guild_config) {
      return interaction.editReply({
        content: "This server is not configured yet.",
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "newthread");
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.editReply({
        content: t("user_not_in_guild"),
      });
    }
    const modmail_channel = interaction.guild.channels.cache.get(toStringId(guild_config.mod_mail_channel_id));
    if (!modmail_channel) {
      return interaction.editReply({
        content: t("no_modmail_channel"),
      });
    }
    if (!modmail_channel.isTextBased()) {
      return interaction.editReply({
        content: t("modmail_channel_not_text"),
      });
    }
    if (modmail_channel.parent?.id !== toStringId(guild_config.mod_mail_parent_channel_id)) {
      return interaction.editReply({
        content: t("modmail_channel_not_in_parent"),
      });
    }
    const { rows: thread_rows } = await interaction.client.pgClient.query<Guilds>(
      "SELECT * FROM mod_mail_threads WHERE guild_id = $1 AND user_id = $2 AND status = $3",
      [interaction.guildId, user.id, ModMailThreadStatus.OPEN],
    );
    if (thread_rows.length > 0) {
      return interaction.editReply({
        content: t("thread_already_exists"),
      });
    }
    const permission_overwrites = [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }];

    if (interaction.guild.roles.cache.has(toStringId(guild_config.staff_role_id))) {
      permission_overwrites.push({
        id: toStringId(guild_config.staff_role_id)!,
        // @ts-expect-error - This is a valid permission bitfield
        allow: [PermissionsBitField.Flags.ViewChannel],
      });
    }
    const channel = await interaction.guild.channels
      .create({
        name: Math.random().toString(36).slice(2),
        parent: toStringId(guild_config.mod_mail_parent_channel_id),
        type: ChannelType.GuildText,
        topic: t("topic", { user: user.tag }),
        permissionOverwrites: permission_overwrites,
      })
      .catch(() => {
        interaction.editReply({
          content: t("channel_create_failed"),
        });
        return null;
      });
    if (!channel) return;
    const message = interaction.options.getString("message", true);
    let dm;
    try {
      dm = await user.send(t("message", { message, guild: interaction.guild.name, user: interaction.user.tag }));
    } catch {
      await interaction.editReply({
        content: t("dm_failed"),
      });
      await channel.delete();
      return;
    }
    dayjs.extend(relativeTime);
    const bot_message = await channel
      .send(
        t("initial", {
          user,
          account_age: dayjs(user.createdAt).fromNow(),
          join_date: dayjs(member.joinedAt).fromNow(),
        }),
      )
      .catch(() => {
        interaction.editReply({
          content: t("message_send_failed"),
        });
        user.send(t("message_send_failed"));
        channel.delete();
        return null;
      });
    if (!bot_message) return;
    await channel.send(
      `${t("created_by", { user: interaction.user.tag })} \`1\` **[${interaction.user.tag}]:** ${message}`,
    );
    try {
      await interaction.client.pgClient.query(
        "INSERT INTO mod_mail_threads (guild_id, user_id, channel_id, created_at, status) VALUES ($1, $2, $3, $4, $5)",
        [interaction.guildId, user.id, channel.id, bot_message.createdAt, ModMailThreadStatus.OPEN],
      );
      await interaction.client.pgClient.query(
        "INSERT INTO mod_mail_messages (author_id, sent_at, message_id, channel_id, sent_to, author_type, content) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          interaction.user.id,
          dm.createdAt,
          dm.id,
          channel.id,
          ModMailMessageSentTo.USER,
          ModMailMessageType.STAFF,
          message,
        ],
      );
      await interaction.client.pgClient.query(
        "INSERT INTO mod_mail_messages (author_id, sent_at, message_id, channel_id, sent_to, author_type, content) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          interaction.client.user.id,
          bot_message.createdAt,
          bot_message.id,
          channel.id,
          ModMailMessageSentTo.THREAD,
          ModMailMessageType.CLIENT,
          bot_message.content,
        ],
      );
    } catch (e) {
      logger.log({
        level: "error",
        error: e,
        message: `Failed to insert mod mail thread into database for user ${user.id} in guild ${interaction.guildId}`,
      });
      await interaction.editReply({
        content: t("db_error"),
      });
      await user.send(t("db_error"));
      await channel.delete();
      return;
    }
    await interaction.editReply({
      content: t("thread_created", { channel: channel.toString() }),
    });
  },
} as SlashCommandBase;
