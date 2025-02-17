import { EventBase, KhaxyClient } from "../../@types/types";
import { AutoModerationActionExecution, AutoModerationActionType, Events } from "discord.js";
import modlog from "../utils/modLog.js";
import dayjs from "dayjs";

export default {
  name: Events.AutoModerationActionExecution,
  once: false,
  async execute(execution: AutoModerationActionExecution) {
    // Get the client instance from the guild member
    const client = execution.guild.members.me?.client as KhaxyClient;

    // Check if the action type is Timeout
    if (execution.action.type === AutoModerationActionType.Timeout) {
      // Log the timeout action using the modlog utility
      await modlog(
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
} as EventBase;
