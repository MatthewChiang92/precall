import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const q = process.argv[2];
console.table(await sql.query(q));
