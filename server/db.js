// Database layer. Uses real Postgres when DATABASE_URL is set (Railway),
// otherwise falls back to an in-memory Postgres emulator (pg-mem) for local dev.
import pg from 'pg';

let pool;
export let isDevDb = false;

export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Railway's internal hostnames (postgres.railway.internal) speak plain TCP;
    // only public proxy URLs need SSL. Try without SSL first, fall back to SSL.
    pool = new pg.Pool({ connectionString: url, max: 10 });
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      if (!/ssl/i.test(String(err.message))) throw err;
      await pool.end().catch(() => {});
      pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 10 });
      await pool.query('SELECT 1');
    }
    console.log('[db] connected to Postgres');
  } else {
    isDevDb = true;
    let newDb;
    try {
      ({ newDb } = await import('pg-mem'));
    } catch {
      throw new Error(
        'DATABASE_URL is not set and the dev database (pg-mem) is not installed. ' +
        'In production, attach a PostgreSQL database so DATABASE_URL is provided.'
      );
    }
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
