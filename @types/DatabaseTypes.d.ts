// Auto-generated types from PostgreSQL

export type Cronjobs = {
  id: bigint;
  color_time: string;
  unregistered_people_time: string;
};

export type Pgmigrations = {
  id: number;
  run_on: string;
  name: string;
};

export type Punishments = {
  guild_id: bigint;
  created_at: string;
  user_id: bigint;
  expires: string;
  previous_roles: Array;
  staff_id: bigint;
  type: string;
};

export type Infractions = {
  guild_id: bigint;
  moderator_id: bigint;
  case_id: number;
  user_id: bigint;
  created_at: string;
  expires_at: string;
  reason: string;
  type: string;
};

export type Mod_mail_threads = {
  thread_id: bigint;
  guild_id: bigint;
  user_id: bigint;
  channel_id: bigint;
  close_date: string;
  created_at: string;
  closed_at: string;
  status: string;
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
  color_id_of_the_day: bigint;
  leave_channel_id: bigint;
  case_id: number;
  staff_role_id: bigint;
  male_role_id: bigint;
  female_role_id: bigint;
  register_channel_clear: boolean;
  register_join_message: string;
  color_name_of_the_day: string;
  join_message: string;
  language: string;
  leave_message: string;
  mod_mail_message: string;
};

export type Mod_mail_messages = {
  thread_id: bigint;
  author_id: bigint;
  sent_at: string;
  message_id: bigint;
  channel_id: bigint;
  sent_to: string;
  author_type: string;
  content: string;
  attachments: Array;
};

