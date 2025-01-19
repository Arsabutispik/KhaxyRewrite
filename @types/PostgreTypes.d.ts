import {Snowflake} from "discord.js";

export interface GuildTypes {
    id: Snowflake;
    language: 'en' | 'tr';
    case_id: number;
    mod_log_channel?: Snowflake;
    color_id_of_the_day?: Snowflake;
    color_name_of_the_day?: string;
    days_to_kick?: number;
    register_channel?: Snowflake;
    member_role?: Snowflake;
    mute_role?: Snowflake;
    mute_get_all_roles?: boolean;
    welcome_channel?: Snowflake;
    welcome_message?: string;
    register_welcome_channel?: Snowflake;
    register_welcome_message?: string;
}

export interface ColorCronJobsTypes {
    id: Snowflake;
    colortime: string;
}

export interface CheckUnregisteredPeopleCronJobsTypes {
    id: Snowflake;
    checktime: string;
}

export interface BumpLeaderboardTypes {
    id: Snowflake;
    winner: Snowflake;
    users: Array<{
        id: Snowflake;
        bumps: number;
    }>
}

export interface PunishmentsTypes {
    expires: Date;
    type: 'BAN' | 'MUTE';
    guild_id: Snowflake;
    user_id: Snowflake;
    previous_roles?: Snowflake[];
    staff_id: Snowflake;
    created_at: Date;
}