import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  ComponentType,
  MessageComponentInteraction,
  MessageFlagsBitField,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Guilds } from "../../@types/DatabaseTypes";
import { TFunction } from "i18next";
import { toStringId } from "../utils/utils.js";

export default async function registerConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client;
  const { rows } = await client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [interaction.guild.id]);
  const guild_config = rows[0];
  if (!guild_config) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(guild_config.language, null, "register_config");
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("register_config")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions([
      {
        label: t("register_join_channel_id.label"),
        value: "register_join_channel",
        description: t("register_join_channel_id.description"),
        emoji: "📝",
      },
      {
        label: t("register_channel_id.label"),
        value: "register_channel",
        description: t("register_channel_id.description"),
        emoji: "📝",
      },
      {
        label: t("register_join_message.label"),
        value: "register_join_message",
        description: t("register_join_message.description"),
        emoji: "📝",
      },
      {
        label: t("register_clear_channel.label"),
        value: "register_clear_channel",
        description: t("register_clear_channel.description"),
        emoji: "📝",
      },
    ]);
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(select_menu);
  const reply = await interaction.reply({
    content: t("initial"),
    components: [action_row],
    flags: MessageFlagsBitField.Flags.Ephemeral,
    withResponse: true,
  });
  const filter = (i: MessageComponentInteraction) =>
    i.user.id === interaction.user.id && i.customId === "register_config";
  let message_component;
  try {
    message_component = await reply.resource!.message!.awaitMessageComponent({
      filter,
      componentType: ComponentType.StringSelect,
      time: 1000 * 60 * 5,
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
    case "register_join_channel":
      await dynamicChannel("register_join_channel_id", message_component, guild_config, t);
      break;
    case "register_channel":
      await dynamicChannel("register_channel_id", message_component, guild_config, t);
      break;
    case "register_join_message":
      await dynamicMessage("register_join_message", message_component, guild_config, t);
      break;
    case "register_clear_channel":
      await registerClearChannel(message_component, guild_config, t);
      break;
  }
}
export async function dynamicChannel(
  channel:
    | "register_join_channel_id"
    | "register_channel_id"
    | "join_channel_id"
    | "leave_channel_id"
    | "mod_log_channel_id"
    | "mod_mail_channel_id"
    | "bump_leaderboard_channel_id",
  interaction: StringSelectMenuInteraction<"cached">,
  data: Guilds,
  t: TFunction,
) {
  await interaction.deferUpdate();
  const select_menu = new ChannelSelectMenuBuilder()
    .setCustomId(channel)
    .setMaxValues(1)
    .setMinValues(0)
    .setChannelTypes(ChannelType.GuildText);
  if (data[channel]) {
    select_menu.setDefaultChannels(toStringId(data[channel]));
  }
  const action_row = new ActionRowBuilder<ChannelSelectMenuBuilder>().setComponents(select_menu);
  const result = await interaction.editReply({
    content: t("channel_initial"),
    components: [action_row],
  });
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id && i.customId === channel;
  let message_component;
  try {
    message_component = await result.awaitMessageComponent({
      filter,
      componentType: ComponentType.ChannelSelect,
      time: 1000 * 60 * 5,
    });
  } catch {
    await result.edit({
      content: t("timeout"),
      components: [],
    });
    return;
  }
  const client = message_component.client;
  await message_component.deferUpdate();
  if (message_component.values.length === 0) {
    await client.pgClient.query(`UPDATE guilds SET ${channel} = NULL WHERE id = $1`, [message_component.guildId]);
    await message_component.editReply({
      content: t(`${channel}.unset`),
      components: [],
    });
  } else {
    await client.pgClient.query(`UPDATE guilds SET ${channel} = $1 WHERE id = $2`, [
      message_component.values[0],
      message_component.guildId,
    ]);
    await message_component.editReply({
      content: t(`${channel}.set`, {
        channel: message_component.guild.channels.cache.get(message_component.values[0])!.toString(),
      }),
      components: [],
    });
  }
}

export async function dynamicMessage(
  message: "register_join_message" | "join_message" | "leave_message" | "mod_mail_message",
  interaction: StringSelectMenuInteraction<"cached">,
  data: Guilds,
  t: TFunction,
) {
  const text_component = new TextInputBuilder()
    .setCustomId(message)
    .setMaxLength(1500)
    .setLabel(t(`${message}.label`))
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph);
  if (data[message]) {
    text_component.setPlaceholder(data[message]);
  }
  const action_row = new ActionRowBuilder<TextInputBuilder>().setComponents(text_component);
  const modal = new ModalBuilder()
    .setCustomId(message)
    .setTitle(t(`${message}.title`))
    .setComponents(action_row);
  await interaction.showModal(modal);
  const filter = (i: ModalSubmitInteraction) => i.user.id === interaction.user.id && i.customId === message;
  let message_component;
  try {
    message_component = await interaction.awaitModalSubmit({
      filter,
      time: 1000 * 60 * 5,
    });
  } catch {
    await interaction.editReply({
      content: t("timeout"),
      components: [],
    });
    return;
  }
  const client = message_component.client;
  await message_component.deferUpdate();
  const defaultValueMap = {
    mod_mail_message: "Thank you for your message! Our mod team will reply to you here as soon as possible.",
    [message]: null,
  };
  const input = message_component.fields.getTextInputValue(message);
  const valueToEncrypt = input === "" ? defaultValueMap[message] : input;
  await client.pgClient.query(
    `UPDATE guilds
     SET ${message} = $1
     WHERE id = $2`,
    [valueToEncrypt, message_component.guildId],
  );
  await message_component.editReply({
    content: t(`${message}.set`),
    components: [],
  });
}

async function registerClearChannel(interaction: StringSelectMenuInteraction<"cached">, data: Guilds, t: TFunction) {
  await interaction.deferUpdate();
  const client = interaction.client;
  if (data.register_channel_clear) {
    await client.pgClient.query(`UPDATE guilds SET register_channel_clear = FALSE WHERE id= $1`, [interaction.guildId]);
    await interaction.editReply({
      content: t("register_clear_channel.unset"),
      components: [],
    });
  } else {
    await client.pgClient.query(`UPDATE guilds SET register_channel_clear = TRUE WHERE id = $1`, [interaction.guildId]);
    await interaction.editReply({
      content: t("register_clear_channel.set"),
      components: [],
    });
  }
}
