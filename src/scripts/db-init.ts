import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Use process.cwd() to get the project root directory
const INIT_SQL_PATH = path.resolve(process.cwd(), "init.sql");

const LOCAL_DB_COMMAND = `psql -h localhost -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -f "${INIT_SQL_PATH}"`;
const DOCKER_DB_COMMAND = `docker exec -i ${process.env.DB_CONTAINER} psql -U ${process.env.DB_USER} -d ${process.env.DB_NAME} < "${INIT_SQL_PATH}"`;

function isDockerRunning(): boolean {
  try {
    const output = execSync(`docker ps --filter "name=${process.env.DB_CONTAINER}" --format "{{.Names}}"`)
      .toString()
      .trim();
    return output === process.env.DB_CONTAINER;
  } catch {
    return false;
  }
}

const commandToRun = isDockerRunning() ? DOCKER_DB_COMMAND : LOCAL_DB_COMMAND;

console.log(`Running: ${commandToRun}`);
try {
  execSync(commandToRun, { stdio: "inherit", shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" });
  console.log("✅ Database initialized successfully!");
} catch (error) {
  console.error("❌ Error initializing the database:", error);
  process.exit(1);
}
