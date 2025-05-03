export type Cronjobs = {
  id: bigint;
  color_time: Date;
  unregistered_people_time: Date;
};

export type Punishments = {
  guild_id: bigint;
  created_at: Date;
  user_id: bigint;
  expires: Date;
  previous_roles: Array<bigint>;
  staff_id: bigint;
  type: "ban" | "mute";
};

export type Infractions = {
  guild_id: bigint;
  moderator_id: bigint;
  case_id: number;
  user_id: bigint;
  created_at: Date;
  expires_at: Date;
  reason: string;
  type: "ban" | "kick" | "mute" | "warn";
};

export type Mod_mail_threads = {
  guild_id: bigint;
  user_id: bigint;
  channel_id: bigint;
  close_date: Date;
  created_at: Date;
  closed_at: Date;
  status: "open" | "closed" | "suspended";
  closer_id: bigint;
};

export type Guilds = {
  mod_mail_channel_id: bigint;
  dj_role_id: bigint;
  days_to_kick: number;
  default_expiry: number;
  id: bigint;
  mod_mail_parent_channel_id: bigint;
  register_channel_id: bigint;
  member_role_id: bigint;
  mute_role_id: bigint;
  mute_get_all_roles: boolean;
  join_channel_id: bigint;
  register_join_channel_id: bigint;
  mod_log_channel_id: bigint;
  colour_id_of_the_day: bigint;
  leave_channel_id: bigint;
  case_id: number;
  staff_role_id: bigint;
  male_role_id: bigint;
  female_role_id: bigint;
  register_channel_clear: boolean;
  register_join_message: string;
  colour_name_of_the_day: string;
  join_message: string;
  language: string;
  leave_message: string;
  mod_mail_message: string;
  bump_leaderboard_channel_id: bigint;
  last_bump_winner: string;
  last_bump_winner_count: number;
  last_bump_winner_total_count: number;
};

export type Mod_mail_messages = {
  author_id: bigint;
  sent_at: Date;
  message_id: bigint;
  channel_id: bigint;
  sent_to: "thread" | "user";
  author_type: "staff" | "user" | "client";
  content: string;
};

export type Bump_leaderboard = {
  guild_id: bigint;
  user_id: bigint;
  bump_count: number;
};
