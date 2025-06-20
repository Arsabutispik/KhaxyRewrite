import { SlashCommandBase } from "@customTypes";
import { EmbedBuilder, MessageFlags, SlashCommandBuilder, Locale } from "discord.js";
import { getGuildConfig } from "@database";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setNameLocalizations({
      tr: "yardım",
    })
    .setDescription("Get help with the bot's commands")
    .setDescriptionLocalizations({
      tr: "Botun komutları hakkında yardım al",
    })
    .addStringOption((option) =>
      option
        .setName("command")
        .setNameLocalizations({
          tr: "komut",
        })
        .setDescription("The command you need help with")
        .setDescriptionLocalizations({
          tr: "Yardım almak istediğiniz komut",
        })
        .setRequired(true),
    ),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "Guild configuration not found. Please try again later.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "help");
    const helpt = interaction.client.i18next.getFixedT(guild_config.language, "help");
    const command_name = interaction.options.getString("command", true);
    let command_collection;
    if (process.env.NODE_ENV === "development") {
      command_collection =
        interaction.client.application.commands.cache.size > 0
          ? interaction.client.application.commands.cache
          : await interaction.client.application.commands
              .fetch({ guildId: process.env.GUILD_ID, withLocalizations: true })
              .catch(() => null);
    } else {
      command_collection =
        interaction.client.application.commands.cache.size > 0
          ? interaction.client.application.commands.cache
          : await interaction.client.application.commands.fetch({ withLocalizations: true });
    }
    const command = command_collection?.find(
      (cmd) =>
        cmd.name === command_name ||
        cmd.nameLocalizations?.[guild_config.language.split("-")[0] as Locale] === command_name,
    );
    if (!command) {
      await interaction.reply({
        content: t("command_not_found", { command: command_name }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle(helpt(`${command.name}.title`))
      .setDescription(helpt(`${command.name}.description`))
      .setColor("Random")
      .setFooter({
        text: t("footer"),
      });
    if (helpt(`${command.name}.usage`, { fallbackLng: false }) !== `${command.name}.usage`) {
      embed.addFields({
        name: t("command_usage"),
        value: helpt(`${command.name}.usage`, { command }),
      });
    }
    if (helpt(`${command.name}.permissions`, { fallbackLng: false }) !== `${command.name}.permissions`) {
      embed.addFields({
        name: t("permissions"),
        value: helpt(`${command.name}.permissions`, { joinArrays: "\n" }),
      });
    }
    if (helpt(`${command.name}.examples`, { fallbackLng: false }) !== `${command.name}.examples`) {
      embed.addFields({
        name: t("examples"),
        value: helpt(`${command.name}.examples`, { joinArrays: "\n" }),
      });
    }
    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
} as SlashCommandBase;
