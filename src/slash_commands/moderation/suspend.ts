import { ModMailThreadStatus, SlashCommandBase } from "../../../@types/types";
import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds, Mod_mail_threads } from "../../../@types/DatabaseTypes";
import logger from "../../lib/Logger";

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
    const { rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.id,
    ]);
    const guild_config = rows[0];
    if (!guild_config) {
      return interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlags.Ephemeral,
      });
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "suspend");
    const { rows: thread_rows } = await interaction.client.pgClient.query<Mod_mail_threads>(
      "SELECT * FROM mod_mail_threads WHERE channel_id = $1",
      [interaction.channelId],
    );
    const thread = thread_rows[0];
    if (!thread) {
      return interaction.reply({
        content: t("no_thread"),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (thread.status === ModMailThreadStatus.SUSPENDED) {
      return interaction.reply({
        content: t("already_suspended"),
        flags: MessageFlags.Ephemeral,
      });
    }
    try {
      await interaction.client.pgClient.query("UPDATE mod_mail_threads SET status = $1 WHERE channel_id = $2", [
        ModMailThreadStatus.SUSPENDED,
        interaction.channelId,
      ]);
      await interaction.reply({
        content: t("suspended"),
        flags: MessageFlags.Ephemeral,
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
