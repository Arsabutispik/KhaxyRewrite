import type { SlashCommandBase } from "@customTypes";
import {
  MessageFlagsBitField,
  PermissionsBitField,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageComponentInteraction,
  ComponentType,
  EmbedBuilder,
  InteractionContextType,
} from "discord.js";
import { miscConfig, moderationConfig, registerConfig, roleConfig, welcomeLeaveConfig } from "@configFunctions";
import { getGuildConfig } from "@database";
import { localeFlags } from "@constants";

export default {
  memberPermissions: [PermissionsBitField.Flags.Administrator],
  data: new SlashCommandBuilder()
    .setName("config")
    .setNameLocalizations({
      tr: "ayarlar",
    })
    .setDescription("Configure your server's settings.")
    .setDescriptionLocalizations({
      tr: "Sunucunuzun ayarlarını yapılandırın.",
    })
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("setting")
        .setNameLocalizations({
          tr: "ayar",
        })
        .setDescription("The setting you want to configure. Leave empty to see all settings.")
        .setDescriptionLocalizations({
          tr: "Yapılandırmak istediğiniz ayar. Tüm ayarları görmek için boş bırakın.",
        })
        .setRequired(false)
        .addChoices(
          {
            name: "Register Settings",
            value: "register",
            name_localizations: {
              tr: "Kayıt Ayarları",
            },
          },
          {
            name: "Welcome-Leave Settings",
            value: "welcome-leave",
            name_localizations: {
              tr: "Gelen-Giden Ayarları",
            },
          },
          {
            name: "Moderation Settings",
            value: "moderation",
            name_localizations: {
              tr: "Moderasyon Ayarları",
            },
          },
          {
            name: "Role Settings",
            value: "role",
            name_localizations: {
              tr: "Rol Ayarları",
            },
          },
          {
            name: "Miscellaneous Settings",
            value: "misc",
            name_localizations: {
              tr: "Diğer Ayarlar",
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
    const t = client.i18next.getFixedT(guild_config.language, "commands", "config");
    const setting = interaction.options.getString("setting") as
      | "register"
      | "welcome-leave"
      | "moderation"
      | "role"
      | "misc"
      | undefined;
    if (!setting) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("config")
        .setOptions(
          { label: t("select_menu.moderation"), value: "moderation", emoji: "⚖️" },
          { label: t("select_menu.register"), value: "register", emoji: "📝" },
          { label: t("select_menu.welcome_leave"), value: "welcome-leave", emoji: "👋" },
          { label: t("select_menu.role"), value: "role", emoji: "🔒" },
          { label: t("select_menu.misc"), value: "misc", emoji: "🔧" },
        );
      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      const reply = await interaction.reply({
        content: t("no_setting"),
        flags: MessageFlagsBitField.Flags.Ephemeral,
        withResponse: true,
        components: [actionRow],
      });
      const filter = (i: MessageComponentInteraction) => i.customId === "config" && i.user.id === interaction.user.id;
      const collector = reply.resource!.message!.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 1000 * 60 * 5,
      });
      collector?.on("collect", async (i) => {
        const setting = i.values[0] as "register" | "welcome-leave" | "moderation" | "role" | "misc";
        const embed = new EmbedBuilder().setColor("Random");
        const newSelectMenu = new StringSelectMenuBuilder(selectMenu.data).setOptions(
          ...selectMenu.options.map((o) => {
            if (o.data.value !== setting && o.data.default) o.setDefault(false);
            if (o.data.value === setting) o.setDefault(true);
            return o;
          }),
        );
        const docs_url = process.env.DOCS_URL || "https://docs.khaxy.net";
        if (setting === "register") {
          embed
            .setTitle(t("embed.register.title"))
            .setURL(`${docs_url}/${guild_config.language.split("-")[0]}/configuration/register-settings`)
            .addFields(
              {
                name: t("embed.register.fields.register_join_channel"),
                value: guild_config.register_join_channel_id
                  ? `<#${guild_config.register_join_channel_id}>`
                  : t("none"),
                inline: true,
              },
              {
                name: t("embed.register.fields.register_channel"),
                value: guild_config.register_channel_id ? `<#${guild_config.register_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.register.fields.register_join_message"),
                value: guild_config.register_join_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
              {
                name: t("embed.register.fields.register_channel_clear"),
                value: guild_config.register_channel_clear
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          await i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "welcome-leave") {
          embed
            .setTitle(t("embed.welcome_leave.title"))
            .setURL(`${docs_url}/${guild_config.language.split("-")[0]}/configuration/welcome-leave-settings`)
            .addFields(
              {
                name: t("embed.welcome_leave.fields.welcome_channel"),
                value: guild_config.join_channel_id ? `<#${guild_config.join_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.welcome_leave.fields.welcome_message"),
                value: guild_config.join_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
              {
                name: t("embed.welcome_leave.fields.leave_channel"),
                value: guild_config.leave_channel_id ? `<#${guild_config.leave_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.welcome_leave.fields.leave_message"),
                value: guild_config.leave_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          await i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "moderation") {
          embed
            .setTitle(t("embed.moderation.title"))
            .setURL(`${docs_url}/${guild_config.language.split("-")[0]}/configuration/moderation-settings`)
            .addFields(
              {
                name: t("embed.moderation.fields.mod_log_channel"),
                value: guild_config.mod_log_channel_id ? `<#${guild_config.mod_log_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.moderation.fields.staff_role"),
                value: guild_config.staff_role_id ? `<@&${guild_config.staff_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.moderation.fields.mod_mail_channel"),
                value: guild_config.mod_mail_channel_id ? `<#${guild_config.mod_mail_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.moderation.fields.mute_get_all_roles"),
                value: guild_config.mute_get_all_roles
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
              {
                name: t("embed.moderation.fields.register_day_limit"),
                value: guild_config.days_to_kick.toString(),
              },
              {
                name: t("embed.moderation.fields.default_expiry"),
                value: guild_config.default_expiry.toString(),
              },
            );
          actionRow.setComponents(newSelectMenu);
          await i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "role") {
          embed
            .setTitle(t("embed.role.title"))
            .setURL(`${docs_url}/${guild_config.language.split("-")[0]}/configuration/role-settings`)
            .addFields(
              {
                name: t("embed.role.fields.color_of_the_day"),
                value: guild_config.colour_id_of_the_day ? `<@&${guild_config.colour_id_of_the_day}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.dj_role"),
                value: guild_config.dj_role_id ? `<@&${guild_config.dj_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.member_role"),
                value: guild_config.member_role_id ? `<@&${guild_config.member_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.male_role"),
                value: guild_config.male_role_id ? `<@&${guild_config.male_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.female_role"),
                value: guild_config.female_role_id ? `<@&${guild_config.female_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.mute_role"),
                value: guild_config.mute_role_id ? `<@&${guild_config.mute_role_id}>` : t("none"),
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          await i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "misc") {
          embed
            .setTitle(t("embed.misc.title"))
            .setURL(`${docs_url}/${guild_config.language.split("-")[0]}/configuration/miscellaneous-settings`)
            .addFields(
              {
                name: t("embed.misc.fields.language"),
                value: localeFlags[guild_config.language],
                inline: true,
              },
              {
                name: t("embed.misc.fields.mod_mail_message"),
                value: guild_config.mod_mail_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          await i.update({ embeds: [embed], components: [actionRow] });
        }
        collector?.on("end", () => {
          interaction.editReply({ content: t("times_up"), components: [] });
        });
      });
    }
    switch (setting) {
      case "role":
        await roleConfig(interaction);
        break;
      case "register":
        await registerConfig(interaction);
        break;
      case "welcome-leave":
        await welcomeLeaveConfig(interaction);
        break;
      case "moderation":
        await moderationConfig(interaction);
        break;
      case "misc":
        await miscConfig(interaction);
        break;
    }
  },
} as SlashCommandBase;
