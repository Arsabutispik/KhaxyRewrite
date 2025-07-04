import type { SlashCommandBase } from "@customTypes";
import { InteractionContextType, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { modlog, toStringId, addInfraction } from "@utils";
import "dayjs/locale/tr.js";
import { logger } from "@lib";
import { createPunishment, getGuildConfig } from "@database";
import { InfractionType, PunishmentType } from "@constants";

export default {
  memberPermissions: [PermissionsBitField.Flags.BanMembers],
  clientPermissions: [PermissionsBitField.Flags.BanMembers],
  data: new SlashCommandBuilder()
    .setName("ban")
    .setNameLocalizations({
      tr: "yasakla",
    })
    .setDescription("Ban a user from the server.")
    .setDescriptionLocalizations({
      tr: "Sunucudan bir kullanıcıyı yasaklar.",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          tr: "kullanıcı",
        })
        .setDescription("The user to ban.")
        .setDescriptionLocalizations({
          tr: "Yasaklanacak kullanıcı.",
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("The reason for the ban.").setDescriptionLocalizations({
        tr: "Yasaklama sebebi.",
      }),
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
        .setRequired(false),
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
        .setRequired(false)
        .setChoices(
          { name: "Second(s)", value: "second", name_localizations: { tr: "Saniye" } },
          { name: "Minute(s)", value: "minute", name_localizations: { tr: "Dakika" } },
          { name: "Hour(s)", value: "hour", name_localizations: { tr: "Saat" } },
          { name: "Day(s)", value: "day", name_localizations: { tr: "Gün" } },
          { name: "Week(s)", value: "week", name_localizations: { tr: "Hafta" } },
        ),
    ),
  async execute(interaction) {
    dayjs.extend(dayjsduration);
    dayjs.extend(relativeTime);
    const client = interaction.client;
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language || "en", "commands", "ban");
    const user = interaction.options.getUser("user", true);
    if (user.id === interaction.user.id) {
      await interaction.reply({ content: t("cant_ban_self"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (user.bot) {
      await interaction.reply({ content: t("cant_ban_bot"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const member = interaction.guild!.members.cache.get(user.id);
    if (
      member &&
      (member.permissions.has(PermissionsBitField.Flags.BanMembers) ||
        member.roles.cache.has(toStringId(guild_config.staff_role_id)))
    ) {
      await interaction.reply({ content: t("cant_ban_mod"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
      await interaction.reply({ content: t("cant_ban_higher"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    await interaction.deferReply();
    const reason = interaction.options.getString("reason") || t("no_reason");
    const duration = interaction.options.getNumber("duration");
    const time = interaction.options.getString("time");
    if (duration && time) {
      const dayjsduration = dayjs.duration(duration, time as dayjsduration.DurationUnitType);
      const long_duration = dayjs(dayjs().add(dayjsduration))
        .locale(guild_config.language || "en")
        .fromNow(true);

      try {
        await createPunishment(interaction.guildId, {
          type: PunishmentType.BAN,
          created_at: new Date(),
          expires_at: new Date(Date.now() + dayjsduration.asMilliseconds()),
          user_id: BigInt(user.id),
          staff_id: BigInt(interaction.user.id),
        });
        await addInfraction({
          guild: interaction.guild!,
          member: user.id,
          reason,
          type: InfractionType.BAN,
          moderator: interaction.user.id,
          client,
        });
      } catch (error) {
        await interaction.editReply(t("database_error"));
        logger.error({
          message: `Error while inserting punishment/infraction for user ${user.tag} from guild ${interaction.guild!.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
      try {
        if (member) {
          await user.send(
            t("message.dm.duration", {
              guild: interaction.guild!.name,
              reason,
              duration: long_duration,
            }),
          );
          await interaction.editReply({
            content: t("message.success.duration", {
              user: user.tag,
              duration: long_duration,
              case: guild_config.case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        } else {
          await interaction.editReply({
            content: t("message.success.duration_no_member", {
              user: user.tag,
              duration: long_duration,
              case: guild_config.case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        }
      } catch {
        await interaction.editReply({
          content: t("message.fail.duration", {
            user: user.tag,
            duration: long_duration,
            case: guild_config.case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
      }
      try {
        await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: 604800 });
      } catch (error) {
        await interaction.editReply(t("failed_to_ban", { user: user.tag }));
        logger.error({
          message: `Error while banning user ${user.tag} from guild ${interaction.guild!.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
      }
      const reply = await modlog(
        {
          guild: interaction.guild!,
          user,
          action: "TIMED_BAN",
          moderator: interaction.user,
          reason,
          duration: dayjs(Date.now() + dayjsduration.asMilliseconds()),
          caseID: guild_config.case_id,
        },
        client,
      );
      if (reply) {
        if (interaction.replied) {
          await interaction.followUp(reply.message);
        } else {
          await interaction.reply(reply.message);
        }
      }
    } else {
      try {
        await addInfraction({
          guild: interaction.guild,
          member: user.id,
          reason,
          type: InfractionType.BAN,
          moderator: interaction.user.id,
          client,
        });
      } catch (e) {
        await interaction.editReply(t("database_error"));
        logger.error({
          message: `Error while inserting infraction for user ${user.tag} from guild ${interaction.guild!.name}`,
          error: e,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
      try {
        if (member) {
          await user.send(t("message.dm.permanent", { guild: interaction.guild!.name, reason }));

          await interaction.editReply({
            content: t("message.success.permanent", {
              user: user.tag,
              case: guild_config.case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        } else {
          await interaction.editReply({
            content: t("message.success.permanent_no_member", {
              user: user.tag,
              case: guild_config.case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        }
      } catch {
        await interaction.editReply({
          content: t("message.fail.permanent", {
            user: user.tag,
            case: guild_config.case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
      }
      try {
        await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: 604800 });
      } catch (error) {
        await interaction.editReply(t("failed_to_ban", { user: user.tag }));
        logger.error({
          message: `Error while banning user ${user.tag} from guild ${interaction.guild!.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
      }
      const reply = await modlog(
        {
          guild: interaction.guild!,
          user,
          action: "BAN",
          moderator: interaction.user,
          reason,
          caseID: guild_config.case_id,
        },
        client,
      );
      if (reply) {
        if (interaction.replied) {
          await interaction.followUp(reply.message);
        } else {
          await interaction.reply(reply.message);
        }
      }
    }
  },
} as SlashCommandBase;
