import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds, Punishments } from "../../../@types/DatabaseTypes";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import logger from "../../lib/Logger.js";
import "dayjs/locale/tr.js";
import modLog from "../../utils/modLog.js";
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
          { name: "Second(s)", value: "second" },
          { name: "Minute(s)", value: "minute" },
          { name: "Hour(s)", value: "hour" },
          { name: "Day(s)", value: "day" },
          { name: "Week(s)", value: "week" },
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
    const client = interaction.client as KhaxyClient;
    const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
    const { rows: punishment_rows } = await client.pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE guild_id = $1 AND user_id = $2 AND type = 'mute'",
      [interaction.guild.id, interaction.user.id],
    );
    const t = client.i18next.getFixedT(rows[0].language, "commands", "mute");
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
    if (member.permissions.has(PermissionsBitField.Flags.ManageRoles) || member.roles.cache.has(rows[0].staff_role)) {
      await interaction.reply({ content: t("cant_mute_mod"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      await interaction.reply({ content: t("cant_mute_higher"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const muteRole = interaction.guild.roles.cache.get(rows[0].mute_role);
    if (!muteRole) {
      await interaction.reply({ content: t("no_mute_role"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (member.roles.cache.has(muteRole.id) && punishment_rows[0]) {
      await interaction.reply({ content: t("already_muted"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    } else if (member.roles.cache.has(muteRole.id) && !punishment_rows[0]) {
      await interaction.reply({
        content: t("already_muted_no_punishment"),
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      await member.roles.remove(muteRole);
      return;
    } else if (!member.roles.cache.has(muteRole.id) && punishment_rows[0]) {
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
      .locale(rows[0].language || "en")
      .fromNow(true);
    try {
      member.send(t("message.dm", { guild: interaction.guild.name, reason, duration: long_duration }));
      if (rows[0].mute_get_all_roles) {
        const filtered_roles = member.roles.cache
          .filter((role) => role.id !== interaction.guild!.id)
          .filter((role) => role.id !== interaction.guild!.roles.premiumSubscriberRole?.id)
          .filter((role) => role.position < interaction.guild!.members.me!.roles.highest.position)
          .map((role) => role.id);
        await client.pgClient.query(
          "INSERT INTO punishments (user_id, guild_id, type, staff_id, expires, created_at, previous_roles) VALUES ($1, $2, 'mute', $3, $4, $5, $6)",
          [
            member.id,
            interaction.guild.id,
            interaction.user.id,
            new Date(Date.now() + duration.asMilliseconds()),
            new Date(),
            filtered_roles,
          ],
        );
        await member.roles.set([muteRole.id]);
      } else {
        await client.pgClient.query(
          "INSERT INTO punishments (user_id, guild_id, type, staff_id, expires, created_at) VALUES ($1, $2, 'mute', $3, $4, $5)",
          [
            member.id,
            interaction.guild.id,
            interaction.user.id,
            new Date(Date.now() + duration.asMilliseconds()),
            new Date(),
          ],
        );
        await member.roles.add(muteRole);
      }
      await interaction.reply({
        content: t("message.success", {
          user: member.user.tag,
          duration: long_duration,
          confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          case: rows[0].case_id,
        }),
      });
    } catch (e) {
      await interaction.reply({ content: t("message.fail", { user: member.user.tag, duration: long_duration }) });
      await interaction.followUp({ content: `Error: ${e}` });
      logger.error({
        message: `Error while muting user ${member.user.tag} from guild ${interaction.guild.name}`,
        error: e,
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
    if (result)
      interaction.replied
        ? await interaction.followUp({ content: result.message, flags: MessageFlagsBitField.Flags.Ephemeral })
        : await interaction.reply({ content: result.message, flags: MessageFlagsBitField.Flags.Ephemeral });
  },
} as SlashCommandBase;
