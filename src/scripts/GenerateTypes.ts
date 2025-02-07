//Don't run this file if you don't know what you're doing.
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import "dotenv/config.js"
import * as process from "node:process";


const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

const pgToTsMap: Record<string, string> = {
  integer: 'number',
  smallint: 'number',
  bigint: 'number',
  numeric: 'number',
  real: 'number',
  double: 'number',
  serial: 'number',
  bigserial: 'number',
  boolean: 'boolean',
  text: 'string',
  varchar: 'string',
  'character varying': 'string',
  char: 'string',
  uuid: 'string',
  json: 'any',
  jsonb: 'any',
  date: 'string',
  timestamp: 'string',
  'timestamp without time zone': 'string',
  'timestamp with time zone': 'string',
  timestamptz: 'string',
  _int4: 'number[]',
  _text: 'string[]',
  _bool: 'boolean[]',
  _varchar: 'string[]',
  _uuid: 'string[]',
  _json: 'any[]',
  _jsonb: 'any[]',
  bytea: 'Buffer',
  money: 'string',
  inet: 'string',
  cidr: 'string',
  macaddr: 'string',
  interval: 'string',
  'USER-DEFINED': 'any',
};

async function getTables(): Promise<string[]> {
  const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public';
  `);
  return result.rows.map(row => row.table_name);
}

async function getTableSchema(table: string) {
  const result = await pool.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns 
    WHERE table_name = $1;
  `, [table]);

  return result.rows.map(row => {
    let tsType = pgToTsMap[row.data_type] || 'any';

    if (!pgToTsMap[row.data_type]) {
      console.warn(`⚠️ Unmapped type: ${row.data_type} (column: ${row.column_name} in ${table})`);
    }

    if (row.data_type.startsWith('_')) {
      const baseType = row.data_type.slice(1);
      tsType = pgToTsMap[baseType] ? `${pgToTsMap[baseType]}[]` : 'any[]';
    }

    return { name: row.column_name, type: tsType };
  });
}

async function generateTypes() {
  const tables = await getTables();
  let output = `// Auto-generated types from PostgreSQL\n\n`;

  for (const table of tables) {
    const columns = await getTableSchema(table);
    output += `export type ${capitalize(table)} = {\n`;
    columns.forEach(col => {
      output += `  ${col.name}: ${col.type};\n`;
    });
    output += `};\n\n`;
  }

  const typesFolder = path.join(process.cwd(), '@types'); // Ensure it's in the project root
  if (!fs.existsSync(typesFolder)) {
    fs.mkdirSync(typesFolder, { recursive: true });
  }
  const filePath = path.join(typesFolder, 'DatabaseTypes.d.ts');
  fs.writeFileSync(filePath, output);

  console.log(`✅ Type definitions generated at ${filePath}`);
  pool.end();
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

generateTypes().catch(console.error);
