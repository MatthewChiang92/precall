// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await pool.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
const { rows } = await pool.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1",
);
console.log("tables:", rows.map((r) => r.table_name).join(", "));
await pool.end();
