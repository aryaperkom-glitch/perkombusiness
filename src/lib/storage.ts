import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Local file storage — replaced Supabase Storage.
// Keys are relative paths ("statements/<file>"); the root is a Docker
// volume (compose: uploads_data:/app/uploads) or ./uploads on the host.
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  const target = safeJoin(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
}

export function readFileFromStorage(key: string): Promise<Buffer> {
  return readFile(safeJoin(key));
}

// Storage keys are server-generated, but guard against path traversal anyway.
function safeJoin(key: string): string {
  const target = path.join(UPLOAD_DIR, key);
  const root = path.resolve(UPLOAD_DIR) + path.sep;
  if (!path.resolve(target).startsWith(root)) {
    throw new Error("Invalid storage path");
  }
  return target;
}
