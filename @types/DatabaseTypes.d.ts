// Auto-generated types from PostgreSQL

export type Cronjobs = {
  color_time: string;
  unregistered_people_time: string;
  id: string;
};

export type Punishments = {
  previous_roles: Record<string, unknown>;
  expires: string;
  created_at: string;
  staff_id: string;
  guild_id: string;
  type: string;
  user_id: string;
};

export type Pgmigrations = {
  id: number;
  run_on: string;
  name: string;
};

export type Infractions = {
  created_at: string;
  expires_at: string;
  case_id: number;
  id: number;
  reason: string;
  type: string;
  guild_id: string;
  user_id: string;
  moderator_id: string;
};

export type Guilds = {
  mute_get_all_roles: boolean;
  days_to_kick: number;
  default_expiry: string;
  case_id: number;
  color_name_of_the_day: string;
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
  id: string;
  female_role: string;
  language: string;
  mod_log_channel: string;
  color_id_of_the_day: string;
};

