import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { logger } from "@lib";
import { toStringId } from "@utils";
import { getGuildConfig } from "@database";

export default {
  memberPermissions: [PermissionsBitField.Flags.ManageRoles],
  clientPermissions: [PermissionsBitField.Flags.ManageRoles],
  data: new SlashCommandBuilder()
    .setName("register")
    .setNameLocalizations({
      tr: "kayıt",
    })
    .setDescription("Register a user to the server")
    .setDescriptionLocalizations({
      tr: "Kullanıcıyı sunucuya kayıt eder",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to register")
        .setDescriptionLocalizations({
          tr: "Kayıt edilecek kullanıcı",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("gender")
        .setNameLocalizations({
          tr: "cinsiyet",
        })
        .setDescription("The gender of the user")
        .setDescriptionLocalizations({
          tr: "Kullanıcının cinsiyeti",
        })
        .setRequired(true)
        .setChoices(
          {
            name: "Male 👨",
            value: "male",
            name_localizations: {
              tr: "Erkek 👨",
            },
          },
          {
            name: "Female 👩",
            value: "female",
            name_localizations: {
              tr: "Kadın 👩",
            },
          },
          {
            name: "Other 🧑",
            value: "other",
            name_localizations: {
              tr: "Diğer 🧑",
            },
          },
        ),
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
    const t = client.i18next.getFixedT(guild_config.language || "en", "commands", "register");
    const member = interaction.options.getMember("user");
    if (!member) {
      await interaction.reply({ content: t("no_member"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const gender = interaction.options.getString("gender", true);
    const registerChannel = interaction.guild.channels.cache.get(toStringId(guild_config.register_channel_id));
    if (!guild_config.register_channel_id || !registerChannel) {
      await interaction.reply({ content: t("no_register_channel"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (interaction.channelId !== registerChannel.id) {
      await interaction.reply({
        content: t("wrong_channel", { channel: registerChannel.id }),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    if (!guild_config.member_role_id || !interaction.guild.roles.cache.has(toStringId(guild_config.member_role_id))) {
      await interaction.reply({ content: t("no_member_role"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.roles.cache.has(toStringId(guild_config.member_role_id))) {
      await interaction.reply({ content: t("already_registered"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (guild_config.unverified_role_id && member.roles.cache.has(toStringId(guild_config.unverified_role_id))) {
      try {
        await member.roles.remove(toStringId(guild_config.unverified_role_id));
      } catch (e) {
        await interaction.reply({
          content: t("error", { error: e.message }),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
        logger.error({
          message: `Error while removing unverified role from user ${member.user.tag} in guild ${interaction.guild.name}`,
          error: e,
          guild: interaction.guild.id,
          user: interaction.user.id,
        });
        return;
      }
    }
    switch (gender) {
      case "male":
        if (!guild_config.male_role_id || !interaction.guild.roles.cache.has(toStringId(guild_config.male_role_id))) {
          await interaction.reply({ content: t("no_male_role"), flags: MessageFlagsBitField.Flags.Ephemeral });
          return;
        }
        try {
          await member.roles.add(toStringId(guild_config.male_role_id));
          await member.roles.add(toStringId(guild_config.member_role_id));
          await interaction.reply({
            content: t("success", {
              user: member.toString(),
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
        } catch (e) {
          await interaction.reply({
            content: t("error", { error: e.message }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
          logger.error({
            message: `Error while registering user ${member.user.tag} from guild ${interaction.guild.name}`,
            error: e,
            guild: interaction.guild.id,
            user: interaction.user.id,
          });
        }
        break;
      case "female":
        if (
          !guild_config.female_role_id ||
          !interaction.guild.roles.cache.has(toStringId(guild_config.female_role_id))
        ) {
          await interaction.reply({ content: t("no_female_role"), flags: MessageFlagsBitField.Flags.Ephemeral });
          return;
        }
        try {
          await member.roles.add(toStringId(guild_config.female_role_id));
          await member.roles.add(toStringId(guild_config.member_role_id));
          await interaction.reply({
            content: t("success", {
              user: member.toString(),
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
        } catch (e) {
          await interaction.reply({
            content: t("error", { error: e.message }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
          logger.error({
            message: `Error while registering user ${member.user.tag} from guild ${interaction.guild.name}`,
            error: e,
            guild: interaction.guild.id,
            user: interaction.user.id,
          });
        }
        break;
      case "other":
        try {
          await member.roles.add(toStringId(guild_config.member_role_id));
          await interaction.reply({
            content: t("success", {
              user: member.toString(),
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
        } catch (e) {
          await interaction.reply({
            content: t("error", { error: e.message }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
          logger.error({
            message: `Error while registering user ${member.user.tag} from guild ${interaction.guild.name}`,
            error: e,
            guild: interaction.guild.id,
            user: interaction.user.id,
          });
        }
        break;
      default:
        await interaction.reply(t("not_valid"));
        break;
    }
  },
} as SlashCommandBase;
