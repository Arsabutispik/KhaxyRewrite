import { SlashCommandBase } from "../../../@types/types";
import { InteractionContextType, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { toStringId } from "../../utils/utils.js";
import logger from "../../lib/Logger.js";
import { Guilds, Mod_mail_messages, Mod_mail_threads } from "../../../@types/DatabaseTypes";
import { ModMailMessageSentTo, ModMailMessageType, ModMailThreadStatus } from "../../lib/Enums.js";
export default {
  memberPermissions: [PermissionsBitField.Flags.ManageMessages],
  data: new SlashCommandBuilder()
    .setName("reply")
    .setNameLocalizations({
      tr: "cevapla",
    })
    .setDescription("Send a reply to a mod mail thread.")
    .setDescriptionLocalizations({
      tr: "Mod mail için bir cevap gönderin.",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addStringOption((option) =>
      option
        .setName("message")
        .setNameLocalizations({
          tr: "mesaj",
        })
        .setMaxLength(1500)
        .setDescription("The message to send.")
        .setDescriptionLocalizations({
          tr: "Gönderilecek mesaj.",
        })
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName("attachment")
        .setNameLocalizations({
          tr: "dosya",
        })
        .setDescription("The attachment to send.")
        .setDescriptionLocalizations({
          tr: "Gönderilecek dosya.",
        })
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("anonymous")
        .setNameLocalizations({
          tr: "anonim",
        })
        .setDescription("Send the message anonymously.")
        .setDescriptionLocalizations({
          tr: "Mesajı anonim olarak gönderin.",
        })
        .setRequired(false),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const { rows: thread_rows } = await client.pgClient.query<Mod_mail_threads>(
      "SELECT * FROM mod_mail_threads WHERE channel_id = $1",
      [interaction.channelId],
    );
    const threads = thread_rows[0];
    const { rows: guild_rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guildId,
    ]);
    const guild_config = guild_rows[0];
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "reply");
    if (!threads) return interaction.reply(t("no_thread"));
    if (threads.status === ModMailThreadStatus.SUSPENDED) return interaction.reply(t("suspended"));
    const message = interaction.options.getString("message", true);
    const anonymous = interaction.options.getBoolean("anonymous");
    const member = await interaction.guild!.members.fetch(toStringId(threads.user_id)).catch(() => null);
    if (!member) return interaction.reply(t("member_not_found"));
    await interaction.deferReply({ flags: MessageFlagsBitField.Flags.Ephemeral });
    const { rows: messages } = await client.pgClient.query<Mod_mail_messages>(
      "SELECT * FROM mod_mail_messages WHERE channel_id = $1",
      [interaction.channelId],
    );
    if (!messages) return interaction.reply(t("no_messages"));
    const { id } = await member.send({
      content: `\`${messages.filter((row) => row.author_type === "staff").length + 1}\` **(${interaction.member.roles.highest.name})** **[${anonymous ? "(Anonymous)" : interaction.member.user.tag}]**: ${message}`,
      files: interaction.options.getAttachment("attachment") ? [interaction.options.getAttachment("attachment")!] : [],
    });
    try {
      await client.pgClient.query(
        "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, sent_to, channel_id, message_id) VALUES ($1 ,$2, $3, $4, $5, $6, $7)",
        [
          interaction.member.id,
          new Date(),
          ModMailMessageType.STAFF,
          interaction.options.getAttachment("attachment")
            ? `${message} ${interaction.options.getAttachment("attachment")?.url}`
            : message,
          ModMailMessageSentTo.USER,
          interaction.channel!.id,
          id,
        ],
      );
    } catch (e) {
      logger.error({
        message: "Error while inserting a new mod mail message.",
        error: e,
      });
      return interaction.reply(t("error"));
    }
    await interaction.editReply({ content: t("success") });
    await interaction.channel!.send({
      content: `\`${messages.filter((row) => row.author_type === "staff").length + 1}\` **(${interaction.member.roles.highest.name})** **[${interaction.member.user.tag}]**: ${message}`,
      files: interaction.options.getAttachment("attachment") ? [interaction.options.getAttachment("attachment")!] : [],
    });
  },
} as SlashCommandBase;
