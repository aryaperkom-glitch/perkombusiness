import pg from "pg";

// Type parsers keep the JSON shapes the app received from Supabase REST:
// NUMERIC -> number, TIMESTAMPTZ -> ISO string (pg would return string/Date).
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());

declare global {
  var __dbPool: pg.Pool | undefined;
}

export const pool =
  global.__dbPool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

// Survive Next.js dev hot reloads without leaking connections
if (process.env.NODE_ENV !== "production") global.__dbPool = pool;

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return pool.query(text, params);
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}
