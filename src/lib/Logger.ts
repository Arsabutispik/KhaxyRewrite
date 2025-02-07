import { createLogger, transports, format } from "winston";
import DiscordTransport from "./DiscordTransport.js";
import "dotenv/config.js";
const logger = createLogger({
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(({ timestamp, level, message, metadata }) => {
          return `[${timestamp}] ${level}: ${message}. ${JSON.stringify(metadata)}`;
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
      level: "error",
    }),
  ],
  format: format.combine(format.metadata(), format.timestamp()),
});
export default logger;
