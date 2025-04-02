import { SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import modLog from "../../utils/modLog.js";
import "dayjs/locale/tr.js";
import logger from "../../lib/Logger.js";
import { toStringId } from "../../utils/utils.js";

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
    .setContexts(0)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addUserOption((option) =>
      option
        .setName("user")
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
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild!.id]);
    if (rows.length === 0) {
      await interaction.reply({
        content: "No guild data found, this shouldn't happen.",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(rows[0].language || "en", "commands", "ban");
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
        member.roles.cache.has(toStringId(rows[0].staff_role_id)))
    ) {
      await interaction.reply({ content: t("cant_ban_mod"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
      await interaction.reply({ content: t("cant_ban_higher"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }

    const reason = interaction.options.getString("reason") || t("no_reason");
    const duration = interaction.options.getNumber("duration");
    const time = interaction.options.getString("time");
    if (duration && time) {
      const dayjsduration = dayjs.duration(duration, time as dayjsduration.DurationUnitType);
      const long_duration = dayjs(dayjs().add(dayjsduration))
        .locale(rows[0].language || "en")
        .fromNow(true);
      try {
        await interaction.client.pgClient.query(
          "INSERT INTO punishments (expires, type, user_id, guild_id, staff_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            new Date(Date.now() + dayjsduration.asMilliseconds()),
            "BAN",
            user.id,
            interaction.guild!.id,
            interaction.user.id,
            new Date(),
          ],
        );
      } catch (error) {
        await interaction.reply(t("database_error"));
        logger.error({
          message: `Error while inserting punishment for user ${user.tag} from guild ${interaction.guild!.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
      try {
        await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: 604800 });
      } catch (error) {
        await interaction.reply(t("failed_to_ban", { user: user.tag }));
        logger.error({
          message: `Error while banning user ${user.tag} from guild ${interaction.guild!.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
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
          await interaction.reply({
            content: t("message.success.duration", {
              user: user.tag,
              duration: long_duration,
              case: rows[0].case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        } else {
          await interaction.reply({
            content: t("message.success.duration_no_member", {
              user: user.tag,
              duration: long_duration,
              case: rows[0].case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        }
      } catch {
        await interaction.reply({
          content: t("message.fail.duration", {
            user: user.tag,
            duration: long_duration,
            case: rows[0].case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
      }
      const reply = await modLog(
        {
          guild: interaction.guild!,
          user,
          action: "TIMED_BAN",
          moderator: interaction.user,
          reason,
          duration: dayjs(Date.now() + dayjsduration.asMilliseconds()),
          caseID: rows[0].case_id,
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
        await interaction.client.pgClient.query(
          "INSERT INTO punishments (type, user_id, guild_id, staff_id, created_at) VALUES ($1, $2, $3, $4, $5)",
          ["BAN", user.id, interaction.guild!.id, interaction.user.id, new Date()],
        );
      } catch (e) {
        await interaction.reply(t("database_error"));
        logger.error({
          message: `Error while inserting punishment for user ${user.tag} from guild ${interaction.guild!.name}`,
          error: e,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
        return;
      }
      try {
        await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: 604800 });
      } catch (error) {
        await interaction.reply(t("failed_to_ban", { user: user.tag }));
        logger.error({
          message: `Error while banning user ${user.tag} from guild ${interaction.guild!.name}`,
          error,
          guild: `${interaction.guild.name} (${interaction.guild.id})`,
          user: `${interaction.user.tag} (${interaction.user.id})`,
        });
      }
      try {
        if (member) {
          await user.send(t("message.dm.permanent", { guild: interaction.guild!.name, reason }));

          await interaction.reply({
            content: t("message.success.permanent", {
              user: user.tag,
              case: rows[0].case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        } else {
          await interaction.reply({
            content: t("message.success.permanent_no_member", {
              user: user.tag,
              case: rows[0].case_id,
              confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
            }),
          });
        }
      } catch {
        await interaction.reply({
          content: t("message.fail.permanent", {
            user: user.tag,
            case: rows[0].case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
      }
      const reply = await modLog(
        {
          guild: interaction.guild!,
          user,
          action: "BAN",
          moderator: interaction.user,
          reason,
          caseID: rows[0].case_id,
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
