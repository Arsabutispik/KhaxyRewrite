import i18next from "i18next";
import FsBackend from "i18next-fs-backend/cjs";
import { logger } from "@lib";

export async function initI18n() {
  try {
    await i18next.use(FsBackend).init({
      initAsync: false,
      fallbackLng: "en-GB",
      lng: "en-GB",
      preload: ["en-GB", "tr-TR"],
      ns: ["translation", "events", "permissions", "commands", "help"],
      defaultNS: "translation",
      backend: {
        loadPath: "locales/{{lng}}/{{ns}}.json",
      },
      interpolation: { escapeValue: false },
      load: "currentOnly",
    });

    logger.log({
      level: "info",
      message: "i18next has been initialized.",
      discord: false,
    });
  } catch (err) {
    logger.log({
      level: "error",
      message: err,
      discord: false,
    });
  }
}

export default i18next;
