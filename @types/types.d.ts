import {ChatInputCommandInteraction, Client, Collection, SlashCommandBuilder} from "discord.js";
import {Client as PgClient} from "pg"
import {i18n} from "i18next";
export declare class KhaxyClient extends Client {
    public slashCommands: Collection<string, SlashCommandBase>

    public pgClient: PgClient

    public i18next: i18n
}
export interface SlashCommandBase {
    data?: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): any;
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
    mod_log_channel?: string
}