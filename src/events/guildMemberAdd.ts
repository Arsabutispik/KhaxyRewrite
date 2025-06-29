import type { EventBase } from "@customTypes";
import { ChannelType, Events, PermissionsBitField } from "discord.js";
import { replacePlaceholders, toStringId } from "@utils";
import { logger } from "@lib";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { getPunishmentsByUser, getGuildConfig } from "@database";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // Fetch guild data from the database
    const guild_config = await getGuildConfig(member.guild.id);

    // If no guild data is found, exit the function
    if (!guild_config) return;

    // Fetch punishment data for the member from the database
    const punishments = await getPunishmentsByUser(member.guild.id, member.id);

    // If punishment data exists and the mute role is present, assign the mute role to the member
    if (
      punishments.length > 0 &&
      guild_config.mute_role_id &&
      member.guild.roles.cache.has(toStringId(guild_config.mute_role_id))
    ) {
      try {
        await member.roles.add(toStringId(guild_config.mute_role_id));
      } catch (error) {
        logger.log({
          level: "error",
          message: "Error assigning member role",
          error: error,
          meta: {
            guildID: member.guild.id,
            userID: member.id,
          },
        });
      }
    }
    dayjs.extend(relativeTime);
    const replacements = {
      user: member.toString(),
      server: member.guild.name,
      memberCount: member.guild.memberCount.toString(),
      name: member.user.username,
      joinPosition: (member.guild.memberCount - 1).toString(),
      createdAt: dayjs(member.user.createdAt).format("DD/MM/YYYY"),
      createdAgo: dayjs(member.user.createdAt).fromNow(),
    };
    // If a welcome message and channel are configured, send the welcome message to the channel
    if (
      guild_config.join_message &&
      guild_config.join_channel_id &&
      member.guild.channels.cache.has(toStringId(guild_config.join_channel_id))
    ) {
      const welcome_channel = member.guild.channels.cache.get(toStringId(guild_config.join_channel_id))!;
      if (!welcome_channel.isTextBased()) return;
      if (welcome_channel.type !== ChannelType.GuildText) return;
      if (!welcome_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages))
        return;
      await welcome_channel.send(replacePlaceholders(guild_config.join_message, replacements));
    }

    // If no register channel is configured, assign the member role if present and exit the function
    if (!guild_config.register_channel_id) {
      if (guild_config.member_role_id && member.guild.roles.cache.has(toStringId(guild_config.member_role_id))) {
        try {
          await member.roles.add(toStringId(guild_config.member_role_id));
        } catch (error) {
          logger.log({
            level: "error",
            message: "Error assigning member role",
            error: error,
            meta: {
              guildID: member.guild.id,
              userID: member.id,
            },
          });
        }
      }
      return;
    }

    // If a register welcome message and channel are configured, send the register welcome message to the channel
    if (
      guild_config.register_join_channel_id &&
      guild_config.register_join_message &&
      member.guild.channels.cache.has(toStringId(guild_config.register_join_channel_id))
    ) {
      const register_welcome_channel = member.guild.channels.cache.get(
        toStringId(guild_config.register_join_channel_id),
      )!;
      if (!register_welcome_channel.isTextBased()) return;
      if (register_welcome_channel.type !== ChannelType.GuildText) return;
      if (
        !register_welcome_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages)
      )
        return;
      await register_welcome_channel.send(replacePlaceholders(guild_config.register_join_message, replacements));
      // If the guild set up an unverified role, assign it to the member
      if (
        guild_config.unverified_role_id &&
        member.guild.roles.cache.has(toStringId(guild_config.unverified_role_id))
      ) {
        try {
          await member.roles.add(toStringId(guild_config.unverified_role_id));
        } catch (error) {
          logger.log({
            level: "error",
            message: "Error assigning unverified role",
            error: error,
            meta: {
              guildID: member.guild.id,
              userID: member.id,
            },
          });
        }
      }
    }
  },
} satisfies EventBase<Events.GuildMemberAdd>;
