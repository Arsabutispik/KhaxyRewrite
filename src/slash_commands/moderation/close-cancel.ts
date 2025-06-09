import { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { logger } from "@lib";
import { getGuildConfig, getModMailThread, updateModMailThread } from "@database";

export default {
  memberPermissions: [PermissionsBitField.Flags.ManageMessages],
  data: new SlashCommandBuilder()
    .setName("close-cancel")
    .setNameLocalizations({
      tr: "kapat-iptal",
    })
    .setDescription("Cancel the close of a mod mail thread.")
    .setDescriptionLocalizations({
      tr: "Bir mod mail kanalının kapanmasını iptal et.",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      return interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlags.Ephemeral,
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "close-cancel");
    const mod_mail_thread = await getModMailThread(interaction.channelId);
    if (!mod_mail_thread) {
      return interaction.reply({
        content: t("no_thread"),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!mod_mail_thread.close_date) {
      return interaction.reply({
        content: t("not_closing"),
        flags: MessageFlags.Ephemeral,
      });
    }
    try {
      await updateModMailThread(interaction.channelId, {
        close_date: null,
      });
      await interaction.reply({
        content: t("cancelled"),
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.log({
        level: "error",
        error,
        message: "Error while cancelling close of mod mail thread",
      });
      return interaction.reply({
        content: t("error"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as SlashCommandBase;
