import { EventBase, KhaxyClient } from "../../@types/types";
import { ChannelType, Events, GuildMember, PermissionsBitField } from "discord.js";
import { Guilds, Punishments } from "../../@types/DatabaseTypes";
import { replacePlaceholders } from "../utils/utils.js";
import logger from "../lib/Logger.js";

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    // Fetch guild data from the database
    const { rows } = (await (member.client as KhaxyClient).pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      member.guild.id,
    ]))

    // If no guild data is found, exit the function
    if (rows.length === 0) return;

    // Fetch punishment data for the member from the database
    const { rows: punishment_rows } = (await (member.client as KhaxyClient).pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE guild_id = $1 AND user_id = $2 AND type = $3",
      [member.guild.id, member.id, "mute"],
    ))

    // If punishment data exists and the mute role is present, assign the mute role to the member
    if (punishment_rows.length > 0 && rows[0].mute_role && member.guild.roles.cache.has(rows[0].mute_role)) {
      try {
        await member.roles.add(rows[0].mute_role);
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

    // If a welcome message and channel are configured, send the welcome message to the channel
    if (
      rows[0].welcome_message &&
      rows[0].welcome_channel &&
      member.guild.channels.cache.has(rows[0].welcome_channel)
    ) {
      const welcome_channel = member.guild.channels.cache.get(rows[0].welcome_channel)!;
      if (!welcome_channel.isTextBased()) return;
      if (welcome_channel.type !== ChannelType.GuildText) return;
      if (!welcome_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages))
        return;
      welcome_channel.send(replacePlaceholders(rows[0].welcome_message, member));
    }

    // If no register channel is configured, or it does not exist, assign the member role if present and exit the function
    if (!rows[0].register_channel || !member.guild.channels.cache.has(rows[0].register_channel)) {
      if (rows[0].member_role && member.guild.roles.cache.has(rows[0].member_role)) {
        try {
          await member.roles.add(rows[0].member_role);
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
      rows[0].register_welcome_message &&
      rows[0].register_welcome_channel &&
      member.guild.channels.cache.has(rows[0].register_welcome_channel)
    ) {
      const register_welcome_channel = member.guild.channels.cache.get(rows[0].register_welcome_channel)!;
      if (!register_welcome_channel.isTextBased()) return;
      if (register_welcome_channel.type !== ChannelType.GuildText) return;
      if (
        !register_welcome_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages)
      )
        return;
      register_welcome_channel.send(replacePlaceholders(rows[0].register_welcome_message, member));
    }
  },
} as EventBase;
