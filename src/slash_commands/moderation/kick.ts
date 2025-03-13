import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import logger from "../../lib/Logger.js";
import { toStringId } from "../../utils/utils.js";

export default {
  memberPermissions: [PermissionsBitField.Flags.KickMembers],
  clientPermissions: [PermissionsBitField.Flags.KickMembers],
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDescriptionLocalizations({
      tr: "Sunucudan bir üyeyi atar",
    })
    .setContexts(0)
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
    const client = interaction.client as KhaxyClient;
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    const t = client.i18next.getFixedT(rows[0].language || "en", "commands", "kick");

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
      member.roles.cache.has(toStringId(rows[0].staff_role_id))
    ) {
      await interaction.reply(t("cant_kick_mod"));
      return;
    }
    if (!member.kickable) {
      await interaction.reply(t("cant_kick"));
      return;
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
          case: rows[0].case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    } catch {
      await interaction.reply(
        t("message.fail", {
          user: member.user.tag,
          case: rows[0].case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      );
    }
  },
} as SlashCommandBase;
