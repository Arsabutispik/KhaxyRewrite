import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const migrationName = process.argv[2];

if (!migrationName) {
  console.error("❌ Please provide a migration name!");
  process.exit(1);
}

// Run node-pg-migrate
execSync(`pnpm exec node-pg-migrate create ${migrationName}`, { stdio: "inherit" });

// Rename .js to .cjs
const migrationsDir = path.join(process.cwd(), "migrations");
fs.readdirSync(migrationsDir).forEach((file) => {
  if (file.endsWith(".js")) {
    const oldPath = path.join(migrationsDir, file);
    const newPath = oldPath.replace(".js", ".cjs");
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed: ${file} → ${path.basename(newPath)}`);
  }
});
