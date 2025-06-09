import { prisma } from "@database";
import { Prisma } from "@prisma/client";
import { PunishmentType } from "@constants";

export async function getPunishmentsByUser(guildId: string, userId: string) {
  return prisma.punishments.findMany({
    where: {
      guild_id: BigInt(guildId),
      user_id: BigInt(userId),
    },
  });
}
export async function getLatestPunishmentByUserAndType(
  guildId: string,
  userId: string,
  punishmentType: PunishmentType,
) {
  return prisma.punishments.findUnique({
    where: {
      guild_id_user_id_type: {
        guild_id: BigInt(guildId),
        user_id: BigInt(userId),
        type: punishmentType,
      },
    },
  });
}
export async function getExpiredPunishments() {
  return prisma.punishments.findMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });
}

export async function createPunishment(guildId: string, punishment: Omit<Prisma.punishmentsCreateInput, "guild_id">) {
  await prisma.punishments.create({
    data: {
      ...punishment,
      guild_id: BigInt(guildId),
    },
  });
}

export async function updatePunishment(
  guildId: string,
  userId: string,
  type: string,
  punishment: Omit<Prisma.punishmentsUpdateInput, "guild_id">,
) {
  if (Object.keys(punishment).length === 0) return;

  await prisma.punishments.update({
    where: {
      guild_id_user_id_type: {
        guild_id: BigInt(guildId),
        user_id: BigInt(userId),
        type,
      },
    },
    data: {
      ...punishment,
      guild_id: BigInt(guildId),
    },
  });
}

export async function deletePunishment(guildId: string, userId: string, type: string) {
  await prisma.punishments.delete({
    where: {
      guild_id_user_id_type: {
        user_id: BigInt(userId),
        guild_id: BigInt(guildId),
        type,
      },
    },
  });
}
export async function deleteExpiredPunishments() {
  await prisma.punishments.deleteMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });
}
