import fs from "fs";
import path from "path";
import chalk from "chalk";

const baseLang = "en-GB";
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

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error(chalk.red(`❌ Error reading or parsing: ${filePath}\n${e.message}`));
    return null;
  }
}

function validateKeys(baseLangFilePath, langFilePath, lang, file) {
  const baseObj = safeReadJson(baseLangFilePath);
  const langObj = safeReadJson(langFilePath);
  if (!baseObj || !langObj) return null;

  const baseKeys = getKeys(baseObj);
  const langKeys = getKeys(langObj);

  const missingKeys = baseKeys.filter((key) => !langKeys.includes(key));
  const extraKeys = langKeys.filter((key) => !baseKeys.includes(key));

  return { file, lang, missingKeys, extraKeys };
}

function getAllJsonFiles(dir) {
  return fs.readdirSync(dir).filter((file) => file.endsWith(".json"));
}

const baseLangDir = path.join(localesDir, baseLang);
const otherLangDirs = fs.readdirSync(localesDir).filter((lang) => lang !== baseLang);

let allIssues = [];
let totalMissingKeys = 0;
let totalExtraKeys = 0;

otherLangDirs.forEach((lang) => {
  const langDir = path.join(localesDir, lang);
  const langFiles = getAllJsonFiles(langDir);

  langFiles.forEach((file) => {
    const baseLangFilePath = path.join(baseLangDir, file);
    const langFilePath = path.join(langDir, file);

    if (fs.existsSync(baseLangFilePath)) {
      const result = validateKeys(baseLangFilePath, langFilePath, lang, file);
      if (result && (result.missingKeys.length > 0 || result.extraKeys.length > 0)) {
        allIssues.push(result);
        totalMissingKeys += result.missingKeys.length;
        totalExtraKeys += result.extraKeys.length;
      }
    } else {
      console.warn(chalk.yellow(`⚠️  Base file missing: ${baseLangFilePath}`));
    }
  });
});

if (allIssues.length > 0) {
  console.error(chalk.red.bold(`\n🚨 Translation issues detected:`));
  allIssues.forEach(({ lang, file, missingKeys, extraKeys }) => {
    console.error(`\n🌍 ${chalk.blue.bold(lang)} ➜ ${chalk.cyan.bold(file)}`);
    if (missingKeys.length > 0) {
      console.error(chalk.red(`  ❌  Missing keys (${missingKeys.length}):`));
      missingKeys.forEach((key) => console.error(`    ${chalk.red.bold("- " + key)}`));
    }
    if (extraKeys.length > 0) {
      console.error(chalk.yellow(`  ⚠️ Extra keys: (${extraKeys.length})`));
      extraKeys.forEach((key) => console.error(`    ${chalk.yellow.bold("- " + key)}`));
    }
  });
  console.error(chalk.blue.bold(`\n📊 Summary:`));
  console.error(chalk.red(`  ❌  Total missing keys: ${totalMissingKeys}`));
  console.error(chalk.yellow(`  ⚠️ Total extra keys: ${totalExtraKeys}`));
  process.exit(1);
} else {
  console.log(chalk.green.bold("✅  All translation files are valid."));
  process.exit(0);
}
