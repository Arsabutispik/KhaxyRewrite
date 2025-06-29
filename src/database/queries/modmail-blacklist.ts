import { prisma } from "@database";
import type { modmail_blacklist } from "@prisma/client";

export async function getModmailBlacklist(guildId: string) {
  return prisma.modmail_blacklist.findMany({ where: { guild_id: BigInt(guildId) } });
}

export async function getModmailBlacklistByUser(guildId: string, userId: string) {
  return prisma.modmail_blacklist.findFirst({
    where: {
      guild_id: BigInt(guildId),
      user_id: BigInt(userId),
    },
  });
}

export async function getExpiredModmailBlacklists() {
  return prisma.modmail_blacklist.findMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });
}

export async function addToModmailBlacklist(
  guildId: string,
  userId: string,
  data: Omit<modmail_blacklist, "guild_id" | "user_id" | "id">,
) {
  return prisma.modmail_blacklist.create({
    data: {
      guild_id: BigInt(guildId),
      user_id: BigInt(userId),
      ...data,
    },
  });
}

export async function removeFromModmailBlacklist(guildId: string, userId: string) {
  return prisma.modmail_blacklist.deleteMany({
    where: {
      guild_id: BigInt(guildId),
      user_id: BigInt(userId),
    },
  });
}

export async function removeExpiredModmailBlacklists() {
  return prisma.modmail_blacklist.deleteMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });
}
