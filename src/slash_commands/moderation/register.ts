import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import logger from "../../lib/Logger.js";
import { toStringId } from "../../utils/utils.js";

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
    .setContexts(0)
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
    const client = interaction.client as KhaxyClient;
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    const t = client.i18next.getFixedT(rows[0].language || "en", "commands", "register");
    const member = interaction.options.getMember("user");
    if (!member) {
      await interaction.reply(t("no_member"));
      return;
    }
    const gender = interaction.options.getString("gender", true);
    const registerChannel = interaction.guild.channels.cache.get(toStringId(rows[0].register_channel_id));
    if (!rows[0].register_channel_id || !registerChannel) {
      await interaction.reply(t("no_register_channel"));
      return;
    }
    if (interaction.channelId !== registerChannel.id) {
      await interaction.reply(t("wrong_channel", { channel: registerChannel.id }));
      return;
    }
    if (!rows[0].member_role_id || !interaction.guild.roles.cache.has(toStringId(rows[0].member_role_id))) {
      await interaction.reply(t("no_member_role"));
      return;
    }
    switch (gender) {
      case "male":
        if (!rows[0].male_role_id || !interaction.guild.roles.cache.has(toStringId(rows[0].male_role_id))) {
          await interaction.reply(t("no_male_role"));
          return;
        }
        try {
          await member.roles.add(toStringId(rows[0].male_role_id));
          await member.roles.add(toStringId(rows[0].member_role_id));
          await interaction.reply(
            t("success", { member, confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format }),
          );
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
        if (!rows[0].female_role_id || !interaction.guild.roles.cache.has(toStringId(rows[0].female_role_id))) {
          await interaction.reply(t("no_female_role"));
          return;
        }
        try {
          await member.roles.add(toStringId(rows[0].female_role_id));
          await member.roles.add(toStringId(rows[0].member_role_id));
          await interaction.reply(
            t("success", { member, confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format }),
          );
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
          await member.roles.add(toStringId(rows[0].member_role_id));
          await interaction.reply(
            t("success", { member, confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format }),
          );
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
