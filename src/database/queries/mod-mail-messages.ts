import { prisma } from "@database";
import { Prisma } from "@prisma/client";

export async function getModMailMessages(channelId: string) {
  return prisma.mod_mail_messages.findMany({
    where: { channel_id: BigInt(channelId) },
  });
}

export async function createModMailMessage(
  channelId: string,
  message: Omit<Prisma.mod_mail_messagesCreateInput, "channel_id" | "mod_mail_threads">,
): Promise<void> {
  await prisma.mod_mail_messages.create({
    data: {
      channel_id: BigInt(channelId),
      ...message,
    },
  });
}

export async function updateModMailMessage(
  channelId: string,
  messageId: bigint | number | string,
  message: Omit<Prisma.mod_mail_messagesCreateInput, "channel_id" | "mod_mail_threads">,
): Promise<void> {
  if (Object.keys(message).length === 0) return;

  await prisma.mod_mail_messages.update({
    where: { message_id: BigInt(messageId) },
    data: {
      ...message,
      channel_id: BigInt(channelId),
    },
  });
}
