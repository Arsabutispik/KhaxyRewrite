import { execSync } from "child_process";
import "dotenv/config.js";
import process from "node:process";
const CONTAINER_NAME = process.env.DB_CONTAINER; // Same as in setup-db.js

// Function to run shell commands
function runCommand(command) {
  try {
    console.log(`🛑 Running: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`❌ Error running command: ${command}`);
    console.error(error);
  }
}

// Check if Docker container is running
function isPostgresRunningInDocker() {
  try {
    const output = execSync(`docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}"`).toString().trim();
    return output === CONTAINER_NAME;
  } catch {
    return false;
  }
}

if (isPostgresRunningInDocker()) {
  console.log("🛑 Stopping and removing PostgreSQL Docker container...");
  runCommand(`docker stop ${CONTAINER_NAME}`);
  console.log("✅ PostgreSQL Docker container stopped.");
} else {
  console.log("⚠️ PostgreSQL Docker container is not running.");
}