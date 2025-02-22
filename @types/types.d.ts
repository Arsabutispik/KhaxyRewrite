import { ChatInputCommandInteraction, Client, Collection, SlashCommandBuilder } from "discord.js";
import { Client as PgClient } from "pg";
import { i18n } from "i18next";
import PlayerConfig from "../src/lib/PlayerConfig";
export declare class KhaxyClient extends Client {
  public slashCommands: Collection<string, SlashCommandBase>;

  public pgClient: PgClient;

  public i18next: i18n;

  public allEmojis: Collection<string, { name: string; format: string }>;

  public config: typeof PlayerConfig;
}
export interface SlashCommandBase {
  memberPermissions?: bigint[];
  clientPermissions?: bigint[];
  data?: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction<"cached">): any;
}

export interface EventBase {
  name: string;
  once: boolean;
  execute(...args: any[]): any;
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
