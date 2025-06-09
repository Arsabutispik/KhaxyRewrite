import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { toStringId } from "@utils";
import { logger } from "@lib";
import { ModMailMessageSentTo, ModMailMessageType, ModMailThreadStatus } from "@constants";
import { createModMailMessage, getGuildConfig, getModMailMessages, getModMailThread } from "@database";
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
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "reply");
    const mod_mail_thread = await getModMailThread(interaction.channelId);
    if (!mod_mail_thread) return interaction.reply(t("no_thread"));
    if (mod_mail_thread.status === ModMailThreadStatus.SUSPENDED) return interaction.reply(t("suspended"));
    const message = interaction.options.getString("message", true);
    const anonymous = interaction.options.getBoolean("anonymous");
    const member = await interaction.guild!.members.fetch(toStringId(mod_mail_thread.user_id)).catch(() => null);
    if (!member) return interaction.reply(t("member_not_found"));
    await interaction.deferReply({ flags: MessageFlagsBitField.Flags.Ephemeral });
    const messages = await getModMailMessages(interaction.channelId);
    if (!messages) return interaction.reply(t("no_messages"));
    const { id } = await member.send({
      content: `\`${messages.filter((row) => row.author_type === "staff").length + 1}\` **(${interaction.member.roles.highest.name})** **[${anonymous ? "(Anonymous)" : interaction.member.user.tag}]**: ${message}`,
      files: interaction.options.getAttachment("attachment") ? [interaction.options.getAttachment("attachment")!] : [],
    });
    try {
      await createModMailMessage(interaction.channelId, {
        author_id: BigInt(interaction.member.id),
        sent_at: new Date(),
        author_type: ModMailMessageType.STAFF,
        content: interaction.options.getAttachment("attachment")
          ? `${message} ${interaction.options.getAttachment("attachment")?.url}`
          : message,
        sent_to: ModMailMessageSentTo.USER,
        message_id: BigInt(id),
      });
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
