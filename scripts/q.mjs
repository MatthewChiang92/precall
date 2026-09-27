import pg from "pg";
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
const q = process.argv[2];
console.table((await pool.query(q)).rows);
await pool.end();
