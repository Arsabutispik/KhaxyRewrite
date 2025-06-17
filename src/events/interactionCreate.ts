import type { EventBase } from "@customTypes";
import { Events, MessageFlags, MessageFlagsBitField } from "discord.js";
import { missingPermissionsAsString } from "@utils";
import { logger } from "@lib";
import { useMainPlayer } from "discord-player";
import { createGuildConfig, getGuildConfig } from "@database";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    // Check if the interaction is a chat input command
    if (interaction.isChatInputCommand()) {
      if (!interaction.inCachedGuild()) return;
      // Check if the guild configuration exists in the database
      if (interaction.guildId && !(await getGuildConfig(interaction.guildId))) {
        logger.log({
          level: "warn",
          message: `Guild config for ${interaction.guildId} not found. Creating...`,
          discord: false,
        });
        try {
          // Insert a new guild configuration into the database
          await createGuildConfig(interaction.guildId, {});
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
      const guilds_config = await getGuildConfig(interaction.guildId);
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
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "There was an unexpected error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  },
} satisfies EventBase<Events.InteractionCreate>;
