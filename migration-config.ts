import "dotenv/config.js";
const config = {
  databaseUrl: process.env.DATABASE_URL, // Uses .env database URL
  migrationsTable: "pgmigrations", // Where migration history is stored
  dir: "migrations", // Folder where migration files are stored
  schema: "public", // Target schema (default: public)
  migrationTable: "pgmigrations", // Keeps track of applied migrations
  migrationFileExtension: "cjs"
};

export default config;