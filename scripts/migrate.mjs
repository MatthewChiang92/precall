// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const pool = new Pool({ connectionString: url });
const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
await pool.query(sql);
const { rows } = await pool.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1",
);
console.log("tables:", rows.map((r) => r.table_name).join(", "));
await pool.end();
