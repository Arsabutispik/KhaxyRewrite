import { infractionParameters } from "../../@types/types";
import process from "node:process";

export async function addInfraction({ guild, member, reason, type, moderator, client }: infractionParameters) {
  const guild_config = await client.getGuildConfig(guild.id);
  if (!guild_config) return;
  await client.pgClient.query(
    "INSERT INTO infractions (guild_id, user_id, moderator_id, reason, expires_at, case_id, type) VALUES (pgp_sym_encrypt($1::TEXT, $7), pgp_sym_encrypt($2::TEXT, $7), pgp_sym_encrypt($3::TEXT, $7), pgp_sym_encrypt($4::TEXT, $7), (SELECT CURRENT_TIMESTAMP + (pgp_sym_decrypt(default_expiry, $7)::INTERVAL) FROM guilds WHERE id = $1), pgp_sym_encrypt($5::TEXT, $7), pgp_sym_encrypt($6::TEXT, $7))",
    [guild.id, member, moderator, reason, guild_config.case_id, type, process.env.PASSPHRASE],
  );
}

export async function removeInfraction({ guild, case_id, client }: infractionParameters & { case_id: number }) {
  await client.pgClient.query(
    "DELETE FROM infractions WHERE pgp_sym_decrypt(guild_id, $3) = $1 AND pgp_sym_decrypt(case_id, $3) = $2;",
    [guild.id, case_id, process.env.PASSPHRASE],
  );
}

export async function editInfraction({
  guild,
  case_id,
  reason,
  client,
}: infractionParameters & { case_id: number; reason: string }) {
  await client.pgClient.query(
    "UPDATE infractions SET reason = pgp_sym_encrypt($1, $4) WHERE pgp_sym_decrypt(guild_id, $4) = $2 AND pgp_sym_decrypt(case_id, $4) = $3;",
    [reason, guild.id, case_id, process.env.PASSPHRASE],
  );
}
