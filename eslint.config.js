import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import i18nJson from "eslint-plugin-i18n-json";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["locales/**/*.json"],
    plugins: {
      "i18n-json": i18nJson,
    },
    rules: {
      "i18n-json/identical-keys": ["error", { filePath: "locales/en.json" }],
      "i18n-json/valid-message-syntax": "error",
    },
  },
];
