import { createLogger, format, transports } from "winston";
import DiscordTransport from "./DiscordTransport.js";
import "dotenv/config.js";
import _ from "lodash";

const logger = createLogger({
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(({ timestamp, level, message, metadata }) => {
          const copy = _.cloneDeep(metadata);
          // @ts-ignore
          delete copy.discord;
          return `[${timestamp}] ${level}: ${message}${copy && Object.keys(copy).length ? ` ${JSON.stringify(copy)}` : ""}`;
        }),
      ),
    }),
    new transports.File({
      dirname: "logs",
      filename: "logs.log",
      level: "error",
      format: format.combine(format.json()),
    }),
    new DiscordTransport({
      webhook: process.env.WEBHOOKURL!,
    }),
  ],
  format: format.combine(format.metadata(), format.timestamp()),
});
export default logger;
