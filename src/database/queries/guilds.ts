import { prisma } from "@database";
import type { guilds as Guilds } from "@prisma/client";

export async function getGuildConfig(guildId: string) {
  return prisma.guilds.findUnique({
    where: { id: BigInt(guildId) },
  });
}
export async function getGuilds() {
  return prisma.guilds.findMany();
}
export async function updateGuildConfig(guildId: string, config: Partial<Guilds>) {
  if (Object.keys(config).length === 0) return;

  await prisma.guilds.update({
    where: { id: BigInt(guildId) },
    data: config,
  });
}

export async function createGuildConfig(guildId: string, config: Partial<Guilds>) {
  await prisma.guilds.create({
    data: {
      id: BigInt(guildId),
      ...config,
    },
  });
}

export async function deleteGuildConfig(guildId: string) {
  await prisma.guilds.delete({
    where: { id: BigInt(guildId) },
  });
}
