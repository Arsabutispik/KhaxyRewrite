import fs from "fs";
import path from "path";

const baseLang = "en";
const localesDir = path.join(process.cwd(), "locales");

function getKeys(obj, prefix = "") {
  return Object.keys(obj).reduce((res, key) => {
    const value = obj[key];
    const prefixedKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      res.push(...getKeys(value, prefixedKey));
    } else {
      res.push(prefixedKey);
    }
    return res;
  }, []);
}

function validateKeys(baseLangFilePath, langFilePath, lang, file) {
  const baseFileContent = fs.readFileSync(baseLangFilePath, "utf-8");
  const langFileContent = fs.readFileSync(langFilePath, "utf-8");

  const baseKeys = getKeys(JSON.parse(baseFileContent));
  const langKeys = getKeys(JSON.parse(langFileContent));

  const missingKeys = baseKeys.filter((key) => !langKeys.includes(key));

  return missingKeys.length > 0 ? { file, lang, missingKeys } : null;
}

function getAllJsonFiles(dir) {
  return fs.readdirSync(dir).filter((file) => file.endsWith(".json"));
}

const baseLangDir = path.join(localesDir, baseLang);
const otherLangDirs = fs.readdirSync(localesDir).filter((lang) => lang !== baseLang);

let allMissingKeys = [];

otherLangDirs.forEach((lang) => {
  const langDir = path.join(localesDir, lang);
  const langFiles = getAllJsonFiles(langDir);

  langFiles.forEach((file) => {
    const baseLangFilePath = path.join(baseLangDir, file);
    const langFilePath = path.join(langDir, file);

    if (fs.existsSync(baseLangFilePath)) {
      // Compare the base and target language files for missing keys
      const result = validateKeys(baseLangFilePath, langFilePath, lang, file);
      if (result) {
        allMissingKeys.push(result);
      }
    } else {
      console.warn(`Base file missing: ${baseLangFilePath}`);
    }
  });
});

if (allMissingKeys.length > 0) {
  console.error(`\nFound missing translation keys in the following files:`);
  allMissingKeys.forEach(({ lang, file, missingKeys }) => {
    console.error(`\nLanguage: ${lang}`);
    console.error(`File: ${file}`);
    missingKeys.forEach((key) => console.error(`  - ${key}`));
  });
  process.exit(1); // Fail the CI check
} else {
  console.log("All translation files are valid.");
}
