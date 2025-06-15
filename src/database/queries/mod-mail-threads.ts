import { prisma } from "@database";
import { Prisma } from "@prisma/client";
import { ModMailThreadStatus } from "@constants";

export async function getModMailThread(channelId: string, status?: ModMailThreadStatus) {
  return prisma.mod_mail_threads.findUnique({
    where: { channel_id: BigInt(channelId), status },
  });
}
export async function getModMailThreads(guildId: string, status?: ModMailThreadStatus) {
  return prisma.mod_mail_threads.findMany({
    where: { guild_id: BigInt(guildId), status },
  });
}
export async function getExpiredModMailThreads() {
  return prisma.mod_mail_threads.findMany({
    where: {
      status: ModMailThreadStatus.OPEN,
      close_date: {
        lte: new Date(),
      },
    },
  });
}
export async function getModMailThreadsByUser(userId: string, status?: ModMailThreadStatus) {
  return prisma.mod_mail_threads.findMany({
    where: { user_id: BigInt(userId), status },
  });
}

export async function getModMailThreadByUser(userId: string, status?: ModMailThreadStatus) {
  return prisma.mod_mail_threads.findFirst({
    where: { user_id: BigInt(userId), status },
  });
}

export async function createModMailThread(
  guildId: string,
  thread: Omit<Prisma.mod_mail_threadsCreateInput, "guild_id">,
): Promise<void> {
  await prisma.mod_mail_threads.create({
    data: {
      guild_id: BigInt(guildId),
      ...thread,
    },
  });
}

export async function updateModMailThread(
  channelId: bigint | number | string,
  thread: Partial<Prisma.mod_mail_threadsUpdateInput> & { status?: ModMailThreadStatus } = {},
): Promise<void> {
  if (Object.keys(thread).length === 0) return;

  await prisma.mod_mail_threads.update({
    where: { channel_id: BigInt(channelId) },
    data: {
      ...thread,
    },
  });
}
