import { execSync } from "child_process";
import "dotenv/config.js";
import path from "path";
import process from "node:process";
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const CONTAINER_NAME = process.env.DB_CONTAINER;
const PG_PORT = 5432;

const INIT_SQL_PATH = path.resolve(process.cwd(), "init.sql");
const VOLUME_NAME = `${CONTAINER_NAME}_data`;

const sleep = (seconds) => {
  if (process.platform === "win32") {
    execSync(`powershell -Command "Start-Sleep -Seconds ${seconds}"`, { stdio: "ignore" });
  } else {
    execSync(`sleep ${seconds}`);
  }
};

function runCommand(command) {
  try {
    console.log(`🟢 Running...`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`❌ Error running command.`);
    console.error(error);
    process.exit(1);
  }
}

function isDockerInstalled() {
  try {
    execSync("docker -v", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isPostgresRunningInDocker() {
  try {
    const output = execSync(`docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}"`).toString().trim();
    return output === CONTAINER_NAME;
  } catch {
    return false;
  }
}

function isLocalPostgresRunning() {
  try {
    execSync(`pg_isready -U ${DB_USER}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isDatabaseInitialized() {
  try {
    execSync(`docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1 FROM guilds LIMIT 1;"`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function removeExistingContainer() {
  try {
    execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: "ignore" });
    console.log(`🗑️ Removed existing container: ${CONTAINER_NAME}`);
  } catch {
    console.log("ℹ️ No existing container found.");
  }
}

if (isDockerInstalled()) {
  if (!isPostgresRunningInDocker()) {
    console.log("🚀 Starting PostgreSQL in Docker...");
    removeExistingContainer();

    runCommand(
      `docker run --name ${CONTAINER_NAME} \
    -e POSTGRES_USER=${DB_USER} \
    -e POSTGRES_PASSWORD=${DB_PASSWORD} \
    -e POSTGRES_DB=${DB_NAME} \
    -p ${PG_PORT}:5432 \
    -v ${VOLUME_NAME}:/var/lib/postgresql/data \
    -v ${INIT_SQL_PATH}:/docker-entrypoint-initdb.d/init.sql \
    -d postgres`,
    );
  } else {
    console.log("✅ PostgreSQL is already running in Docker.");
  }
} else if (isLocalPostgresRunning()) {
  console.log("✅ Using local PostgreSQL.");
} else {
  console.error("❌ No PostgreSQL instance found (Docker or Local). Exiting...");
  process.exit(1);
}

function waitForPostgres() {
  let retries = 10;
  while (retries > 0) {
    try {
      execSync(`docker exec ${CONTAINER_NAME} pg_isready -U ${DB_USER}`, { stdio: "ignore" });
      console.log("✅ PostgreSQL is ready!");
      return;
    } catch {
      console.log("⏳ Waiting for PostgreSQL to start...");
      retries--;
      if (retries === 0) {
        console.error("❌ PostgreSQL failed to start.");
        process.exit(1);
      }
      sleep(2);
    }
  }
}
waitForPostgres();

// Run init.sql if the database is not initialized
if (isDatabaseInitialized()) {
  console.log("✅ Database is already initialized. Skipping init.sql.");
} else {
  console.log("📂 Running init.sql...");
  runCommand(
    `docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -f /docker-entrypoint-initdb.d/init.sql`,
  );
}

console.log("📂 Running migrations...");
runCommand("pnpm migrate-up");

console.log("✅ Database setup complete!");
