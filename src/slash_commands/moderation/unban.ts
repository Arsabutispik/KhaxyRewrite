import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import logger from "../../lib/Logger.js";
import modLog from "../../utils/modLog.js";

export default {
  memberPermissions: [PermissionsBitField.Flags.BanMembers],
  clientPermissions: [PermissionsBitField.Flags.BanMembers],
  data: new SlashCommandBuilder()
    .setName("unban")
    .setNameLocalizations({
      tr: "yasak-kaldır",
    })
    .setDescription("Unban a user from the server")
    .setDescriptionLocalizations({
      tr: "Bir kullanıcının yasağını kaldırır",
    })
    .setContexts(0)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to unban")
        .setDescriptionLocalizations({
          tr: "Yasağı kaldırılacak kullanıcı",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({
          tr: "sebep",
        })
        .setDescription("The reason for unbanning the user")
        .setDescriptionLocalizations({
          tr: "Kullanıcının yasağının kaldırılma sebebi",
        }),
    ),
  async execute(interaction) {
    const client = interaction.client as KhaxyClient;
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    if (!rows[0]) {
      await interaction.reply("An error occurred while fetching the guild data.");
      return;
    }
    const t = client.i18next.getFixedT(rows[0].language, "commands", "unban");
    const user = interaction.options.getUser("user");
    if (!user) {
      await interaction.reply({ content: t("no_user"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const reason = interaction.options.getString("reason") || t("no_reason");
    try {
      await interaction.guild.members.unban(user, reason);
      await interaction.reply({
        content: t("success", {
          user: user.tag,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          case: rows[0].case_id,
        }),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: t("error", { error: error.message }),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      logger.error({
        message: `An error occurred while unbanning a user. Error: ${error.message}`,
        error,
        guild: interaction.guild.id,
        user: interaction.user.id,
      });
    }
    const result = await modLog(
      {
        guild: interaction.guild,
        action: "UNBAN",
        user,
        moderator: interaction.user,
        reason,
      },
      client,
    );
    if (result) {
      if (interaction.replied) {
        await interaction.followUp({ content: result.message });
      } else {
        await interaction.reply({ content: result.message, flags: MessageFlagsBitField.Flags.Ephemeral });
      }
    }
  },
} as SlashCommandBase;
