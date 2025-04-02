import { EventBase } from "../../@types/types";
import { ChannelType, Events, PermissionsBitField } from "discord.js";
import { Guilds, Punishments } from "../../@types/DatabaseTypes";
import { replacePlaceholders, toStringId } from "../utils/utils.js";
import logger from "../lib/Logger.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // Fetch guild data from the database
    const { rows } = await member.client.pgClient.query<Guilds>("SELECT * FROM guilds WHERE id = $1", [
      member.guild.id,
    ]);

    // If no guild data is found, exit the function
    if (rows.length === 0) return;

    // Fetch punishment data for the member from the database
    const { rows: punishment_rows } = await member.client.pgClient.query<Punishments>(
      "SELECT * FROM punishments WHERE guild_id = $1 AND user_id = $2 AND type = $3",
      [member.guild.id, member.id, "mute"],
    );

    // If punishment data exists and the mute role is present, assign the mute role to the member
    if (
      punishment_rows.length > 0 &&
      rows[0].mute_role_id &&
      member.guild.roles.cache.has(toStringId(rows[0].mute_role_id))
    ) {
      try {
        await member.roles.add(toStringId(rows[0].mute_role_id));
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
      "{user}": member.toString(),
      "{server}": member.guild.name,
      "{memberCount}": member.guild.memberCount.toString(),
      "{name}": member.user.username,
      "{joinPosition}": (member.guild.memberCount - 1).toString(),
      "{createdAt}": dayjs(member.user.createdAt).format("DD/MM/YYYY"),
      "{createdAgo}": dayjs(member.user.createdAt).fromNow(),
    };
    // If a welcome message and channel are configured, send the welcome message to the channel
    if (
      rows[0].join_message &&
      rows[0].join_channel_id &&
      member.guild.channels.cache.has(toStringId(rows[0].join_channel_id))
    ) {
      const welcome_channel = member.guild.channels.cache.get(toStringId(rows[0].join_channel_id))!;
      if (!welcome_channel.isTextBased()) return;
      if (welcome_channel.type !== ChannelType.GuildText) return;
      if (!welcome_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages))
        return;
      welcome_channel.send(replacePlaceholders(rows[0].join_message, replacements));
    }

    // If no register channel is configured, assign the member role if present and exit the function
    if (!rows[0].register_channel_id) {
      if (rows[0].member_role_id && member.guild.roles.cache.has(toStringId(rows[0].member_role_id))) {
        try {
          await member.roles.add(toStringId(rows[0].member_role_id));
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
      rows[0].register_join_channel_id &&
      rows[0].register_join_message &&
      member.guild.channels.cache.has(toStringId(rows[0].register_join_channel_id))
    ) {
      const register_welcome_channel = member.guild.channels.cache.get(toStringId(rows[0].register_join_channel_id))!;
      if (!register_welcome_channel.isTextBased()) return;
      if (register_welcome_channel.type !== ChannelType.GuildText) return;
      if (
        !register_welcome_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages)
      )
        return;
      register_welcome_channel.send(replacePlaceholders(rows[0].register_join_message, replacements));
    }
  },
} satisfies EventBase<Events.GuildMemberAdd>;
