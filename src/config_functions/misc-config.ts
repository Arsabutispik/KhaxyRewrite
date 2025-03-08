import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageComponentInteraction,
  MessageFlagsBitField,
  StringSelectMenuBuilder,
} from "discord.js";
import { KhaxyClient } from "../../@types/types";
import { Guilds } from "../../@types/DatabaseTypes";
import { TFunction } from "i18next";
import { dynamicMessage } from "./register-config.js";

export default async function miscConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client as KhaxyClient;
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guildId]);
  if (rows.length === 0) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(rows[0].language, null, "misc_config");
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
      time: 1000 * 60 * 5,
      componentType: ComponentType.StringSelect,
    });
  } catch {
    await reply.resource!.message!.edit({ content: t("timeout"), components: [] });
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
  switch (message_component.values[0]) {
    case "language":
      await languageConfig(message_component, rows[0], t);
      break;
    case "mod_mail_message":
      await dynamicMessage("mod_mail_message", message_component, rows[0], t);
      break;
  }
}

async function languageConfig(interaction: MessageComponentInteraction, data: Guilds, t: TFunction) {
  const langs: Record<string, string> = {
    en: "English",
    tr: "Türkçe",
  };
  const client = interaction.client as KhaxyClient;
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("language")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions(
      [
        {
          label: langs.en,
          value: "en",
          description: "English",
          emoji: "🇬🇧",
        },
        {
          label: langs.tr,
          value: "tr",
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
      time: 1000 * 60 * 5,
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
  await client.pgClient.query("UPDATE guilds SET language = $1 WHERE id = $2", [
    message_component.values[0],
    message_component.guild.id,
  ]);
  const new_t = client.i18next.getFixedT(message_component.values[0], null, "misc_config");
  await message_component.editReply({
    content: new_t("language.set", { language: langs[message_component.values[0]] }),
    components: [],
  });
}
