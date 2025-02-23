import "dotenv/config.js";
const config = {
  databaseUrl: `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@localhost:5432/${process.env.DB_NAME}`, // Uses .env database URL
  migrationsTable: "pgmigrations", // Where migration history is stored
  dir: "migrations", // Folder where migration files are stored
  schema: "public", // Target schema (default: public)
  migrationTable: "pgmigrations", // Keeps track of applied migrations
  migrationFileExtension: "cjs"
};

export default config;