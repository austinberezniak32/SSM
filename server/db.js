// Database layer. Uses real Postgres when DATABASE_URL is set (Railway),
// otherwise falls back to an in-memory Postgres emulator (pg-mem) for local dev.
import pg from 'pg';

let pool;
export let isDevDb = false;

export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: url.includes('railway') || url.includes('rlwy') ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  } else {
    isDevDb = true;
    const { newDb } = await import('pg-mem');
    const mem = newDb();
    const adapter = mem.adapters.createPg();
    pool = new adapter.Pool();
    console.warn('[db] DATABASE_URL not set — using in-memory dev database (data lost on restart)');
  }

  await migrate();
  return pool;
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      vendor TEXT NOT NULL DEFAULT '',
      invoice_number TEXT NOT NULL DEFAULT '',
      po TEXT NOT NULL DEFAULT '',
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      received_by TEXT NOT NULL DEFAULT '',
      condition TEXT NOT NULL DEFAULT 'Good',
      location TEXT NOT NULL DEFAULT 'shop',
      status TEXT NOT NULL DEFAULT 'at_shop',
      sent_at TEXT,
      notes TEXT NOT NULL DEFAULT '',
      photo_id INTEGER,
      created_at TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS line_items (
      id SERIAL PRIMARY KEY,
      receipt_id INTEGER NOT NULL,
      part_number TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'EA',
      qty DOUBLE PRECISION NOT NULL DEFAULT 1,
      unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      line_total DOUBLE PRECISION NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po TEXT NOT NULL,
      job_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      vendor TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Mechanical',
      qty_ordered DOUBLE PRECISION NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Ordered',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      mime TEXT NOT NULL DEFAULT 'image/jpeg',
      data BYTEA NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export function q(text, params) {
  return pool.query(text, params);
}
