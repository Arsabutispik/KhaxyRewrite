import {
  ActionRowBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  ComponentType,
  MessageComponentInteraction,
  MessageFlagsBitField,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import type { guilds as Guilds } from "@prisma/client";
import { dynamicChannel } from "./register-config.js";
import { dynamicRole } from "./role-config.js";
import type { TFunction } from "i18next";
import { toStringId } from "@utils";
import { getGuildConfig, updateGuildConfig } from "@database";

export async function moderationConfig(interaction: ChatInputCommandInteraction<"cached">) {
  const client = interaction.client;
  const guild_data = await getGuildConfig(interaction.guildId);
  if (!guild_data) {
    await interaction.reply({
      content: "Unexpected database error. This should not have happened. Please contact the bot developers",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return;
  }
  const t = client.i18next.getFixedT(guild_data.language, null, "moderation_config");
  const select_menu = new StringSelectMenuBuilder()
    .setCustomId("moderation_config")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions([
      {
        label: t("mod_log_channel_id.label"),
        value: "mod_log_channel",
        description: t("mod_log_channel_id.description"),
        emoji: "📝",
      },
      {
        label: t("staff_role_id.label"),
        value: "staff_role",
        description: t("staff_role_id.description"),
        emoji: "🛡️",
      },
      {
        label: t("mod_mail_channel.label"),
        value: "mod_mail_channel",
        description: t("mod_mail_channel.description"),
        emoji: "📬",
      },
      {
        label: t("mute_get_all_roles.label"),
        value: "mute_get_all_roles",
        description: t("mute_get_all_roles.description"),
        emoji: "🔇",
      },
      {
        label: t("register_day_limit.label"),
        value: "register_day_limit",
        description: t("register_day_limit.description"),
        emoji: "📅",
      },
      {
        label: t("default_expiry.label"),
        value: "default_expiry",
        description: t("default_expiry.description"),
        emoji: "⏰",
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
    i.user.id === interaction.user.id && i.customId === "moderation_config";
  let message_component;
  try {
    message_component = await reply.resource!.message!.awaitMessageComponent({
      filter,
      time: 1000 * 60 * 5,
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
    case "mod_log_channel":
      await dynamicChannel("mod_log_channel_id", message_component, guild_data, t);
      break;
    case "staff_role":
      await message_component.deferUpdate();
      await dynamicRole("staff_role_id", message_component, guild_data, t);
      break;
    case "mod_mail_channel":
      await modMailChannel(message_component, guild_data, t);
      break;
    case "mute_get_all_roles":
      await muteGetAllRoles(message_component, guild_data, t);
      break;
    case "register_day_limit":
      await registerDayLimit(message_component, guild_data, t);
      break;
    case "default_expiry":
      await defaultExpiry(message_component, guild_data, t);
      break;
  }
}
async function modMailChannel(interaction: StringSelectMenuInteraction<"cached">, data: Guilds, t: TFunction) {
  if (data.mod_mail_channel_id && interaction.guild.channels.cache.has(toStringId(data.mod_mail_channel_id))) {
    await interaction.deferUpdate();
    await interaction.editReply({
      content: t("mod_mail_channel.already_set"),
      components: [],
    });
    return;
  } else {
    let permissions = [
      {
        id: interaction.guild!.id,
        deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.client.user!.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      },
    ];
    if (interaction.guild.roles.cache.has(toStringId(data.staff_role_id))) {
      permissions.push({
        id: toStringId(data.staff_role_id),
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      });
    }
    const parent = await interaction.guild!.channels.create({
      name: "ModMail",
      type: ChannelType.GuildCategory,
      permissionOverwrites: permissions,
    });
    const child = await parent.children.create({
      name: "ModMail Log",
      type: ChannelType.GuildText,
      permissionOverwrites: permissions,
    });
    await updateGuildConfig(interaction.guildId, {
      mod_mail_channel_id: BigInt(child.id),
      mod_mail_parent_channel_id: BigInt(parent.id),
    });
    await interaction.deferUpdate();
    await interaction.editReply({
      content: t("mod_mail_channel.set", { channel: child.toString() }),
      components: [],
    });
  }
}

async function muteGetAllRoles(interaction: StringSelectMenuInteraction<"cached">, data: Guilds, t: TFunction) {
  if (data.mute_get_all_roles) {
    await updateGuildConfig(interaction.guildId, {
      mute_get_all_roles: false,
    });
    await interaction.deferUpdate();
    await interaction.editReply({
      content: t("mute_get_all_roles.false"),
      components: [],
    });
  } else {
    await updateGuildConfig(interaction.guildId, {
      mute_get_all_roles: true,
    });
    await interaction.deferUpdate();
    await interaction.editReply({
      content: t("mute_get_all_roles.true"),
      components: [],
    });
  }
}

async function registerDayLimit(interaction: StringSelectMenuInteraction<"cached">, data: Guilds, t: TFunction) {
  const string_select = new StringSelectMenuBuilder()
    .setCustomId("register_day_limit")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions(
      [
        {
          label: t("register_day_limit.label_zero"),
          value: "0",
          description: t("register_day_limit.description_zero"),
          emoji: "❌",
        },
        {
          label: t("register_day_limit.label_one"),
          value: "1",
          description: t("register_day_limit.description_one"),
          emoji: "1️⃣",
        },
        {
          label: t("register_day_limit.label_three"),
          value: "3",
          description: t("register_day_limit.description_three"),
          emoji: "3️⃣",
        },
        {
          label: t("register_day_limit.label_seven"),
          value: "7",
          description: t("register_day_limit.description_seven"),
          emoji: "7️⃣",
        },
      ].map((options) => {
        if (parseInt(options.value) === data.days_to_kick) {
          //@ts-expect-error - This is a valid property
          options.default = true;
        }
        return options;
      }),
    );
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(string_select);
  await interaction.deferUpdate();
  const reply = await interaction.editReply({
    content: t("register_day_limit.initial"),
    components: [action_row],
  });
  const filter = (i: MessageComponentInteraction) =>
    i.user.id === interaction.user.id && i.customId === "register_day_limit";
  let message_component;
  try {
    message_component = await reply.awaitMessageComponent({
      filter,
      time: 1000 * 60 * 5,
      componentType: ComponentType.StringSelect,
    });
  } catch {
    await reply.edit({ content: t("timeout"), components: [] });
    return;
  }
  await updateGuildConfig(interaction.guildId, {
    days_to_kick: parseInt(message_component.values[0]),
  });
  await message_component.deferUpdate();
  await message_component.editReply({
    content: t("register_day_limit.success", { days: message_component.values[0] }),
    components: [],
  });
}

async function defaultExpiry(interaction: StringSelectMenuInteraction<"cached">, data: Guilds, t: TFunction) {
  const string_select = new StringSelectMenuBuilder()
    .setCustomId("default_expiry")
    .setMinValues(1)
    .setMaxValues(1)
    .setOptions(
      [
        {
          label: t("default_expiry.label_zero"),
          value: "0",
          description: t("default_expiry.description_zero"),
          emoji: "❌",
        },
        {
          label: t("default_expiry.label_seven"),
          value: "7",
          description: t("default_expiry.description_seven"),
          emoji: "7️⃣",
        },
        {
          label: t("default_expiry.label_fourteen"),
          value: "14",
          description: t("default_expiry.description_fourteen"),
          emoji: "📅",
        },
        {
          label: t("default_expiry.label_thirty"),
          value: "30",
          description: t("default_expiry.description_thirty"),
          emoji: "📅",
        },
      ].map((options) => {
        if (parseInt(options.value) === data.default_expiry) {
          //@ts-expect-error - This is a valid property
          options.default = true;
        }
        return options;
      }),
    );
  const action_row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(string_select);
  await interaction.deferUpdate();
  const reply = await interaction.editReply({
    content: t("default_expiry.initial"),
    components: [action_row],
  });
  const filter = (i: MessageComponentInteraction) =>
    i.user.id === interaction.user.id && i.customId === "default_expiry";
  let message_component;
  try {
    message_component = await reply.awaitMessageComponent({
      filter,
      time: 1000 * 60 * 5,
      componentType: ComponentType.StringSelect,
    });
  } catch {
    await reply.edit({ content: t("timeout"), components: [] });
    return;
  }
  await updateGuildConfig(interaction.guildId, {
    default_expiry: parseInt(message_component.values[0]),
  });
  await message_component.deferUpdate();
  await message_component.editReply({
    content: t("default_expiry.success", { days: message_component.values[0] }),
    components: [],
  });
}
