import { SlashCommandBase } from "../../../@types/types";
import {
  MessageFlagsBitField,
  PermissionsBitField,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageComponentInteraction,
  ComponentType,
  EmbedBuilder,
} from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import roleConfig from "../../config_functions/role-config.js";
import registerConfig from "../../config_functions/register-config.js";
import welcomeLeaveConfig from "../../config_functions/welcome-leave-config.js";
import moderationConfig from "../../config_functions/moderation-config.js";
import miscConfig from "../../config_functions/misc-config.js";
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
    .setContexts(0)
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
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    if (rows.length === 0) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(rows[0].language, "commands", "config");
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
        if (setting === "register") {
          embed
            .setTitle(t("embed.register.title"))
            .setURL("https://ispik.gitbook.io/khaxy/${rows[0].language}/configuration-documentation/register-settings")
            .addFields(
              {
                name: t("embed.register.fields.register_join_channel"),
                value: rows[0].register_join_channel_id ? `<#${rows[0].register_join_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.register.fields.register_channel"),
                value: rows[0].register_channel_id ? `<#${rows[0].register_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.register.fields.register_join_message"),
                value: rows[0].register_join_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
              {
                name: t("embed.register.fields.register_channel_clear"),
                value: rows[0].register_channel_clear
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "welcome-leave") {
          embed
            .setTitle(t("embed.welcome_leave.title"))
            .setURL(
              "https://ispik.gitbook.io/khaxy/${rows[0].language}/configuration-documentation/welcome-leave-settings",
            )
            .addFields(
              {
                name: t("embed.welcome_leave.fields.welcome_channel"),
                value: rows[0].join_channel_id ? `<#${rows[0].join_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.welcome_leave.fields.welcome_message"),
                value: rows[0].join_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
              {
                name: t("embed.welcome_leave.fields.leave_channel"),
                value: rows[0].leave_channel_id ? `<#${rows[0].leave_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.welcome_leave.fields.leave_message"),
                value: rows[0].leave_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "moderation") {
          embed
            .setTitle(t("embed.moderation.title"))
            .setURL(
              "https://ispik.gitbook.io/khaxy/${rows[0].language}/configuration-documentation/moderation-settings",
            )
            .addFields(
              {
                name: t("embed.moderation.fields.mod_log_channel"),
                value: rows[0].mod_log_channel_id ? `<#${rows[0].mod_log_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.moderation.fields.staff_role"),
                value: rows[0].staff_role_id ? `<@&${rows[0].staff_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.moderation.fields.mod_mail_channel"),
                value: rows[0].mod_mail_channel_id ? `<#${rows[0].mod_mail_channel_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.moderation.fields.mute_get_all_roles"),
                value: rows[0].mute_get_all_roles
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
              {
                name: t("embed.moderation.fields.register_day_limit"),
                value: rows[0].days_to_kick.toString(),
              },
              {
                name: t("embed.moderation.fields.default_expiry"),
                value: rows[0].default_expiry.toString(),
              },
            );
          actionRow.setComponents(newSelectMenu);
          i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "role") {
          embed
            .setTitle(t("embed.role.title"))
            .setURL(`https://ispik.gitbook.io/khaxy/${rows[0].language}/configuration-documentation/role-settings`)
            .addFields(
              {
                name: t("embed.role.fields.color_of_the_day"),
                value: rows[0].color_id_of_the_day ? `<@&${rows[0].color_id_of_the_day}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.dj_role"),
                value: rows[0].dj_role_id ? `<@&${rows[0].dj_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.member_role"),
                value: rows[0].member_role_id ? `<@&${rows[0].member_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.male_role"),
                value: rows[0].male_role_id ? `<@&${rows[0].male_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.female_role"),
                value: rows[0].female_role_id ? `<@&${rows[0].female_role_id}>` : t("none"),
                inline: true,
              },
              {
                name: t("embed.role.fields.mute_role"),
                value: rows[0].mute_role_id ? `<@&${rows[0].mute_role_id}>` : t("none"),
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          i.update({ embeds: [embed], components: [actionRow] });
        } else if (setting === "misc") {
          const selectedLanguage = {
            tr: "Türkçe 🇹🇷",
            en: "English 🇺🇸",
          };
          embed
            .setTitle(t("embed.misc.title"))
            .setURL(
              "https://ispik.gitbook.io/khaxy/${rows[0].language}/configuration-documentation/miscellaneous-settings",
            )
            .addFields(
              {
                name: t("embed.misc.fields.language"),
                value: selectedLanguage[rows[0].language as keyof typeof selectedLanguage],
                inline: true,
              },
              {
                name: t("embed.misc.fields.mod_mail_message"),
                value: rows[0].mod_mail_message
                  ? client.allEmojis.get(client.config.Emojis.confirm)!.format
                  : client.allEmojis.get(client.config.Emojis.reject)!.format,
                inline: true,
              },
            );
          actionRow.setComponents(newSelectMenu);
          i.update({ embeds: [embed], components: [actionRow] });
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
