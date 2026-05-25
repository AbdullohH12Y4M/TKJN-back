import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

/**
 * Menjalankan database.sql ke server MySQL.
 *
 * File database.sql di root project mengandung CREATE DATABASE + USE + CREATE TABLE,
 * jadi script ini terhubung TANPA memilih database tertentu (multipleStatements: true).
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diset di file .env");
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sqlPath = join(__dirname, "..", "..", "..", "database.sql");
  console.log(`Menjalankan ${sqlPath} ...`);
  const sql = await readFile(sqlPath, "utf-8");

  // Connect tanpa nama database supaya bisa CREATE DATABASE.
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    multipleStatements: true,
  });

  await conn.query(sql);
  await conn.end();
  console.log("Database, skema, dan data awal berhasil dibuat.");
}

main().catch((err) => {
  console.error("Gagal init DB:", err);
  process.exit(1);
});
