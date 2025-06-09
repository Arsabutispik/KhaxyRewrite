import Transport, { TransportStreamOptions } from "winston-transport";
/* eslint-disable */

export class DiscordTransport extends Transport {
  // Webhook obtained from Discord
  private readonly webhook: string;

  //Discord webhook id
  private id: string;

  //Discord webhook token
  private token: string;

  //Initialization promise resolved when the webhook is parsed
  private initialized: Promise<void>;

  //Available colors for the embed
  private static COLORS: { [key: string]: number } = {
    error: 14362664, // #db2828
    warn: 16497928, // #fbbd08
    info: 2196944, // #2185d0
    verbose: 6559689, // #6435c9
    debug: 2196944, // #2185d0
    silly: 2210373, // #21ba45
  };

  constructor(options: DiscordTransportOptions) {
    super(options);
    this.webhook = options.webhook;
    this.initialize();
  }

  //Helper function to parse the webhook
  private getURL = () => {
    return `https://discord.com/api/webhooks/${this.id}/${this.token}`;
  };

  private initialize = () => {
    this.initialized = new Promise((resolve, reject) => {
      fetch(this.webhook, {
        method: "GET",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Invalid webhook");
          }
          return response.json();
        })
        .then((data) => {
          this.id = data.id;
          this.token = data.token;
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  /**
   * Function exposed to winston to be called when logging messages
   * @param info Log message from winston
   * @param callback Callback to winston to complete the log
   */
  log(info: any, callback: { (): void }) {
    if ("discord" in info.metadata ? info.metadata.discord : true) {
      setImmediate(() => {
        this.initialized
          .then(() => {
            this.sendToDiscord(info).then(() => {});
          })
          .catch((err) => {
            console.log("Error sending message to discord", err);
          });
      });
    }

    callback();
  }

  /**
   * Sends log message to discord
   */
  private sendToDiscord = async (info: any) => {
    const postBody = {
      content: undefined as unknown as string,
      embeds: [
        {
          description: info.message,
          color: DiscordTransport.COLORS[info.level],
          fields: [] as any[],
          timestamp: new Date().toISOString(),
        },
      ],
    };
    if (info.level === "error" && info.metadata.error && info.metadata.error.stack) {
      postBody.content = `\`\`\`${info.metadata.error.stack}\`\`\``;
    }

    if (info.metadata.meta) {
      Object.keys(info.metadata.meta).forEach((key) => {
        postBody.embeds[0].fields.push({
          name: key,
          value: info.metadata.meta[key],
        });
      });
    }

    const options = {
      url: this.getURL(),
      method: "POST",
      json: true,
      body: postBody,
    };

    try {
      // await request(options);
      await fetch(options.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options.body),
      });
    } catch (err) {
      console.error("Error sending to discord");
    }
  };
}

interface DiscordTransportOptions extends TransportStreamOptions {
  // Webhook obtained from Discord
  webhook: string;
}
