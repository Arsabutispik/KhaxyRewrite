//Don't run this if you do not know what you are doing. This is a script to generate schema from a docker container
import { execSync } from "child_process";
import "dotenv/config.js";
import process from "node:process";

const CONTAINER_NAME = process.env.DB_CONTAINER; // Replace with your actual container name
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;

try {
  console.log("🔄 Dumping database schema from Docker...");

  // Run `pg_dump` inside the container, but write output to the local machine
  execSync(
    `docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} -s ${DB_NAME} --encoding=UTF8 --no-owner --no-acl > init.sql`,
    {
      stdio: "inherit",
    },
  );

  console.log(`✅ Schema exported to init.sql`);
} catch (error) {
  console.error("❌ Failed to generate schema:", error);
}
