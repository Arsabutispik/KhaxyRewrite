import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, Locale, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { logger } from "@lib";
import { ModMailMessageSentTo, ModMailMessageType, ModMailThreadStatus } from "@constants";
import { createModMailMessage, getGuildConfig, getModMailThread, updateModMailThread } from "@database";
export default {
  memberPermissions: [PermissionsBitField.Flags.ManageMessages],
  data: new SlashCommandBuilder()
    .setName("suspend")
    .setNameLocalizations({
      tr: "askıya-al",
    })
    .setDescription("Suspend a mod mail thread.")
    .setDescriptionLocalizations({
      tr: "Bir mod mail kanalını askıya al.",
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
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "suspend");
    const mod_mail_thread = await getModMailThread(interaction.channelId);
    if (!mod_mail_thread) {
      return interaction.reply({
        content: t("no_thread"),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (mod_mail_thread.status === ModMailThreadStatus.SUSPENDED) {
      return interaction.reply({
        content: t("already_suspended"),
        flags: MessageFlags.Ephemeral,
      });
    }
    try {
      await updateModMailThread(interaction.channelId, {
        status: ModMailThreadStatus.SUSPENDED,
      });
      const response = await interaction.reply({
        content: t("suspended"),
        flags: MessageFlags.Ephemeral,
        withResponse: true,
      });
      await createModMailMessage(interaction.channelId, {
        author_id: BigInt(interaction.user.id),
        sent_at: new Date(),
        author_type: ModMailMessageType.STAFF,
        sent_to: ModMailMessageSentTo.COMMAND,
        content: `/${interaction.command?.nameLocalizations?.[guild_config.language.split("-")[0] as Locale]}`,
        message_id: BigInt(interaction.id),
      });
      await createModMailMessage(interaction.channelId, {
        author_id: BigInt(interaction.user.id),
        sent_at: new Date(),
        author_type: ModMailMessageType.CLIENT,
        sent_to: ModMailMessageSentTo.THREAD,
        content: t("suspended"),
        message_id: BigInt(response.resource?.message?.id || 0),
      });
    } catch (error) {
      logger.log({
        level: "error",
        error,
        message: "Failed to suspend mod mail thread",
      });
      return interaction.reply({
        content: t("error"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as SlashCommandBase;
