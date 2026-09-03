// One-off: import Supabase Auth users into app_users, preserving their UUIDs
// so existing uploads.uploaded_by rows keep matching.
// Supabase cannot export password hashes — every user gets a random temp
// password printed below; share them and/or reset via scripts/create-user.mjs.
// Usage: node --env-file=.env scripts/import-supabase-users.mjs
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Paginated GoTrue admin list
async function listAllUsers() {
  const users = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `${URL_}/auth/v1/admin/users?per_page=100&page=${page}`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    if (!res.ok) throw new Error(`admin/users ${res.status}: ${await res.text()}`);
    const body = await res.json();
    users.push(...body.users);
    if (users.length >= body.total) return users;
    page++;
  }
}

const users = await listAllUsers();
if (users.length === 0) {
  console.log("No Supabase users found — nothing to import.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("Imported users (temp passwords — shown once):\n");
for (const u of users) {
  const email = (u.email || "").toLowerCase().trim();
  if (!email) continue;
  const tempPassword = randomBytes(8).toString("base64url");
  await client.query(
    `INSERT INTO app_users (id, email, name, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    [u.id, email, (u.user_metadata?.name ?? "") || "", hashPassword(tempPassword)]
  );
  console.log(`  ${email.padEnd(40)} ${tempPassword}`);
}

await client.end();
console.log(`\nDone — ${users.length} user(s). Reset any password with:`);
console.log("  node --env-file=.env scripts/create-user.mjs <email> <new-password> [name]");
