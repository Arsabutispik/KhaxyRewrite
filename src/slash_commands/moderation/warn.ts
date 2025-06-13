import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { logger } from "@lib";
import { modlog, toStringId, addInfraction } from "@utils";
import { getGuildConfig } from "@database";
import { InfractionType } from "@constants";

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
    .setContexts(InteractionContextType.Guild)
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
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "warn");
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
    if (
      member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
      member.roles.cache.has(toStringId(guild_config.staff_role_id))
    ) {
      await interaction.reply({ content: t("staff_warn"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const reason = interaction.options.getString("reason", true);
    try {
      await addInfraction({
        guild: interaction.guild,
        member: member.id,
        client: interaction.client,
        reason: reason,
        moderator: interaction.user.id,
        type: InfractionType.WARN,
      });
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
          case: guild_config.case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    } catch {
      await interaction.reply(
        t("dm_error", {
          user: member.user.tag,
          case: guild_config.case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    }
    const result = await modlog(
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
