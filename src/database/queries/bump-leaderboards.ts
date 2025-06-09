import { prisma } from "@database";
import type { bump_leaderboard as BumpLeaderboard } from "@prisma/client";

export async function getBumpLeaderboard(guildId: string) {
  return prisma.bump_leaderboard.findMany({ where: { guild_id: BigInt(guildId) } });
}

export async function getBumpLeaderboardByUser(guildId: string, userId: string): Promise<BumpLeaderboard | null> {
  return prisma.bump_leaderboard.findUnique({
    where: {
      guild_id_user_id: {
        guild_id: BigInt(guildId),
        user_id: BigInt(userId),
      },
    },
  });
}

export async function updateBumpLeaderboard(guildId: string, userId: string): Promise<void> {
  await prisma.bump_leaderboard.upsert({
    where: {
      guild_id_user_id: {
        guild_id: BigInt(guildId),
        user_id: BigInt(userId),
      },
    },
    create: {
      guild_id: BigInt(guildId),
      user_id: BigInt(userId),
      bump_count: 1,
    },
    update: {
      bump_count: {
        increment: 1,
      },
    },
  });
}

export async function resetBumpLeaderboard(guildId: string): Promise<void> {
  await prisma.bump_leaderboard.deleteMany({
    where: {
      guild_id: BigInt(guildId),
    },
  });
}

export async function getTopBumpers(guildId: string, limit: number = 10): Promise<BumpLeaderboard[]> {
  return prisma.bump_leaderboard.findMany({
    where: {
      guild_id: BigInt(guildId),
    },
    orderBy: {
      bump_count: "desc",
    },
    take: limit,
  });
}
