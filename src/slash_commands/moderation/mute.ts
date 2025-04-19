import { SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import logger from "../../lib/Logger.js";
import "dayjs/locale/tr.js";
import modLog from "../../utils/modLog.js";
import { toStringId } from "../../utils/utils.js";
export default {
  memberPermissions: [PermissionsBitField.Flags.ManageRoles],
  clientPermissions: [PermissionsBitField.Flags.ManageRoles],
  data: new SlashCommandBuilder()
    .setName("mute")
    .setNameLocalizations({
      tr: "sustur",
    })
    .setDescription("Mute a user")
    .setDescriptionLocalizations({
      tr: "Bir kullanıcıyı susturur",
    })
    .setContexts(0)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to mute")
        .setDescriptionLocalizations({
          tr: "Susturulacak kullanıcı",
        })
        .setRequired(true),
    )
    .addNumberOption((option) =>
      option
        .setName("duration")
        .setNameLocalizations({
          tr: "süre",
        })
        .setDescription("Duration of the ban (only numbers 1-99)")
        .setDescriptionLocalizations({
          tr: "Yasaklanma süresi (sadece sayılar 1-99)",
        })
        .setMinValue(1)
        .setMaxValue(99)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setNameLocalizations({
          tr: "vakit",
        })
        .setDescription("Time unit of the ban duration")
        .setDescriptionLocalizations({
          tr: "Yasaklanma süresinin birimi",
        })
        .setRequired(true)
        .setChoices(
          { name: "Second(s)", value: "second", name_localizations: { tr: "Saniye" } },
          { name: "Minute(s)", value: "minute", name_localizations: { tr: "Dakika" } },
          { name: "Hour(s)", value: "hour", name_localizations: { tr: "Saat" } },
          { name: "Day(s)", value: "day", name_localizations: { tr: "Gün" } },
          { name: "Week(s)", value: "week", name_localizations: { tr: "Hafta" } },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({
          tr: "sebep",
        })
        .setDescription("The reason for muting the user")
        .setDescriptionLocalizations({
          tr: "Kullanıcının susturulma sebebi",
        }),
    ),
  async execute(interaction) {
    dayjs.extend(dayjsduration);
    dayjs.extend(relativeTime);
    const client = interaction.client;
    const guild_config = await client.getGuildConfig(interaction.guild.id);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "mute");
    const member = interaction.options.getMember("user");
    if (!member) {
      await interaction.reply({ content: t("no_user"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.user.bot) {
      await interaction.reply({ content: t("cant_mute_bot"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.id === interaction.user.id) {
      await interaction.reply({ content: t("cant_mute_yourself"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (
      member.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
      member.roles.cache.has(toStringId(guild_config.staff_role_id))
    ) {
      await interaction.reply({ content: t("cant_mute_mod"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      await interaction.reply({ content: t("cant_mute_higher"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const muteRole = interaction.guild.roles.cache.get(toStringId(guild_config.mute_role_id));
    if (!muteRole) {
      await interaction.reply({ content: t("no_mute_role"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const punishment_rows = await client.getPunishments(interaction.guild.id, member.id, "mute");
    if (member.roles.cache.has(muteRole.id) && punishment_rows) {
      await interaction.reply({ content: t("already_muted"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    } else if (member.roles.cache.has(muteRole.id) && !punishment_rows) {
      await interaction.reply({
        content: t("already_muted_no_punishment"),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      await member.roles.remove(muteRole);
      return;
    } else if (!member.roles.cache.has(muteRole.id) && punishment_rows) {
      await interaction.reply({ content: t("not_muted"), flags: MessageFlagsBitField.Flags.Ephemeral });
      await member.roles.add(muteRole);
      return;
    }
    const reason = interaction.options.getString("reason") || t("no_reason");
    const duration = dayjs.duration(
      interaction.options.getNumber("duration", true),
      interaction.options.getString("time", true) as dayjsduration.DurationUnitType,
    );
    const long_duration = dayjs(dayjs().add(duration))
      .locale(guild_config.language || "en")
      .fromNow(true);
    if (guild_config.mute_get_all_roles) {
      const filtered_roles = member.roles.cache
        .filter((role) => role.id !== interaction.guild!.id)
        .filter((role) => role.id !== interaction.guild!.roles.premiumSubscriberRole?.id)
        .filter((role) => role.position < interaction.guild!.members.me!.roles.highest.position)
        .map((role) => role.id);
      try {
        await client.pgClient.query(
          "INSERT INTO punishments (user_id, guild_id, type, staff_id, expires, created_at, previous_roles) VALUES (pgp_sym_encrypt($1, $7), pgp_sym_encrypt($2, $7), pgp_sym_encrypt('mute', $7), pgp_sym_encrypt($3, $7), pgp_sym_encrypt($4, $7), pgp_sym_encrypt($5, $7), pgp_sym_encrypt($6::text, $7))",
          [
            member.id,
            interaction.guild.id,
            interaction.user.id,
            new Date(Date.now() + duration.asMilliseconds()),
            new Date(),
            filtered_roles,
            process.env.PASSPHRASE,
          ],
        );
      } catch (error) {
        await interaction.reply({ content: t("database_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
        logger.error({
          message: `Error while putting punishments to database for user ${member.user.tag} from guild ${interaction.guild.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
      try {
        await member.roles.set([muteRole.id]);
      } catch (error) {
        await interaction.reply({ content: t("role_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
        logger.error({
          message: `Error while setting roles for user ${member.user.tag} from guild ${interaction.guild.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
    } else {
      try {
        await client.pgClient.query(
          "INSERT INTO punishments (user_id, guild_id, type, staff_id, expires, created_at) VALUES (pgp_sym_encrypt($1, $6), pgp_sym_encrypt($2, $6), pgp_sym_encrypt('mute', $6), pgp_sym_encrypt($3, $6), pgp_sym_encrypt($4, $6), pgp_sym_encrypt($5, $6))",
          [
            member.id,
            interaction.guild.id,
            interaction.user.id,
            new Date(Date.now() + duration.asMilliseconds()),
            new Date(),
            process.env.PASSPHRASE,
          ],
        );
      } catch (error) {
        await interaction.reply({ content: t("database_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
        logger.error({
          message: `Error while putting punishments to database for user ${member.user.tag} from guild ${interaction.guild.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
      try {
        await member.roles.add(muteRole);
      } catch (error) {
        await interaction.reply({ content: t("role_error"), flags: MessageFlagsBitField.Flags.Ephemeral });
        logger.error({
          message: `Error while setting roles for user ${member.user.tag} from guild ${interaction.guild.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
    }
    try {
      await member.send(t("message.dm", { guild: interaction.guild.name, reason, duration: long_duration }));
      await interaction.reply({
        content: t("message.success", {
          user: member.user.tag,
          duration: long_duration,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          case: guild_config.case_id,
        }),
      });
    } catch {
      await interaction.reply({
        content: t("message.fail", {
          user: member.user.tag,
          duration: long_duration,
          case: guild_config.case_id,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
        }),
      });
    }
    const result = await modLog(
      {
        guild: interaction.guild,
        user: member.user,
        action: "MUTE",
        moderator: interaction.user,
        reason,
        duration: dayjs().add(duration),
      },
      client,
    );
    if (result) {
      if (interaction.replied) {
        await interaction.followUp(result.message);
      } else {
        await interaction.reply(result.message);
      }
    }
  },
} as SlashCommandBase;
