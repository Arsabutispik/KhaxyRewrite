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
import { dynamicChannel, dynamicMessage } from "./register-config.js";

export default async function welcomeLeaveConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client as KhaxyClient;
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guildId]);
  if (rows.length === 0) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(rows[0].language, null, "welcome_leave_config");
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("welcome_leave_config")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions([
      {
        label: t("join_channel.label"),
        value: "join_channel",
        description: t("join_channel.description"),
        emoji: "👋",
      },
      {
        label: t("join_message.label"),
        value: "join_message",
        description: t("join_message.description"),
        emoji: "📩",
      },
      {
        label: t("leave_channel.label"),
        value: "leave_channel",
        description: t("leave_channel.description"),
        emoji: "🚪",
      },
      {
        label: t("leave_message.label"),
        value: "leave_message",
        description: t("leave_message.description"),
        emoji: "📤",
      },
    ]);
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select_menu);
  const reply = await interaction.reply({
    content: t("initial"),
    components: [action_row],
    flags: MessageFlagsBitField.Flags.Ephemeral,
    withResponse: true,
  });
  const filter = (i: MessageComponentInteraction) =>
    i.user.id === interaction.user.id && i.customId === "welcome_leave_config";
  let message_component;
  try {
    message_component = await reply.resource!.message!.awaitMessageComponent({
      filter,
      time: 15000,
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
  switch (message_component.values[0]) {
    case "join_channel":
      await dynamicChannel("join_channel_id", message_component, rows[0], t);
      break;
    case "join_message":
      await dynamicMessage("join_message", message_component, rows[0], t);
      break;
    case "leave_channel":
      await dynamicChannel("leave_channel_id", message_component, rows[0], t);
      break;
    case "leave_message":
      await dynamicMessage("leave_message", message_component, rows[0], t);
      break;
  }
}
