import { execSync } from "child_process";
import process from "node:process";
try {
  console.log("🔍 Checking for pending migrations...");
  execSync("pnpm migrate-up", { stdio: "inherit" });
  console.log("✅ Migrations are up to date!");
} catch (error) {
  console.error("❌ Migration failed!", error);
  process.exit(1);
}