import { EventBase } from "../../@types/types";
import { Events, MessageFlagsBitField } from "discord.js";
import { missingPermissionsAsString } from "../utils/utils.js";
import logger from "../lib/Logger.js";
import process from "node:process";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    // Check if the interaction is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inCachedGuild()) return;
    // Check if the guild configuration exists in the database
    if (
      interaction.guildId &&
      !(
        await interaction.client.pgClient.query(
          "SELECT EXISTS (SELECT 1 FROM guilds WHERE pgp_sym_decrypt(id, $2) = $1)",
          [interaction.guildId, process.env.PASSPHRASE],
        )
      ).rows[0].exists
    ) {
      logger.warn(`Guild config for ${interaction.guildId} not found. Creating...`);
      try {
        // Insert a new guild configuration into the database
        await interaction.client.pgClient.query(
          "INSERT INTO guilds (id, language, case_id, days_to_kick, default_expiry, mod_mail_message) VALUES (pgp_sym_encrypt($1, $2), pgp_sym_encrypt('en', $2), pgp_sym_encrypt(1::text, $2), pgp_sym_encrypt(0::text, $2), pgp_sym_encrypt(7::text, $2), pgp_sym_encrypt('Thank you for your message! Our mod team will reply to you here as soon as possible.', $2))",
          [interaction.guildId, process.env.PASSPHRASE],
        );
        logger.info(`Guild config for ${interaction.guildId} created successfully.`);
      } catch (error) {
        logger.error(error);
        return;
      }
    }

    // Retrieve the command from the client's slash commands collection
    const command = interaction.client.slashCommands.get(interaction.commandName);
    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    // Retrieve the language from the guild configuration
    const guilds_config = await interaction.client.getGuildConfig(interaction.guildId);
    const language = guilds_config?.language || "en";
    // Retrieve the translation function
    const t = interaction.client.i18next.getFixedT(language);
    // Check if the member has the required permissions to execute the command
    if (
      command.memberPermissions &&
      interaction.member &&
      !interaction.member.permissions.has(command.memberPermissions)
    ) {
      const missingPermissions = missingPermissionsAsString(
        interaction.client,
        interaction.member.permissions.missing(command.memberPermissions),
        language,
      );
      await interaction.reply({
        content: t("events:interactionCreate.memberMissingPermissions", { permissions: missingPermissions }),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    // Check if the client has the required permissions to execute the command
    if (
      command.clientPermissions &&
      interaction.guild &&
      !interaction.guild.members.me!.permissions.has(command.clientPermissions)
    ) {
      const missingPermissions = missingPermissionsAsString(
        interaction.client,
        interaction.guild.members.me!.permissions.missing(command.clientPermissions),
        language,
      );
      await interaction.reply({
        content: t("events:interactionCreate.botMissingPermissions", { permissions: missingPermissions }),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    try {
      // Execute the command
      await command.execute(interaction);
    } catch (error) {
      logger.log({
        level: "error",
        message: "Error executing command",
        error: error,
        meta: {
          command: interaction.commandName,
          interactionID: interaction.id,
          guildID: interaction.guildId,
          userID: interaction.user.id,
        },
      });
      // Handle errors during command execution
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an unexpected error while executing this command!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an unexpected error while executing this command!",
          ephemeral: true,
        });
      }
    }
  },
} satisfies EventBase<Events.InteractionCreate>;
