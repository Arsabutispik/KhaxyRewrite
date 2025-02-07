//Don't run this if you do not know what you are doing. This is a script to generate schema from a docker container
import { execSync } from "child_process";

const CONTAINER_NAME = "test-postgres"; // Replace with your actual container name
const DB_NAME = "postgres";
const OUTPUT_FILE = "init.sql"; // This will be saved locally

try {
  console.log("🔄 Dumping database schema from Docker...");

  // Run `pg_dump` inside the container, but write output to the local machine
  execSync(`docker exec -t ${CONTAINER_NAME} pg_dump -U postgres -s ${DB_NAME} --encoding=UTF8 --no-owner --no-acl docker exec -i your_container psql -U your_user -d postgres -c "CREATE DATABASE test_db;"> ${OUTPUT_FILE}`, {
    shell: "powershell.exe", // Use PowerShell for correct redirection on Windows
    stdio: "inherit",
  });

  console.log(`✅ Schema exported to ${OUTPUT_FILE}`);
} catch (error) {
  console.error("❌ Failed to generate schema:", error);
}