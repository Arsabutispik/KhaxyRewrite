import { KhaxyClient, SlashCommandBase } from "../../../@types/types";
import { MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Guilds } from "../../../@types/DatabaseTypes";
import ms from "ms";
import modLog from "../../utils/modLog.js";
import dayjs from "dayjs";
import logger from "../../lib/Logger.js";
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
          { name: "Second(s)", value: "s" },
          { name: "Minute(s)", value: "m" },
          { name: "Hour(s)", value: "h" },
          { name: "Day(s)", value: "d" },
          { name: "Week(s)", value: "w" },
        ),
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply("Guild not cached. This error should not happen.");
      return;
    }
    const client = interaction.client as KhaxyClient;
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
    if (user.id === interaction.client.user!.id) {
      await interaction.reply({ content: t("cant_ban_me"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    if (user.bot) {
      await interaction.reply({ content: t("cant_ban_bot"), flags: MessageFlagsBitField.Flags.Ephemeral });
      return;
    }
    const member = interaction.guild!.members.cache.get(user.id);
    if (
      member &&
      (member.permissions.has(PermissionsBitField.Flags.BanMembers) || member.roles.cache.has(rows[0].staff_role))
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
      const banDuration = ms(`${duration}${time}` as ms.StringValue);
      let longDuration = ms(banDuration, { long: true });
      if (rows[0].language === "tr") {
        longDuration = longDuration
          .replace(/minutes|minute/, "dakika")
          .replace(/hours|hour/, "saat")
          .replace(/days|day/, "gün");
      }
      try {
        await user.send(t("message.dm.duration", { guild: interaction.guild!.name, reason, duration: longDuration }));
        await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: 604800 });
        await interaction.reply({
          content: t("message.success.duration", {
            user: user.tag,
            duration: longDuration,
            case: rows[0].case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
      } catch (e) {
        await interaction.reply({
          content: t("message.fail.duration", {
            user: user.tag,
            duration: longDuration,
            case: rows[0].case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
        logger.error({
          message: `Error while banning user ${user.tag} from guild ${interaction.guild!.name}`,
          error: e,
        });
      }
      const reply = await modLog(
        {
          guild: interaction.guild!,
          user,
          action: "TIMED_BAN",
          moderator: interaction.user,
          reason,
          duration: dayjs(Date.now() + banDuration),
          caseID: rows[0].case_id,
        },
        client,
      );
      if (reply) {
        interaction.replied ? await interaction.followUp(reply.message) : await interaction.reply(reply.message);
      }
      try {
        await (interaction.client as KhaxyClient).pgClient.query(
          "INSERT INTO punishments (expires, type, user_id, guild_id, staff_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [new Date(Date.now() + banDuration), "BAN", user.id, interaction.guild!.id, interaction.user.id, new Date()],
        );
      } catch (e) {
        logger.error({
          message: `Error while inserting punishment for user ${user.tag} from guild ${interaction.guild!.name}`,
          error: e,
        });
      }
    } else {
      try {
        await user.send(t("message.dm.permanent", { guild: interaction.guild!.name, reason }));
        await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: 604800 });
        await interaction.reply({
          content: t("message.success.permanent", {
            user: user.tag,
            case: rows[0].case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
      } catch (e) {
        await interaction.reply({
          content: t("message.fail.permanent", {
            user: user.tag,
            case: rows[0].case_id,
            confirm: client.allEmojis.get(client.config.Emojis.confirm)?.format,
          }),
        });
        logger.error({
          message: `Error while banning user ${user.tag} from guild ${interaction.guild!.name}`,
          error: e,
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
        interaction.replied ? await interaction.followUp(reply.message) : await interaction.reply(reply.message);
      }
    }
  },
} as SlashCommandBase;
