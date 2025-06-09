import {
  ChatInputCommandInteraction,
  Collection,
  SlashCommandBuilder,
  ClientEvents,
  Awaitable,
  Guild,
  Snowflake,
  Client,
} from "discord.js";
import { i18n } from "i18next";
import { Config } from "@lib";
declare module "discord.js" {
  interface Client {
    slashCommands: Collection<string, SlashCommandBase>;
    i18next: i18n;
    allEmojis: Collection<string, { name: string; format: string }>;
    config: typeof Config;
  }
}
export interface SlashCommandBase {
  memberPermissions?: bigint[];
  clientPermissions?: bigint[];
  data?: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction<"cached">): unknown;
}

export interface EventBase<T extends keyof ClientEvents = keyof ClientEvents> {
  name: T;
  once?: boolean;
  execute: (...args: ClientEvents[T]) => Awaitable<void>;
}
export interface GuildConfig {
  bumpLeaderboardChannel: string;
  id: string;
  language: string;
  case_id: number;
  mod_log_channel?: string;
}

export interface infractionParameters {
  guild: Guild;
  member: Snowflake;
  moderator: Snowflake;
  type: "warn" | "mute" | "kick" | "ban" | "forceban";
  reason: string;
  client: Client;
}
