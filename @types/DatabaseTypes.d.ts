// Auto-generated types from PostgreSQL

export type Cronjobs = {
  color_time: string;
  unregistered_people_time: string;
  id: string;
};

export type Punishments = {
  expires: string;
  created_at: string;
  user_id: string;
  previous_roles: Array;
  staff_id: string;
  guild_id: string;
  type: string;
};

export type Pgmigrations = {
  id: number;
  run_on: string;
  name: string;
};

export type Infractions = {
  expires_at: string;
  case_id: number;
  created_at: string;
  reason: string;
  guild_id: string;
  type: string;
  user_id: string;
  moderator_id: string;
};

export type Guilds = {
  case_id: number;
  register_channel_clear: boolean;
  mute_get_all_roles: boolean;
  days_to_kick: number;
  default_expiry: {years?: number, months?: number, days?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number};
  register_channel: string;
  member_role: string;
  mute_role: string;
  join_channel: string;
  register_join_channel: string;
  join_message: string;
  register_join_message: string;
  leave_channel: string;
  leave_message: string;
  staff_role: string;
  male_role: string;
  female_role: string;
  mod_mail_channel: string;
  dj_role: string;
  id: string;
  mod_mail_message: string;
  language: string;
  mod_log_channel: string;
  color_id_of_the_day: string;
  color_name_of_the_day: string;
};

