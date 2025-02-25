import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds, Punishments } from "../../../@types/DatabaseTypes";
import logger from "../../lib/Logger.js";
import modLog from "../../utils/modLog.js";

export default {
  memberPermissions: [PermissionsBitField.Flags.ManageRoles],
  clientPermissions: [PermissionsBitField.Flags.ManageRoles],
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setNameLocalizations({
      tr: "susturmayı-kaldır",
    })
    .setDescription("Unmute a user")
    .setDescriptionLocalizations({
      tr: "Bir kullanıcının susturmasını kaldırır",
    })
    .setContexts(0)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to unmute")
        .setDescriptionLocalizations({
          tr: "Susturması kaldırılacak kullanıcı",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({
          tr: "sebep",
        })
        .setDescription("The reason for unmuting the user")
        .setDescriptionLocalizations({
          tr: "Kullanıcının susturmasının kaldırılma sebebi",
        }),
    ),
  async execute(interaction) {
    const client = interaction.client as KhaxyClient;
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    if (!rows[0]) {
      await interaction.reply("An error occurred while fetching the guild data.");
      return;
    }
    const t = client.i18next.getFixedT(rows[0].language, "commands", "unmute");
    const member = interaction.options.getMember("user");
    if (!member) {
      await interaction.reply({ content: t("no_member"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const reason = interaction.options.getString("reason") || t("no_reason");
    const { rows: punishment_rows } = await client.pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE guild_id = $1 AND user_id = $2 AND type = 'mute'",
      [interaction.guild.id, member.id],
    );
    if (!punishment_rows[0]) {
      await interaction.reply({ content: t("not_muted"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (!punishment_rows[0] && member.roles.cache.has(rows[0].mute_role)) {
      await interaction.reply({ content: t("not_muted_no_punishment"), flags: MessageFlagsBitField.Flags.Ephemeral });
      await member.roles.remove(rows[0].mute_role);
      return;
    }
    try {
      await client.pgClient.query("DELETE FROM punishments WHERE user_id = $1", [punishment_rows[0].user_id]);
      await member.roles.remove(rows[0].mute_role);
      await interaction.reply({
        content: t("success", {
          user: member.user.tag,
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
        message: `An error occurred while unmuting a user. Error: ${error.message}`,
        error,
        guild: interaction.guild.id,
        user: interaction.user.id,
      });
    }
    const result = await modLog(
      {
        guild: interaction.guild,
        action: "UNMUTE",
        user: member.user,
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
