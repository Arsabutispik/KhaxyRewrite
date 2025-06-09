import { EventBase } from "@customTypes";
import { AutoModerationActionType, Events } from "discord.js";
import { modLog } from "@utils";
import dayjs from "dayjs";

export default {
  name: Events.AutoModerationActionExecution,
  async execute(execution) {
    // Get the client instance from the guild member
    const client = execution.guild.members.me?.client;
    if (!client) return;
    // Check if the action type is Timeout
    if (execution.action.type === AutoModerationActionType.Timeout) {
      // Log the timeout action using the modlog utility
      await modLog(
        {
          guild: execution.guild,
          user: execution.user!,
          action: "TIMEOUT",
          moderator: client.user!,
          reason: "Automod triggered a timeout",
          duration: dayjs(execution.action.metadata.durationSeconds!),
        },
        client,
      );
    }
  },
} satisfies EventBase<Events.AutoModerationActionExecution>;
