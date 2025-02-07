import "dotenv/config.js";
import { KhaxyClient } from "../../@types/types";
import logger from "./Logger.js";

export default {
  IconURL: "https://cdn.discordapp.com/attachments/933095626844037224/1016257179872923708/music-disc.gif",
  Lavalink: {
    id: "Main", //- Used for identifier. You can set this to whatever you want.
    host: "lavalink.devamop.in", //- The host name or IP of the lavalink server.
    port: 443, // The port that lavalink is listening to. This must be a number!
    pass: "DevamOP", //- The password of the lavalink server.
    secure: true, // Set this to true if the lavalink uses SSL. if not set it to false.
    retryAmount: 50, //- The amount of times to retry connecting to the node if connection got dropped.
    retryDelay: 40, //- Delay between reconnect attempts if connection is lost.
  },
  Spotify: {
    clientID: process.env.SPOTIFY_ID, //- Your spotify client id.
    clientSecret: process.env.SPOTIFY_SECRET, //- Your spotify client secret.
  },
  Emojis: {
    //Replace these with your own emoji ID's that exists in the application emojis.
    searchEmoji: "1276505335145955421",
    gearSpinning: "1276244551203557428",
    mailSent: "1277019710147264542",
    confirm: "1278053289992392795",
    reject: "1278053315334111353",
    ban: "1278053275429634162",
    forceban: "1278053258492907591",
  },
};
export async function loadEmojis(
  client: KhaxyClient,
  emojiObject: Array<{ name: string; id: string; fallBack: string }>,
): Promise<void> {
  try {
    const emojis = await client.application?.emojis.fetch();
    if (!emojis) {
      logger.log({
        level: "warn",
        message: "No emojis found.",
      });
      for (const emoji of emojiObject) {
        client.allEmojis.set(emoji.id, {
          name: emoji.name,
          format: emoji.fallBack,
        });
      }
      return;
    }
    for (const emoji of emojiObject) {
      const fetchedEmoji = emojis.find((e) => e.id === emoji.id);
      if (!fetchedEmoji) {
        logger.warn(`Emoji ${emoji.name} not found.`);
        client.allEmojis.set(emoji.id, {
          name: emoji.name,
          format: emoji.fallBack,
        });
      } else {
        if (fetchedEmoji.animated) {
          client.allEmojis.set(emoji.id, {
            name: emoji.name,
            format: `<a:${fetchedEmoji.name}:${fetchedEmoji.id}>`,
          });
        } else {
          client.allEmojis.set(emoji.id, {
            name: emoji.name,
            format: `<:${fetchedEmoji.name}:${fetchedEmoji.id}>`,
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
