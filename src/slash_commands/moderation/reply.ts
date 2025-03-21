import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds, Mod_mail_messages, Mod_mail_threads } from "../../../@types/DatabaseTypes";
import { toStringId } from "../../utils/utils.js";
import logger from "../../lib/Logger.js";

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
    const client = interaction.client as KhaxyClient;
    const { rows: threads_rows } = await client.pgClient.query<Mod_mail_threads>(
      "SELECT * FROM mod_mail_threads WHERE channel_id = $1",
      [interaction.channel!.id],
    );
    const { rows: guilds_rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guild.id,
    ]);
    if (!guilds_rows.length) return interaction.reply("This guild is not in the database.");
    const t = client.i18next.getFixedT(guilds_rows[0].language, "commands", "reply");
    if (!threads_rows.length) return interaction.reply(t("no_thread"));
    if (threads_rows[0].status === "suspended") return interaction.reply(t("suspended"));
    const message = interaction.options.getString("message", true);
    const anonymous = interaction.options.getBoolean("anonymous");
    const member = await interaction.guild!.members.fetch(toStringId(threads_rows[0].user_id)).catch(() => null);
    if (!member) return interaction.reply(t("member_not_found"));
    try {
      await client.pgClient.query(
        "INSERT INTO mod_mail_messages (author_id, sent_at, author_type, content, attachments, thread_id, send_to) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          interaction.member.id,
          new Date(),
          "staff",
          message,
          interaction.options.getAttachment("attachment")?.url
            ? [interaction.options.getAttachment("attachment")?.url]
            : [],
          threads_rows[0].thread_id,
          "user",
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
      "SELECT * FROM mod_mail_messages WHERE thread_id = $1",
      [threads_rows[0].thread_id],
    );
    if (anonymous) {
      const { id } = await member.send(`\`${messages.rowCount}\` **(Anonymous)**: ${message}`);
      await client.pgClient.query("UPDATE mod_mail_messages SET message_id = $1 WHERE thread_id = $2", [
        id,
        threads_rows[0].thread_id,
      ]);
    } else {
      const { id } = await member.send({
        content: `\`${messages.rows.filter((row) => row.author_type === "staff").length}\` **(${interaction.member.roles.highest.name})** **[${interaction.member.user.tag}]**: ${message}`,
        files: interaction.options.getAttachment("attachment")
          ? [interaction.options.getAttachment("attachment")!]
          : [],
      });
      await client.pgClient.query("UPDATE mod_mail_messages SET message_id = $1 WHERE thread_id = $2", [
        id,
        threads_rows[0].thread_id,
      ]);
    }
    await interaction.reply({ content: t("success"), flags: MessageFlagsBitField.Flags.Ephemeral });
    await interaction.channel!.send({
      content: `\`${messages.rows.filter((row) => row.author_type === "staff").length}\` **(${interaction.member.roles.highest.name})** **[${interaction.member.user.tag}]**: ${message}`,
      files: interaction.options.getAttachment("attachment") ? [interaction.options.getAttachment("attachment")!] : [],
    });
  },
} as SlashCommandBase;
