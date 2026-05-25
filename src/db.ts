import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diset di file .env");
}

export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false,
  timezone: "Z",
});

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  insertId: number;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const [result] = await pool.query(text, params ?? []);
  if (Array.isArray(result)) {
    const rows = result as unknown as T[];
    return { rows, rowCount: rows.length, insertId: 0 };
  }
  const r = result as mysql.ResultSetHeader;
  return { rows: [], rowCount: r.affectedRows, insertId: r.insertId };
}

export async function findOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}
