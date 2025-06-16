import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageComponentInteraction,
  MessageFlagsBitField,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import type { guilds as Guilds } from "@prisma/client";
import type { TFunction } from "i18next";
import { toStringId } from "@utils";
import { getGuildConfig, updateGuildConfig } from "@database";

type RoleType =
  | "member_role_id"
  | "male_role_id"
  | "female_role_id"
  | "colour_id_of_the_day"
  | "mute_role_id"
  | "dj_role_id"
  | "staff_role_id";

export async function roleConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client;
  const guild_config = await getGuildConfig(interaction.guildId);
  if (!guild_config) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(guild_config.language, null, "role_config");
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("role_config")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions([
      {
        label: t("member"),
        value: "member_role_id",
        description: t("member_description"),
        emoji: "👤",
      },
      {
        label: t("male"),
        value: "male_role_id",
        description: t("male_description"),
        emoji: "👨",
      },
      {
        label: t("female"),
        value: "female_role_id",
        description: t("female_description"),
        emoji: "👩",
      },
      {
        label: t("colour_of_the_day"),
        value: "colour_id_of_the_day",
        description: t("colour_of_the_day_description"),
        emoji: "🌈",
      },
      {
        label: t("mute"),
        value: "mute_role_id",
        description: t("mute_description"),
        emoji: "🔇",
      },
      {
        label: t("dj"),
        value: "dj_role_id",
        description: t("dj_description"),
        emoji: "🎧",
      },
    ]);
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(select_menu);
  const reply = await interaction.reply({
    content: t("initial"),
    components: [action_row],
    flags: MessageFlagsBitField.Flags.Ephemeral,
    withResponse: true,
  });
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id && i.customId === "role_config";
  let message_component;
  try {
    message_component = await reply.resource!.message!.awaitMessageComponent({
      filter,
      componentType: ComponentType.StringSelect,
      time: 1000 * 60 * 5,
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
  await message_component.deferUpdate();
  await dynamicRole(message_component.values[0] as RoleType, message_component, guild_config, t);
}

export async function dynamicRole(
  role: RoleType,
  interaction: StringSelectMenuInteraction<"cached">,
  data: Guilds,
  t: TFunction,
) {
  const select_menu = new RoleSelectMenuBuilder().setCustomId(role).setMaxValues(1).setMinValues(0);
  if (data[role]) {
    select_menu.setDefaultRoles(toStringId(data[role]));
  }
  const action_row = new ActionRowBuilder<RoleSelectMenuBuilder>().setComponents(select_menu);
  const result = await interaction.editReply({
    content: t("role_initial"),
    components: [action_row],
  });
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id && i.customId === role;
  let message_component;
  try {
    message_component = await result.awaitMessageComponent({
      filter,
      componentType: ComponentType.RoleSelect,
      time: 1000 * 60 * 5,
    });
  } catch {
    await result.edit({
      content: t("timeout"),
      components: [],
    });
    return;
  }
  await message_component.deferUpdate();
  if (message_component.values.length === 0) {
    await updateGuildConfig(message_component.guildId, {
      [role]: null,
    });
    await message_component.editReply({
      content: t(`${role}.unset`),
      components: [],
    });
  } else {
    if (
      message_component.values[0] !== "dj_role" &&
      message_component.guild!.members.me!.roles.highest.position <
        message_component.guild.roles.cache.get(message_component.values[0])!.position
    ) {
      await message_component.editReply({
        content: t("role_too_high"),
        components: [],
      });
      return;
    }
    await updateGuildConfig(message_component.guildId, {
      [role]: message_component.values[0],
    });
    await message_component.editReply({
      content: t(`${role}.set`, {
        role: message_component.guild!.roles.cache.get(message_component.values[0])!.toString(),
      }),
      components: [],
    });
  }
}
