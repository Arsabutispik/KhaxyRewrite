import { Client } from "discord.js";
import { logger } from "@lib";

export async function loadEmojis(
  client: Client,
  emojiObject: Array<{ name: string; id: string; fallback: string }>,
): Promise<void> {
  try {
    const emojis = await client.application?.emojis.fetch();
    if (!emojis?.size) {
      logger.log({
        level: "warn",
        message: "No emojis found.",
        discord: false,
      });
      for (const emoji of emojiObject) {
        client.allEmojis.set(emoji.id, {
          name: emoji.name,
          format: emoji.fallback,
        });
      }
      return;
    }
    for (const emoji of emojiObject) {
      const fetchedEmoji = emojis.find((e) => e.id === emoji.id);
      if (!fetchedEmoji) {
        logger.log({
          level: "warn",
          message: `Emoji "${emoji.name}" not found.`,
          discord: false,
        });
        client.allEmojis.set(emoji.id, {
          name: emoji.name,
          format: emoji.fallback,
        });
      } else {
        if (fetchedEmoji.animated) {
          client.allEmojis.set(emoji.id, {
            name: emoji.name,
            format: `<a:${fetchedEmoji.name}:${fetchedEmoji.id}>`,
            id: fetchedEmoji.id,
          });
        } else {
          client.allEmojis.set(emoji.id, {
            name: emoji.name,
            format: `<:${fetchedEmoji.name}:${fetchedEmoji.id}>`,
            id: fetchedEmoji.id,
          });
        }
      }
    }
  } catch (e) {
    logger.log({
      level: "error",
      message: "Error fetching emojis",
      error: e,
      discord: false,
    });
  }
}
