import { createLogger, transports, format } from "winston";
import DiscordTransport from "./DiscordTransport.js";
const logger = createLogger({
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize({all: true}),
                format.printf(({ timestamp, level, message, metadata }) => {
                    return `[${timestamp}] ${level}: ${message}. ${JSON.stringify(
                        metadata
                    )}`;
                })
            ),
        }),
        new transports.File({
            dirname: "logs",
            filename: "logs.log",
            level: "error",
            format: format.combine(format.json()),
        }),
        new DiscordTransport({
            webhook: "https://discord.com/api/webhooks/1332312985816793148/qpheFh6AlCcxNi8GWvtW2AFL7r_BuRbs8Ufg-TDd68v0h5ZI1g8Od9X-Sq2gbjgoDy9y",
            level: "error",
        })
    ],
    format: format.combine(format.metadata(), format.timestamp()),
});
export default logger;