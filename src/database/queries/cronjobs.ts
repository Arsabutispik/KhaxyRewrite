import { prisma } from "@database"; // Your initialized PrismaClient
import type { cronjobs as Cronjobs } from "@prisma/client";

export async function getCronJobs(): Promise<Cronjobs[]> {
  return prisma.cronjobs.findMany();
}

export async function createCronJob(guildId: string, cronJob: Partial<Cronjobs>): Promise<void> {
  if (!cronJob) throw new Error("No cron job data provided");

  await prisma.cronjobs.create({
    data: {
      id: BigInt(guildId),
      ...cronJob,
    },
  });
}

export async function updateCronJob(guildId: string, cronJob: Partial<Cronjobs>): Promise<void> {
  if (!cronJob) throw new Error("No cron job data provided");

  await prisma.cronjobs.update({
    where: { id: BigInt(guildId) },
    data: cronJob,
  });
}
