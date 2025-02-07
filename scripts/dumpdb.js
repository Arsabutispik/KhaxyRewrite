import 'dotenv/config' // Load the .env file

import { exec } from 'child_process';
import path from 'path';

// Read values from environment variables
const containerName = process.env.DB_CONTAINER;
const localDumpPath = path.resolve(process.cwd(), "init.sql");  // Update with your desired local path
const containerDumpPath = '/tmp/backup.sql';
const postgresUser = process.env.DB_USER;
// Function to execute shell commands
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error executing command: ${stderr}`);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function dumpPostgres() {
  try {
    // Step 1: Execute pg_dump inside the container
    console.log('Creating dump inside the container...');
    await executeCommand(`docker exec -t ${containerName} pg_dump -U ${postgresUser} --no-password --format=p --file=${containerDumpPath}`);
    console.log('Dump created inside the container.');

    // Step 2: Copy the dump file from the container to the local machine
    console.log('Copying dump file to local machine...');
    await executeCommand(`docker cp ${containerName}:${containerDumpPath} ${localDumpPath}`);
    console.log('Dump file copied to local machine.');

    // Step 3: Optionally, clean up the dump file inside the container
    console.log('Cleaning up the container...');
    await executeCommand(`docker exec ${containerName} rm ${containerDumpPath}`);
    console.log('Cleaned up the container.');

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

dumpPostgres();
