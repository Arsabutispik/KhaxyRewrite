// Auto-generated types from PostgreSQL

export type Guilds = {
  mute_get_all_roles: boolean;
  days_to_kick: number;
  case_id: number;
  default_expiry: string;
  color_name_of_the_day: string;
  register_channel: string;
  id: string;
  mute_role: string;
  welcome_channel: string;
  register_welcome_channel: string;
  welcome_message: string;
  register_welcome_message: string;
  bump_leaderboard_channel: string;
  member_role: string;
  language: string;
  mod_log_channel: string;
  color_id_of_the_day: string;
};

export type Punishments = {
  previous_roles: any;
  expires: string;
  created_at: string;
  staff_id: string;
  guild_id: string;
  type: string;
  user_id: string;
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

export type Cronjobs = {
  color_time: string;
  unregistered_people_time: string;
  id: string;
};

