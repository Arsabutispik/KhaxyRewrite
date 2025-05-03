import { SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import logger from "../../lib/Logger.js";
import modLog from "../../utils/modLog.js";
import { toStringId } from "../../utils/utils.js";
import { Guilds, Punishments } from "../../../@types/DatabaseTypes";

export default {
  memberPermissions: [PermissionsBitField.Flags.ManageRoles],
  clientPermissions: [PermissionsBitField.Flags.ManageRoles],
  data: new SlashCommandBuilder()
    .setName("unmute")
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
    const client = interaction.client;
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    const guild_config = rows[0];
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "unmute");
    const member = interaction.options.getMember("user");
    if (!member) {
      await interaction.reply({ content: t("no_member"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (!interaction.guild.roles.cache.has(toStringId(guild_config.mute_role_id))) {
      await interaction.reply({ content: t("no_mute_role"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const reason = interaction.options.getString("reason") || t("no_reason");
    const { rows: punishment_rows } = await client.pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE guild_id = $1 AND user_id = $2",
      [interaction.guild.id, member.id],
    );
    const punishment = punishment_rows[0];
    if (!punishment && member.roles.cache.has(toStringId(guild_config.mute_role_id))) {
      await interaction.reply({ content: t("muted_no_punishment"), flags: MessageFlagsBitField.Flags.Ephemeral });
      await member.roles.remove(toStringId(guild_config.mute_role_id));
      return;
    }
    if (!punishment) {
      await interaction.reply({ content: t("not_muted"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (guild_config.mute_get_all_roles) {
      try {
        await member.roles.set(punishment.previous_roles.map((id) => toStringId(id)));
      } catch (error) {
        await interaction.reply({ content: t("previous_roles_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
        logger.error({
          message: "An error occurred while setting the previous roles of a user",
          error,
          guild: interaction.guild.id,
        });
        return;
      }
    }
    try {
      await client.pgClient.query("DELETE FROM punishments WHERE user_id = $1", [punishment.user_id]);
    } catch (error) {
      await interaction.reply({ content: t("database_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
      logger.error({
        message: "An error occurred while unmuting a user",
        error,
        guild: interaction.guild.id,
      });
      return;
    }
    try {
      await member.roles.remove(toStringId(guild_config.mute_role_id));
    } catch (error) {
      await interaction.reply({ content: t("role_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
      logger.error({
        message: "An error occurred while removing the mute role from a user",
        error,
        guild: interaction.guild.id,
      });
      return;
    }
    try {
      await member.send(t("dm", { guild: interaction.guild.name }));
      await interaction.reply(
        t("success", {
          user: member.user.tag,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          case: guild_config.case_id,
        }),
      );
    } catch {
      await interaction.reply(t("dm_error", { user: member.user.tag }));
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
