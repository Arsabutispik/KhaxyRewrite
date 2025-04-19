import { SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Mod_mail_messages } from "../../../@types/DatabaseTypes";
import { toStringId } from "../../utils/utils.js";
import logger from "../../lib/Logger.js";
import process from "node:process";

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
    .setContexts(0)
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
    const threads = await client.getModmailThread(interaction.guild.id, interaction.channelId);
    const guild_config = await client.getGuildConfig(interaction.guild.id);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "reply");
    if (!threads) return interaction.reply(t("no_thread"));
    if (threads.status === "suspended") return interaction.reply(t("suspended"));
    const message = interaction.options.getString("message", true);
    const anonymous = interaction.options.getBoolean("anonymous");
    const member = await interaction.guild!.members.fetch(toStringId(threads.user_id)).catch(() => null);
    if (!member) return interaction.reply(t("member_not_found"));
    try {
      await client.pgClient.query(
        "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, sent_to, channel_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          interaction.member.id,
          new Date(),
          "staff",
          message,
          interaction.options.getAttachment("attachment")?.url
            ? [interaction.options.getAttachment("attachment")?.url]
            : [],
          threads.thread_id,
          "user",
          interaction.channel!.id,
        ],
      );
    } catch (e) {
      logger.error({
        message: "Error while inserting a new mod mail message.",
        error: e,
      });
      return interaction.reply(t("error"));
    }
    const messages = await client.pgClient.query<Mod_mail_messages>(
      "SELECT * FROM mod_mail_messages WHERE pgp_sym_decrypt(thread_id, $2) = $1",
      [threads.thread_id, process.env.PASSPHRASE],
    );
    if (anonymous) {
      const { id } = await member.send(`\`${messages.rowCount}\` **(Anonymous)**: ${message}`);
      await client.pgClient.query(
        "UPDATE mod_mail_messages SET message_id = pgp_sym_encrypt($1, $3) WHERE pgp_sym_decrypt(thread_id, $3) = $2",
        [id, threads.thread_id, process.env.PASSPHRASE],
      );
    } else {
      const { id } = await member.send({
        content: `\`${messages.rows.filter((row) => row.author_type === "staff").length}\` **(${interaction.member.roles.highest.name})** **[${interaction.member.user.tag}]**: ${message}`,
        files: interaction.options.getAttachment("attachment")
          ? [interaction.options.getAttachment("attachment")!]
          : [],
      });
      await client.pgClient.query(
        "UPDATE mod_mail_messages SET message_id = pgp_sym_encrypt($1, $3) WHERE pgp_sym_decrypt(thread_id, $3) = $2",
        [id, threads.thread_id, process.env.PASSPHRASE],
      );
    }
    await interaction.reply({ content: t("success"), flags: MessageFlagsBitField.Flags.Ephemeral });
    await interaction.channel!.send({
      content: `\`${messages.rows.filter((row) => row.author_type === "staff").length}\` **(${interaction.member.roles.highest.name})** **[${interaction.member.user.tag}]**: ${message}`,
      files: interaction.options.getAttachment("attachment") ? [interaction.options.getAttachment("attachment")!] : [],
    });
  },
} as SlashCommandBase;
