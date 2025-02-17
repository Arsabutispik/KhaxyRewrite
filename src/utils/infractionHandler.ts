import { infractionParameters } from "../../@types/types";

export async function addInfraction({ guild, member, reason, type, moderator, client }: infractionParameters) {
  const { rows } = (await client.pgClient.query("SELECT case_id FROM guilds WHERE id = $1", [guild.id])) as {
    rows: { case_id: number }[];
  };
  if (rows.length === 0) return;
  await client.pgClient.query(
    "INSERT INTO infractions (guild_id, user_id, moderator_id, reason, expires_at, case_id, type) VALUES ($1, $2, $3, $4, (SELECT CURRENT_TIMESTAMP + default_expiry FROM guilds WHERE id = $1), $5, $6)",
    [guild.id, member, moderator, reason, rows[0].case_id, type],
  );
}

export async function removeInfraction({ guild, case_id, client }: infractionParameters & { case_id: number }) {
  await client.pgClient.query("DELETE FROM infractions WHERE guild_id = $1 AND case_id = $2;", [guild.id, case_id]);
}

export async function editInfraction({
  guild,
  case_id,
  reason,
  client,
}: infractionParameters & { case_id: number; reason: string }) {
  await client.pgClient.query("UPDATE infractions SET reason = $1 WHERE guild_id = $2 AND case_id = $3;", [
    reason,
    guild.id,
    case_id,
  ]);
}
