import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageComponentInteraction,
  MessageFlagsBitField,
  StringSelectMenuBuilder,
} from "discord.js";
import { getGuildConfig, updateGuildConfig } from "@database";
import type { guilds as Guilds } from "@prisma/client";
import type { TFunction } from "i18next";
import { dynamicChannel, dynamicMessage } from "./register-config.js";
import { localeFlags } from "@constants";

export async function miscConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client;
  const guild_config = await getGuildConfig(interaction.guildId!);
  if (!guild_config) {
    await interaction.reply({
      content: "No guild config found. Running a simple command should create one.",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }

  const t = client.i18next.getFixedT(guild_config.language, null, "misc_config");
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("misc_config")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions([
      {
        label: t("language.label"),
        value: "language",
        description: t("language.description"),
      },
      {
        label: t("mod_mail_message.label"),
        value: "mod_mail_message",
        description: t("mod_mail_message.description"),
      },
      {
        label: t("bump_leaderboard_channel_id.label"),
        value: "leaderboard",
        description: t("bump_leaderboard_channel_id.description"),
      },
    ]);
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(select_menu);
  const reply = await interaction.reply({
    content: t("initial"),
    components: [action_row],
    flags: MessageFlagsBitField.Flags.Ephemeral,
    withResponse: true,
  });
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id && i.customId === "misc_config";
  let message_component;
  try {
    message_component = await reply.resource!.message!.awaitMessageComponent({
      filter,
      time: 1000 * 60,
      componentType: ComponentType.StringSelect,
    });
  } catch {
    await reply.resource!.message!.edit({ content: t("timeout"), components: [] }).catch(() => null);
    return;
  }
  if (!message_component.inCachedGuild()) {
    await message_component.deferUpdate();
    await message_component.editReply({
      content: "Not cached, unexpected error",
      components: [],
    });
    return;
  }

  switch (message_component.values[0]) {
    case "language":
      await message_component.deferUpdate();
      await languageConfig(message_component, guild_config, t);
      break;
    case "mod_mail_message":
      await dynamicMessage("mod_mail_message", message_component, guild_config, t);
      break;
    case "leaderboard":
      await dynamicChannel("bump_leaderboard_channel_id", message_component, guild_config, t);
  }
}

async function languageConfig(interaction: MessageComponentInteraction, data: Guilds, t: TFunction) {
  const client = interaction.client;
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("language")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions(
      [
        {
          label: localeFlags["en-GB"],
          value: "en-GB",
          description: "English",
          emoji: "🇬🇧",
        },
        {
          label: localeFlags["tr-TR"],
          value: "tr-TR",
          description: "Türkçe",
          emoji: "🇹🇷",
        },
      ].map((option) => {
        if (option.value === data.language) {
          // @ts-expect-error - This is a valid property
          option.default = true;
        }
        return option;
      }),
    );
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(select_menu);
  const result = await interaction.editReply({
    content: t("language.initial"),
    components: [action_row],
  });
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id && i.customId === "language";
  let message_component;
  try {
    message_component = await result.awaitMessageComponent({
      filter,
      time: 1000 * 60,
      componentType: ComponentType.StringSelect,
    });
  } catch {
    await interaction.editReply({ content: t("timeout"), components: [] });
    return;
  }
  if (!message_component.inCachedGuild()) {
    await message_component.deferUpdate();
    await message_component.editReply({
      content: "Not cached, unexpected error",
      components: [],
    });
    return;
  }
  await message_component.deferUpdate();
  await updateGuildConfig(message_component.guildId, {
    language: message_component.values[0],
  });
  const new_t = client.i18next.getFixedT(message_component.values[0], null, "misc_config");
  await message_component.editReply({
    content: new_t("language.set", { language: localeFlags[message_component.values[0]] }),
    components: [],
  });
}
