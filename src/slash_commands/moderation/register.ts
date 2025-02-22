import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import logger from "../../lib/Logger";

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
          },
          {
            name: "Female 👩",
            value: "female",
          },
          {
            name: "Other 🧑",
            value: "other",
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
    const registerChannel = interaction.guild.channels.cache.get(rows[0].register_channel);
    if (!rows[0].register_channel || !registerChannel) {
      await interaction.reply(t("no_register_channel"));
      return;
    }
    if (interaction.channelId !== registerChannel.id) {
      await interaction.reply(t("wrong_channel", { channel: registerChannel.id }));
      return;
    }
    if (!rows[0].member_role || !interaction.guild.roles.cache.has(rows[0].member_role)) {
      await interaction.reply(t("no_member_role"));
      return;
    }
    switch (gender) {
      case "male":
        if (!rows[0].male_role || !interaction.guild.roles.cache.has(rows[0].male_role)) {
          await interaction.reply(t("no_male_role"));
          return;
        }
        try {
          await member.roles.add(rows[0].male_role);
          await member.roles.add(rows[0].member_role);
          await interaction.reply(
            t("success", { member, confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format }),
          );
        } catch (e) {
          await interaction.reply(t("error"));
          logger.log({
            level: "error",
            message: e,
          });
        }
    }
  },
} as SlashCommandBase;
