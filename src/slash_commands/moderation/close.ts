import type { SlashCommandBase } from "@customTypes";
import { ModMailThreadStatus } from "@constants";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  MessageComponentInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
  MessageFlagsBitField,
  InteractionContextType,
} from "discord.js";
import dayjs from "dayjs";
import dayjsduration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import "dayjs/locale/tr.js";
import { logger } from "@lib";
import { modMailLog, toStringId } from "@utils";
import { getGuildConfig, getModMailThread, updateModMailThread } from "@database";
export default {
  memberPermissions: [PermissionsBitField.Flags.ModerateMembers],
  clientPermissions: [PermissionsBitField.Flags.ManageChannels],
  data: new SlashCommandBuilder()
    .setName("close")
    .setNameLocalizations({
      tr: "kapat",
    })
    .setDescription("Close the mod mail thread")
    .setDescriptionLocalizations({
      tr: "Mod mail kanalını kapat",
    })
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
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
        .addChoices(
          { name: "Second(s)", value: "second", name_localizations: { tr: "Saniye" } },
          { name: "Minute(s)", value: "minute", name_localizations: { tr: "Dakika" } },
          { name: "Hour(s)", value: "hour", name_localizations: { tr: "Saat" } },
          { name: "Day(s)", value: "day", name_localizations: { tr: "Gün" } },
          { name: "Week(s)", value: "week", name_localizations: { tr: "Hafta" } },
        ),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const guild_config = await getGuildConfig(interaction.guildId);
    if (!guild_config) {
      await interaction.reply({
        content: "Guild not found in the database. Please contact the bot developers as this shouldn't happen.",
        flags: MessageFlagsBitField.Flags.Ephemeral,
      });
      return;
    }
    const t = client.i18next.getFixedT(guild_config.language, "commands", "close");
    if (interaction.channel?.type !== ChannelType.GuildText) return interaction.reply(t("not_text_channel"));
    const mod_mail_thread = await getModMailThread(interaction.channelId);
    if (!mod_mail_thread) return interaction.reply(t("no_thread"));
    if (mod_mail_thread.close_date) {
      const close_date = dayjs(mod_mail_thread.close_date)
        .locale(guild_config.language || "en")
        .fromNow(true);
      const acceptButton = new ButtonBuilder()
        .setCustomId("accept")
        .setLabel(t("accept"))
        .setStyle(ButtonStyle.Success);
      const rejectButton = new ButtonBuilder().setCustomId("reject").setLabel(t("reject")).setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButton, rejectButton);
      const message = await interaction.reply({
        content: t("thread_close_date", { date: close_date }),
        components: [row],
        withResponse: true,
      });
      const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
      let component;
      try {
        component = await message.resource!.message!.awaitMessageComponent({
          filter,
          time: 60000,
          componentType: ComponentType.Button,
        });
      } catch {
        await interaction.editReply({ content: t("timeout"), components: [] });
      }
      if (!component) return;
      if (component.customId === "reject") {
        await interaction.editReply({ content: t("thread_close_date_rejected"), components: [] });
        return;
      } else {
        await interaction.editReply({ content: t("thread_close_date_accepted"), components: [] });
      }
    }
    const duration = interaction.options.getNumber("duration");
    const time = interaction.options.getString("time");
    if (duration && !time) return interaction.reply(t("no_time"));
    if (time && !duration) return interaction.reply(t("no_duration"));
    if (duration && time) {
      dayjs.extend(dayjsduration);
      dayjs.extend(relativeTime);
      const dayjs_duration = dayjs.duration(duration, time as dayjsduration.DurationUnitType);
      const long_duration = dayjs(dayjs().add(dayjs_duration))
        .locale(guild_config.language || "en")
        .fromNow(true);
      try {
        await updateModMailThread(interaction.channelId, {
          close_date: dayjs().add(dayjs_duration).toDate(),
          closer_id: BigInt(interaction.user.id),
        });
      } catch (e) {
        await interaction.reply(t("error"));
        logger.error({
          message: e.message,
          stack: e.stack,
        });
        return;
      }
      if (interaction.replied) {
        await interaction.editReply(t("close_duration", { duration: long_duration }));
      } else {
        await interaction.reply(t("close_duration", { duration: long_duration }));
      }
    } else {
      await updateModMailThread(interaction.channelId, {
        status: ModMailThreadStatus.CLOSED,
      });
      const modmail_log_channel = interaction.guild.channels.cache.get(toStringId(guild_config.mod_mail_channel_id));
      if (modmail_log_channel) {
        const user = await client.users.fetch(toStringId(mod_mail_thread.user_id)).catch(() => null);
        await modMailLog(client, interaction.channel!, user, interaction.user);
      }
      if (interaction.replied) {
        await interaction.editReply(t("close"));
      } else {
        await interaction.reply(t("close"));
      }
      await interaction.channel!.delete();
      try {
        await interaction.guild.members.cache
          .get(toStringId(mod_mail_thread.user_id))
          ?.send(t("thread_closed_dm", { guild: interaction.guild!.name }));
      } catch {
        return;
      }
    }
  },
} as SlashCommandBase;
