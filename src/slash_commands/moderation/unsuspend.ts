import { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { getGuildConfig, getModMailThread, getModMailThreadsByUser, updateModMailThread } from "@database";
import { ModMailThreadStatus } from "@constants";
import { toStringId } from "@utils";
import { logger } from "@lib";

export default {
  memberPermissions: [PermissionsBitField.Flags.ManageMessages],
  data: new SlashCommandBuilder()
    .setName("unsuspend")
    .setNameLocalizations({
      tr: "askıdan-kaldır",
    })
    .setDescription("Unsuspend a modmail thread")
    .setDescriptionLocalizations({
      tr: "Modmail kanalını askıdan kaldırır",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "unsuspend");
    const thread = await getModMailThread(interaction.channelId);
    if (!thread) {
      await interaction.reply({
        content: t("no_thread"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (thread.status !== ModMailThreadStatus.SUSPENDED) {
      await interaction.reply({
        content: t("not_suspended"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const user_threads = await getModMailThreadsByUser(toStringId(thread.user_id));
    if (user_threads.some((thread) => thread.status === ModMailThreadStatus.OPEN)) {
      await interaction.reply({
        content: t("user_has_open_threads"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await updateModMailThread(toStringId(interaction.channelId), {
        status: ModMailThreadStatus.OPEN,
      });
      await interaction.editReply(t("unsuspended"));
    } catch (error) {
      logger.log({
        level: "error",
        message: `Failed to unsuspend modmail thread ${interaction.channelId}`,
        error,
      });
      await interaction.editReply(t("error"));
    }
  },
} as SlashCommandBase;
