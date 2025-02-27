import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import i18nJson from "eslint-plugin-i18n-json";
import jsoncParser from "jsonc-eslint-parser";

export default [
  // ✅ Ignore compiled files, scripts folder, and eslint.config.js
  {
    name: "ignore-config",
    ignores: ["dist/", "node_modules/", "scripts/", "eslint.config.js"],
  },
  // ✅ TypeScript/JavaScript Files: Apply TypeScript ESLint rules
  {
    name: "typescript-config",
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
      parser: tsParser, // ✅ Correctly pass the TypeScript parser
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules, // ✅ Apply TS rules
    },
  },
  // ✅ JSON Files: Apply i18n rules with JSON parser
  {
    name: "i18n-json-config",
    files: ["locales/**/*.json"],
    languageOptions: {
      parser: jsoncParser, // ✅ Use JSON parser
    },
    plugins: {
      "i18n-json": i18nJson,
    },
    rules: {
      "i18n-json/identical-keys": ["error", { filePath: "locales/en.json" }],
      "i18n-json/valid-message-syntax": "error",
    },
  },
];
