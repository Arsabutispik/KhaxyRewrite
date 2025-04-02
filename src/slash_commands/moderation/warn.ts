import { SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import logger from "../../lib/Logger.js";
import modLog from "../../utils/modLog.js";

export default {
  memberPermissions: [PermissionsBitField.Flags.ManageGuild],
  data: new SlashCommandBuilder()
    .setName("warn")
    .setNameLocalizations({
      tr: "uyar",
    })
    .setDescription("Warns a user")
    .setDescriptionLocalizations({
      tr: "Bir kullanıcıyı uyarır",
    })
    .setContexts(0)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to warn")
        .setDescriptionLocalizations({
          tr: "Uyarılacak kullanıcı",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({
          tr: "sebep",
        })
        .setDescription("The reason for warning the user")
        .setDescriptionLocalizations({
          tr: "Kullanıcının uyarılma sebebi",
        })
        .setRequired(true),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const { rows } = await client.pgClient.query("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    if (!rows[0]) {
      await interaction.reply("An error occurred while fetching the guild data.");
      return;
    }
    const t = client.i18next.getFixedT(rows[0].language, "commands", "warn");
    const member = interaction.options.getMember("user");
    if (!member) {
      await interaction.reply({ content: t("no_member"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.id === interaction.user.id) {
      await interaction.reply({ content: t("self_warn"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.user.bot) {
      await interaction.reply({ content: t("bot_warn"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.permissions.has(PermissionsBitField.Flags.ManageGuild) || member.roles.cache.has(rows[0].mod_role)) {
      await interaction.reply({ content: t("staff_warn"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const reason = interaction.options.getString("reason", true);
    try {
      await client.pgClient.query(
        "INSERT INTO infractions (guild_id, user_id, moderator_id, type, reason, case_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [interaction.guild.id, member.id, interaction.user.id, "warn", reason, rows[0].case_id],
      );
    } catch (error) {
      await interaction.reply(t("database_error"));
      logger.error({
        message: "An error occurred while warning a user",
        error,
        guild: interaction.guild.id,
      });
      return;
    }
    try {
      await member.send(t("dm", { guild: interaction.guild.name, reason }));
      await interaction.reply(
        t("success", {
          user: member.user.tag,
          case: rows[0].case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    } catch {
      await interaction.reply(
        t("dm_error", {
          user: member.user.tag,
          case: rows[0].case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    }
    const result = await modLog(
      {
        guild: interaction.guild,
        action: "WARNING",
        user: member.user,
        moderator: interaction.user,
        reason,
      },
      client,
    );
    if (result) {
      if (interaction.replied) {
        await interaction.followUp({ content: result.message, flags: MessageFlagsBitField.Flags.Ephemeral });
      } else {
        await interaction.reply({ content: result.message, flags: MessageFlagsBitField.Flags.Ephemeral });
      }
    }
  },
} as SlashCommandBase;
