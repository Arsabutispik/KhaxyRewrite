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
import { KhaxyClient } from "../../@types/types";
import { Guilds } from "../../@types/DatabaseTypes";
import { TFunction } from "i18next";
import { toStringId } from "../utils/utils.js";

type RoleType =
  | "member_role_id"
  | "male_role_id"
  | "female_role_id"
  | "color_id_of_the_day"
  | "mute_role_id"
  | "dj_role_id"
  | "staff_role_id";

export default async function roleConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client as KhaxyClient;
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guildId]);
  if (rows.length === 0) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(rows[0].language, null, "role_config");
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("role_config")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions([
      {
        label: t("member"),
        value: "member_role",
        description: t("member_description"),
        emoji: "👤",
      },
      {
        label: t("male"),
        value: "male_role",
        description: t("male_description"),
        emoji: "👨",
      },
      {
        label: t("female"),
        value: "female_role",
        description: t("female_description"),
        emoji: "👩",
      },
      {
        label: t("colour_of_the_day"),
        value: "color_id_of_the_day",
        description: t("colour_of_the_day_description"),
        emoji: "🌈",
      },
      {
        label: t("mute"),
        value: "mute_role",
        description: t("mute_description"),
        emoji: "🔇",
      },
      {
        label: t("dj"),
        value: "dj_role",
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
    await reply.resource!.message!.edit({
      content: t("timeout"),
      components: [],
    });
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
  await dynamicRole(message_component.values[0] as RoleType, message_component, rows[0], t);
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
  const client = message_component.client as KhaxyClient;
  await message_component.deferUpdate();
  if (message_component.values.length === 0) {
    await client.pgClient.query(`UPDATE guilds SET ${role} = NULL WHERE id = $1`, [message_component.guildId]);
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
    await client.pgClient.query(`UPDATE guilds SET ${role} = $1 WHERE id = $2`, [
      message_component.values[0],
      message_component.guildId,
    ]);
    await message_component.editReply({
      content: t(`${role}.set`, {
        role: message_component.guild!.roles.cache.get(message_component.values[0])!.toString(),
      }),
      components: [],
    });
  }
}
