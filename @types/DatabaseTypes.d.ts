export type Cronjobs = {
  id: string;
  color_time: string;
  unregistered_people_time: string;
};

export type Punishments = {
  guild_id: string;
  created_at: string;
  user_id: string;
  expires: string;
  previous_roles: Array;
  staff_id: string;
  type: string;
};

export type Infractions = {
  guild_id: string;
  moderator_id: string;
  case_id: number;
  user_id: string;
  created_at: string;
  expires_at: string;
  reason: string;
  type: string;
};

export type Mod_mail_threads = {
  thread_id: string;
  guild_id: string;
  user_id: string;
  channel_id: string;
  close_date: string;
  created_at: string;
  closed_at: string;
  status: string;
};

export type Guilds = {
  mod_mail_channel_id: string;
  dj_role_id: string;
  days_to_kick: number;
  default_expiry: number;
  id: string;
  mod_mail_parent_channel_id: string;
  register_channel_id: string;
  member_role_id: string;
  mute_role_id: string;
  mute_get_all_roles: boolean;
  join_channel_id: string;
  register_join_channel_id: string;
  mod_log_channel_id: string;
  color_id_of_the_day: string;
  leave_channel_id: string;
  case_id: number;
  staff_role_id: string;
  male_role_id: string;
  female_role_id: string;
  register_channel_clear: boolean;
  register_join_message: string;
  color_name_of_the_day: string;
  join_message: string;
  language: string;
  leave_message: string;
  mod_mail_message: string;
  bump_leaderboard_channel_id: string;
  last_bump_winner: string;
  last_bump_winner_count: number;
  last_bump_winner_total_count: number;
};

export type Mod_mail_messages = {
  thread_id: string;
  author_id: string;
  sent_at: string;
  message_id: string;
  channel_id: string;
  sent_to: string;
  author_type: string;
  content: string;
  attachments: Array;
};

export type Bump_leaderboard = {
  guild_id: string;
  user_id: string;
  bump_count: number;
};
