// One-off: copy every object in the Supabase bucket "dataperkom" into the
// Docker uploads volume, then rewrite managed_service_claims.file_url to the
// local /api/files route so old links keep working.
// Usage: node --env-file=.env scripts/import-supabase-files.mjs
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "dataperkom";
if (!URL_ || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function listDir(prefix) {
  const res = await fetch(`${URL_}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`list "${prefix}" ${res.status}: ${await res.text()}`);
  return res.json();
}

// Storage "folders" are objects with id === null
async function walk(prefix, out) {
  for (const entry of await listDir(prefix)) {
    if (entry.name.endsWith("/")) continue;
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) await walk(key, out);
    else out.push(key);
  }
}

async function download(key) {
  const url = `${URL_}/storage/v1/object/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download "${key}" ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const keys = [];
await walk("", keys);
console.log(`Found ${keys.length} object(s) in bucket "${BUCKET}".`);

const staging = path.join(".migration-files");
for (const key of keys) {
  const target = path.join(staging, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await download(key));
  console.log(`  downloaded ${key}`);
}

// Copy the whole tree into the running app container's uploads volume
if (keys.length > 0) {
  const cp = spawnSync("docker", ["compose", "cp", `${staging}/.`, "app:/app/uploads/"], { stdio: "inherit" });
  if (cp.status !== 0) {
    console.error("docker compose cp failed — files are staged in .migration-files/, copy manually.");
    process.exit(1);
  }
  // docker cp writes as root; restore ownership so the app (nextjs user) can keep writing
  spawnSync("docker", ["compose", "exec", "--user", "root", "app", "chown", "-R", "nextjs:nodejs", "/app/uploads"], { stdio: "inherit" });
}

// Rewrite old absolute Supabase URLs to the local serving route
const prefix = `${URL_}/storage/v1/object/public/${BUCKET}/`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rowCount } = await client.query(
  "UPDATE managed_service_claims SET file_url = REPLACE(file_url, $1, '/api/files/') WHERE file_url LIKE $1 || '%'",
  [prefix]
);
await client.end();
console.log(`Rewrote ${rowCount ?? 0} managed_service_claims.file_url row(s) to /api/files/.`);
console.log("Done. You can delete .migration-files/ and this script.");
