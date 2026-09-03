// Create or update a login user (replaces Supabase Auth users).
// Usage: node scripts/create-user.mjs <email> <password> [name]
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const [email, password, name = ""] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/create-user.mjs <email> <password> [name]");
  process.exit(1);
}

// Format must match src/lib/auth.ts hashPassword()
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const passwordHash = `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const result = await client.query(
  `INSERT INTO app_users (email, name, password_hash)
   VALUES ($1, $2, $3)
   ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
   RETURNING id, email`,
  [email.toLowerCase().trim(), name, passwordHash]
);

console.log(`Saved login user: ${result.rows[0].email} (${result.rows[0].id})`);
await client.end();
