const fs = require("fs");
const path = require("path");

const baseLang = "en";
const localesDir = path.join(__dirname, "locales");

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

function validateKeys(baseKeys, lang, filePath) {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const langKeys = getKeys(JSON.parse(fileContent));
  const missingKeys = baseKeys.filter((key) => !langKeys.includes(key));
  if (missingKeys.length > 0) {
    console.error(`Missing keys in ${lang} translation (${filePath}):`, missingKeys);
    process.exit(1);
  }
}

function getAllJsonFiles(dir) {
  return fs.readdirSync(dir).filter((file) => file.endsWith(".json"));
}

const baseFiles = getAllJsonFiles(path.join(localesDir, baseLang));
const baseKeys = baseFiles.reduce((keys, file) => {
  const filePath = path.join(localesDir, baseLang, file);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return keys.concat(getKeys(JSON.parse(fileContent)));
}, []);

fs.readdirSync(localesDir).forEach((lang) => {
  if (lang !== baseLang) {
    const langDir = path.join(localesDir, lang);
    const langFiles = getAllJsonFiles(langDir);
    langFiles.forEach((file) => {
      const filePath = path.join(langDir, file);
      validateKeys(baseKeys, lang, filePath);
    });
  }
});

console.log("All translation files are valid.");
