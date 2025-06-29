import { SlashCommandBase } from "@customTypes";
import { EmbedBuilder, MessageFlagsBitField, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import {
  getGuildConfig,
  addToModmailBlacklist,
  removeFromModmailBlacklist,
  getModmailBlacklistByUser,
} from "@database";
import dayjs from "dayjs";
import { logger } from "@lib";
import "dayjs/locale/en.js";
import "dayjs/locale/tr.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(relativeTime);
export default {
  memberPermissions: [PermissionsBitField.Flags.ManageMessages],
  data: new SlashCommandBuilder()
    .setName("modmail-blacklist")
    .setNameLocalizations({
      tr: "modmail-karaliste",
    })
    .setDescription("Blacklist a user from modmail so they cannot open tickets")
    .setDescriptionLocalizations({
      tr: "Modmail'den bir kullanıcıyı kara listeye alarak bilet açmasını engeller",
    })
    .addSubcommand((option) =>
      option
        .setName("add")
        .setNameLocalizations({
          tr: "ekle",
        })
        .setDescription("Add a user to the modmail blacklist")
        .setDescriptionLocalizations({
          tr: "Bir kullanıcıyı modmail kara listesine ekler",
        })
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({
              tr: "kullanıcı",
            })
            .setDescription("The user to blacklist")
            .setDescriptionLocalizations({
              tr: "Kara listeye alınacak kullanıcı",
            })
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setNameLocalizations({
              tr: "sebep",
            })
            .setDescription("The reason for blacklisting the user")
            .setDescriptionLocalizations({
              tr: "Kullanıcının kara listeye alınma sebebi",
            })
            .setRequired(false),
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
    )
    .addSubcommand((option) =>
      option
        .setName("remove")
        .setNameLocalizations({
          tr: "kaldır",
        })
        .setDescription("Remove a user from the modmail blacklist")
        .setDescriptionLocalizations({
          tr: "Bir kullanıcıyı modmail kara listesinden kaldırır",
        })
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({
              tr: "kullanıcı",
            })
            .setDescription("The user to remove from the blacklist")
            .setDescriptionLocalizations({
              tr: "Kara listeden kaldırılacak kullanıcı",
            })
            .setRequired(true),
        ),
    )
    .addSubcommand((option) =>
      option
        .setName("get")
        .setNameLocalizations({
          tr: "bul",
        })
        .setDescription("Get the modmail blacklist of an user")
        .setDescriptionLocalizations({
          tr: "Bir kullanıcının modmail kara listesini getirir",
        })
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({
              tr: "kullanıcı",
            })
            .setDescription("The user to get the blacklist for")
            .setDescriptionLocalizations({
              tr: "Kara listesini almak istediğiniz kullanıcı",
            })
            .setRequired(true),
        ),
    ),
  async execute(interaction) {
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "This server is not registered in the database. This shouldn't happen, please contact developers",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = interaction.client.i18next.getFixedT(guild_config.language, "commands", "modmail-blacklist");
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand === "add") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || t("no_reason");
      const duration = interaction.options.getNumber("duration");
      const time = interaction.options.getString("time");
      if (user.id === interaction.user.id) {
        await interaction.reply({
          content: t("cannot_blacklist_self"),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
        return;
      }
      if (user.bot) {
        await interaction.reply({
          content: t("cannot_blacklist_bot"),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
        return;
      }
      if (duration && !time) {
        await interaction.reply({
          content: t("duration_without_time"),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
        return;
      }
      if (!duration && time) {
        await interaction.reply({
          content: t("time_without_duration"),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
        return;
      }
      try {
        await addToModmailBlacklist(interaction.guildId, user.id, {
          reason,
          created_at: dayjs().toDate(),
          expires_at:
            duration && time
              ? dayjs()
                  .add(duration, time as dayjs.ManipulateType)
                  .toDate()
              : null,
          moderator_id: BigInt(interaction.user.id),
        });
        await interaction.reply({
          content: t("blacklist_success", {
            confirm: interaction.client.allEmojis.get(interaction.client.config.Emojis.confirm)?.format,
            user: user.toString(),
            reason,
            duration: duration
              ? dayjs()
                  .add(duration, time as dayjs.ManipulateType)
                  .locale(guild_config.language)
                  .fromNow(true)
              : interaction.client.allEmojis.get(interaction.client.config.Emojis.infinity)?.format,
          }),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
      } catch (error) {
        logger.log({
          level: "error",
          message: `Error while blacklisting user ${user.id} in guild ${interaction.guildId}`,
          error,
        });
        await interaction.reply({
          content: t("blacklist_error"),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
      }
    } else if (subcommand === "remove") {
      const user = interaction.options.getUser("user", true);
      try {
        const result = await removeFromModmailBlacklist(interaction.guildId, user.id);
        if (result.count === 0) {
          await interaction.reply({
            content: t("blacklist_remove.not_found", { user: user.toString() }),
            flags: MessageFlagsBitField.Flags.Ephemeral,
          });
          return;
        }
        await interaction.reply({
          content: t("blacklist_remove.success", {
            confirm: interaction.client.allEmojis.get(interaction.client.config.Emojis.confirm)?.format,
            user: user.toString(),
          }),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
      } catch (error) {
        logger.log({
          level: "error",
          message: `Error while removing user ${user.id} from blacklist in guild ${interaction.guildId}`,
          error,
        });
        await interaction.reply({
          content: t("blacklist_remove.error"),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
      }
    } else if (subcommand === "get") {
      const user = interaction.options.getUser("user", true);
      const blacklist = await getModmailBlacklistByUser(interaction.guildId, user.id);
      if (!blacklist) {
        await interaction.reply({
          content: t("blacklist_get.not_found", { user: user.toString() }),
          flags: MessageFlagsBitField.Flags.Ephemeral,
        });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(t("blacklist_get.embed.title", { user: user.username }))
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
        .setColor("Random")
        .addFields([
          {
            name: t("blacklist_get.embed.fields.reason"),
            value: blacklist.reason,
            inline: true,
          },
          {
            name: t("blacklist_get.embed.fields.created_at"),
            value: dayjs(blacklist.created_at).format("YYYY-MM-DD HH:mm:ss"),
            inline: true,
          },
          {
            name: t("blacklist_get.embed.fields.expires_at"),
            value: blacklist.expires_at
              ? dayjs(blacklist.expires_at).format("YYYY-MM-DD HH:mm:ss")
              : interaction.client.allEmojis.get(interaction.client.config.Emojis.infinity)!.format,
            inline: true,
          },
          {
            name: t("blacklist_get.embed.fields.moderator"),
            value: `<@${blacklist.moderator_id}>`,
            inline: true,
          },
        ]);
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
    }
  },
} as SlashCommandBase;
