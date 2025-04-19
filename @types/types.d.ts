import { ChatInputCommandInteraction, Collection, SlashCommandBuilder, ClientEvents, Awaitable } from "discord.js";
import { Client as PgClient } from "pg";
import { Redis } from "ioredis";
import { i18n } from "i18next";
import PlayerConfig from "../src/lib/PlayerConfig";
import { Guilds, Punishments, Mod_mail_threads } from "./DatabaseTypes";
declare module "discord.js" {
  interface Client {
    slashCommands: Collection<string, SlashCommandBase>;
    pgClient: PgClient;
    redis: Redis;
    i18next: i18n;
    allEmojis: Collection<string, { name: string; format: string }>;
    config: typeof PlayerConfig;
    getGuildConfig: (guildId: string) => Promise<Guilds | null>;
    setGuildConfig: (guildId: string, config: Partial<Guilds>) => Promise<void>;
    getPunishments: (guildId: string, userId: string, type: "ban" | "mute") => Promise<Punishments | null>;
    getModmailThread: (guildId: string, channelId: string) => Promise<Mod_mail_threads | null>;
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
  client: KhaxyClient;
}
