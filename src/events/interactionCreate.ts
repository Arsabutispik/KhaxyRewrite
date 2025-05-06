import { EventBase } from "../../@types/types";
import { Events, MessageFlagsBitField } from "discord.js";
import { missingPermissionsAsString } from "../utils/utils.js";
import logger from "../lib/Logger.js";
import { Guilds } from "../../@types/DatabaseTypes";
import { useMainPlayer } from "discord-player";

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
        await interaction.client.pgClient.query("SELECT EXISTS (SELECT 1 FROM guilds WHERE id = $1)", [
          interaction.guildId,
        ])
      ).rows[0].exists
    ) {
      logger.log({
        level: "warn",
        message: `Guild config for ${interaction.guildId} not found. Creating...`,
        discord: false,
      });
      try {
        // Insert a new guild configuration into the database
        await interaction.client.pgClient.query(
          "INSERT INTO guilds (id, language, case_id, days_to_kick, default_expiry, mod_mail_message) VALUES ($1, 'en-GB', 1, 0, 0, 'Thank you for your message! Our mod team will reply to you here as soon as possible.')",
          [interaction.guildId],
        );
        logger.log({
          level: "info",
          message: `Guild config for ${interaction.guildId} created.`,
          discord: false,
        });
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
    const { rows } = await interaction.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      interaction.guildId,
    ]);
    const guilds_config = rows[0];
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
      const player = useMainPlayer();
      const data = {
        guild: interaction.guild,
      };
      // Execute the command
      await player.context.provide(data, () => command.execute(interaction));
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
