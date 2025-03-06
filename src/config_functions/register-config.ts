import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  MessageFlagsBitField,
  StringSelectMenuBuilder,
} from "discord.js";
import { KhaxyClient } from "../../@types/types";
import { Guilds } from "../../@types/DatabaseTypes";

export default async function registerConfig(interaction: ChatInputCommandInteraction) {
  const client = interaction.client as KhaxyClient;
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guildId]);
  if (rows.length === 0) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(rows[0].language, null, "register_config");
  const select_menu = new StringSelectMenuBuilder().setCustomId("role_config").addOptions([
    {
      label: t("member"),
      value: "member",
      description: t("member_description"),
      emoji: "👤",
    },
    {
      label: t("male"),
      value: "male",
      description: t("male_description"),
      emoji: "👨",
    },
    {
      label: t("female"),
      value: "female",
      description: t("female_description"),
      emoji: "👩",
    },
    {
      label: t("colour_of_the_day"),
      value: "colour_of_the_day",
      description: t("colour_of_the_day_description"),
      emoji: "🌈",
    },
    {
      label: t("mute"),
      value: "mute",
      description: t("mute_description"),
      emoji: "🔇",
    },
    {
      label: t("dj"),
      value: "dj",
      description: t("dj_description"),
      emoji: "🎧",
    },
  ]);
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(select_menu);
  await interaction.reply({
    content: t("initial"),
    components: [action_row],
    flags: MessageFlagsBitField.Flags.Ephemeral,
  });
}
