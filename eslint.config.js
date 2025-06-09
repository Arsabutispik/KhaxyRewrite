import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import i18nJson from "eslint-plugin-i18n-json";
import jsoncParser from "jsonc-eslint-parser";

export default [
  {
    ignores: ["dist/", "node_modules/", "scripts/", "eslint.config.js", "coverage/"],
  },
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn"],
    },
  },
  {
    files: ["locales/**/*.json"],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      "i18n-json": i18nJson,
    },
    rules: {
      "i18n-json/identical-keys": ["error", { filePath: "locales/en/translation.json" }],
      "i18n-json/valid-message-syntax": "error",
    },
  },
];
