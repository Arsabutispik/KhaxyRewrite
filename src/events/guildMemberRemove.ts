import { EventBase, KhaxyClient } from "../../@types/types";
import { Events, GuildMember, PermissionsBitField } from "discord.js";
import { replacePlaceholders } from "../utils/utils.js";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    // Fetch guild data from the database
    const { rows } = await (member.client as KhaxyClient).pgClient.query("SELECT * FROM guilds WHERE id = $1", [
      member.guild.id,
    ]);

    // If no guild data is found, exit the function
    if (rows.length === 0) return;

    // If a goodbye message and channel are configured, send the goodbye message to the channel
    if (
      rows[0].goodbye_message &&
      rows[0].goodbye_channel &&
      member.guild.channels.cache.has(rows[0].goodbye_channel)
    ) {
      const goodbye_channel = member.guild.channels.cache.get(rows[0].goodbye_channel)!;
      if (!goodbye_channel.isTextBased()) return;
      if (!goodbye_channel.permissionsFor(member.guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages))
        return;
      goodbye_channel.send(replacePlaceholders(rows[0].goodbye_message, member));
    }
  },
} as EventBase;
