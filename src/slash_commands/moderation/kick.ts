import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { logger } from "@lib";
import { toStringId, addInfraction, modlog } from "@utils";
import { getGuildConfig } from "@database";
import { InfractionType } from "@constants";

export default {
  memberPermissions: [PermissionsBitField.Flags.KickMembers],
  clientPermissions: [PermissionsBitField.Flags.KickMembers],
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDescriptionLocalizations({
      tr: "Sunucudan bir üyeyi atar",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to kick")
        .setDescriptionLocalizations({
          tr: "Atılacak kullanıcı",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({
          tr: "sebep",
        })
        .setDescription("The reason for the kick")
        .setDescriptionLocalizations({
          tr: "Atılma sebebi",
        }),
    )
    .addBooleanOption((option) =>
      option
        .setName("clear")
        .setNameLocalizations({
          tr: "temizle",
        })
        .setDescription("Clears up to 7 days of messages from the user")
        .setDescriptionLocalizations({
          tr: "Kullanıcının en fazla 7 günlük mesajlarını temizler",
        }),
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
    const t = client.i18next.getFixedT(guild_config.language || "en", "commands", "kick");

    const member = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || t("no_reason");
    const clear = interaction.options.getBoolean("clear") || false;
    if (!member) {
      await interaction.reply(t("no_member"));
      return;
    }
    if (member.id === interaction.user.id) {
      await interaction.reply(t("cant_kick_yourself"));
      return;
    }
    if (member.user.bot) {
      await interaction.reply(t("cant_kick_bot"));
      return;
    }
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      await interaction.reply(t("cant_kick_higher"));
      return;
    }
    if (
      member.permissions.has(PermissionsBitField.Flags.KickMembers) ||
      member.roles.cache.has(toStringId(guild_config.staff_role_id))
    ) {
      await interaction.reply(t("cant_kick_mod"));
      return;
    }
    if (!member.kickable) {
      await interaction.reply(t("cant_kick"));
      return;
    }
    await addInfraction({
      guild: interaction.guild,
      member: member.id,
      reason,
      type: InfractionType.KICK,
      moderator: interaction.user.id,
      client,
    });
    try {
      await member.send(
        t("message.dm", {
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          guild: interaction.guild.name,
          reason,
        }),
      );
      await interaction.reply(
        t("message.success", {
          user: member.user.tag,
          case: guild_config.case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    } catch {
      await interaction.reply(
        t("message.fail", {
          user: member.user.tag,
          case: guild_config.case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    }
    if (clear) {
      try {
        await member.ban({ reason: `Softban- ${reason}`, deleteMessageSeconds: 604800 });
        await interaction.guild.members.unban(member, "softban");
      } catch (error) {
        await interaction.reply(t("clear_fail"));
        logger.error({
          message: `Error while banning user ${member.user.tag} from guild ${interaction.guild.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
      }
    } else {
      try {
        await member.kick(reason);
      } catch (error) {
        await interaction.reply(t("fail"));
        logger.error({
          message: `Error while kicking user ${member.user.tag} from guild ${interaction.guild.name}`,
          error,
          guild: interaction.guild.id,
          user: interaction.user.id,
        });
      }
    }
    const reply = await modlog(
      { guild: interaction.guild, action: "KICK", user: member.user, moderator: interaction.user, reason: reason },
      interaction.client,
    );
    if (reply) {
      if (interaction.replied) {
        await interaction.followUp(reply.message);
      } else {
        await interaction.reply(reply.message);
      }
    }
  },
} as SlashCommandBase;
