'use strict';
/**
 * PostgreSQL data layer for Muwaqe Estates.
 * Uses DATABASE_URL when available; falls back to embedded-postgres in dev
 * when EMBEDDED_PG=1, otherwise the JSON file store is used by index.js.
 */
const { Pool } = require('pg');

let pool = null;

async function init(connectionString) {
  pool = new Pool({ connectionString, max: 5, ssl: /sslmode=require|render.com|railway/.test(connectionString) ? { rejectUnauthorized: false } : undefined });
  await pool.query('SELECT 1');
  await migrate();
  return pool;
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      unit_number TEXT NOT NULL,
      project_id TEXT, project_name TEXT,
      city TEXT NOT NULL, district TEXT,
      national_address TEXT,
      area_sqm NUMERIC, rooms INT, bathrooms INT, floor INT,
      price NUMERIC NOT NULL, currency TEXT DEFAULT 'SAR',
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      inquiry_number TEXT UNIQUE NOT NULL,
      unit_id TEXT REFERENCES units(id),
      status TEXT DEFAULT 'active',
      verified BOOLEAN DEFAULT true,
      unit_locked BOOLEAN DEFAULT false,
      developer_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      number TEXT UNIQUE NOT NULL,
      purpose TEXT,
      parent_account_id TEXT,
      listing_id TEXT,
      unit_id TEXT,
      balance NUMERIC DEFAULT 0,
      currency TEXT DEFAULT 'SAR',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      listing_id TEXT REFERENCES listings(id),
      buyer_name TEXT, buyer_id TEXT,
      amount NUMERIC,
      status TEXT DEFAULT 'confirmed',
      unit_snapshot JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      listing_number TEXT,
      account_number TEXT,
      virtual_account_number TEXT,
      purpose TEXT,
      cycle TEXT,
      amount NUMERIC NOT NULL,
      currency TEXT DEFAULT 'SAR',
      description TEXT,
      status TEXT DEFAULT 'issued',
      due_date TEXT,
      issued_at TIMESTAMPTZ DEFAULT now(),
      paid_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_number TEXT REFERENCES invoices(number),
      virtual_account_number TEXT,
      amount NUMERIC NOT NULL,
      method TEXT,
      reference TEXT,
      status TEXT DEFAULT 'completed',
      paid_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      listing_id TEXT,
      unit_id TEXT,
      actor TEXT,
      meta JSONB,
      at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_listings_inquiry ON listings(inquiry_number);
    CREATE INDEX IF NOT EXISTS idx_accounts_number ON accounts(number);
    CREATE INDEX IF NOT EXISTS idx_invoices_va ON invoices(virtual_account_number);
  `);
}

function q(text, params) { return pool.query(text, params); }

const pg = {
  init, q,
  get ready() { return !!pool; }
};

module.exports = pg;
