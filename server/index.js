'use strict';
/**
 * Muwaqe Estates — Digital Real Estate Governance Platform
 * Node.js server: REST API + static frontend.
 * Storage: PostgreSQL (DATABASE_URL) with JSON-file fallback.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, '..', 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || '';
const EMBEDDED_PG = process.env.EMBEDDED_PG === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

// ================= storage abstraction =================
const store = {
  mode: 'json', // 'json' | 'pg'
  pg: null,     // pg module handle
  pool: null,
  jdb: null     // json db
};

function id(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ---------- JSON store ----------
function defaultJsonDb() {
  return { users: [], listings: [], units: [], inquiries: [], bookings: [], invoices: [], payments: [], accounts: [], auditLog: [] };
}
function loadJsonDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      store.jdb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      for (const k of Object.keys(defaultJsonDb())) if (!store.jdb[k]) store.jdb[k] = [];
      return;
    }
  } catch (e) { console.error('[jsondb] load failed:', e.message); }
  store.jdb = defaultJsonDb();
  seedJson(); saveJsonDb();
}
let saveTimer = null;
function saveJsonDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store.jdb, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  }, 100);
}
function seedJson() {
  const demoUnits = [
    { unitNumber: 'A-1201', projectId: 'PRJ-ALNOOR', projectName: 'مشروع النور السكني / Al-Noor Residential', city: 'الرياض / Riyadh', district: 'حي الملقا / Al-Malqa', nationalAddress: '3245 6789 1234', areaSqm: 145, rooms: 3, bathrooms: 2, floor: 12, price: 1150000, currency: 'SAR' },
    { unitNumber: 'B-0402', projectId: 'PRJ-ALNOOR', projectName: 'مشروع النور السكني / Al-Noor Residential', city: 'جدة / Jeddah', district: 'حي الشاطئ / Al-Shatea', nationalAddress: '7512 8834 9021', areaSqm: 98, rooms: 2, bathrooms: 2, floor: 4, price: 780000, currency: 'SAR' }
  ];
  demoUnits.forEach((u, i) => {
    const unit = Object.assign({ id: 'UNIT-SEED-' + (i + 1) }, sanitizeUnit(u));
    store.jdb.units.push(unit);
    const listing = { id: 'LST-SEED-' + (i + 1), inquiryNumber: 'INQ-2025-00000' + (i + 1), unitId: unit.id, status: i === 0 ? 'booked' : 'active', verified: true, unitLocked: i === 0, createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(), developerId: 'DEV-001' };
    store.jdb.listings.push(listing);
    const account = { id: 'ACC-SEED-' + (i + 1), type: 'escrow', number: 'SA-ESC-SEED000' + (i + 1), listingId: listing.id, unitId: unit.id, balance: i === 0 ? 115000 : 0, currency: 'SAR', createdAt: listing.createdAt, active: true };
    store.jdb.accounts.push(account);
    jsonLog({ action: 'LISTING_CREATED', listingId: listing.id, inquiryNumber: listing.inquiryNumber, actor: 'DEV-001' });
    if (i === 0) {
      store.jdb.bookings.push({ id: 'BKG-SEED-1', listingId: listing.id, inquiryNumber: listing.inquiryNumber, buyerName: 'أحمد المطيري / Ahmed Al-Mutairi', buyerId: 'BYR-001', amount: 1150000, status: 'confirmed', createdAt: new Date().toISOString(), unitSnapshot: sanitizeUnit(u) });
      jsonLog({ action: 'UNIT_DATA_LOCKED', listingId: listing.id, unitId: unit.id, actor: 'BYR-001' });
      jsonLog({ action: 'BOOKING_CONFIRMED', listingId: listing.id, actor: 'BYR-001', bookingId: 'BKG-SEED-1' });
      const inv = { id: 'INV-SEED-1', number: 'INV-SEED0001', listingNumber: listing.inquiryNumber, accountNumber: account.number, virtualAccountNumber: 'SA-DEP-SEED0001', purpose: 'deposit', amount: 115000, currency: 'SAR', description: 'عربون حجز الوحدة A-1201 / Booking deposit for unit A-1201', status: 'paid', dueDate: null, issuedAt: new Date().toISOString(), paidAt: new Date().toISOString() };
      store.jdb.invoices.push(inv);
      store.jdb.payments.push({ id: 'PAY-SEED-1', invoiceNumber: inv.number, virtualAccountNumber: inv.virtualAccountNumber, amount: 115000, method: 'bank-transfer', reference: 'TRX-SEED0001', paidAt: new Date().toISOString(), status: 'completed' });
      store.jdb.accounts.push({ id: 'ACC-SEED-VA1', type: 'virtual', purpose: 'deposit', number: 'SA-DEP-SEED0001', parentAccountId: account.id, listingId: listing.id, unitId: unit.id, balance: 115000, createdAt: new Date().toISOString(), active: true });
      jsonLog({ action: 'PAYMENT_COMPLETED', invoiceNumber: inv.number, reference: 'TRX-SEED0001', amount: 115000 });
    }
  });
}

// ---------- shared logic helpers ----------
function genInquiryNumberSeq(nextVal) {
  return 'INQ-' + new Date().getFullYear() + '-' + String(nextVal).padStart(6, '0');
}
function genAccountNumber(kind) {
  const kinds = { escrow: 'SA-ESC', virtual: 'SA-VRT', deposit: 'SA-DEP', rent: 'SA-RNT', fee: 'SA-FEE', ownerUnion: 'SA-UNI' };
  return (kinds[kind] || 'SA-VRT') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function sanitizeUnit(u) {
  return {
    unitNumber: u.unitNumber, projectId: u.projectId || null, projectName: u.projectName || null,
    city: u.city, district: u.district || null, nationalAddress: u.nationalAddress || null,
    areaSqm: u.areaSqm != null ? Number(u.areaSqm) : null,
    rooms: u.rooms != null ? Number(u.rooms) : null,
    bathrooms: u.bathrooms != null ? Number(u.bathrooms) : null,
    floor: u.floor != null ? Number(u.floor) : null,
    price: Number(u.price), currency: u.currency || 'SAR'
  };
}

// ---------- PG init ----------
async function initPg(connectionString) {
  const { Pool } = require('pg');
  store.pg = { Pool };
  const ssl = /sslmode=require|render.com|railway.app|neon.tech|supabase/.test(connectionString) ? { rejectUnauthorized: false } : undefined;
  store.pool = new Pool({ connectionString, max: 5, ssl });
  await store.pool.query('SELECT 1');
  await migratePg();
  store.mode = 'pg';
  await ensurePgSeed();
}

async function migratePg() {
  await store.pool.query(`
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

async function ensurePgSeed() {
  const r = await store.pool.query('SELECT COUNT(*)::int AS n FROM listings');
  if (r.rows[0].n > 0) return;
  const demoUnits = [
    { unitNumber: 'A-1201', projectId: 'PRJ-ALNOOR', projectName: 'مشروع النور السكني / Al-Noor Residential', city: 'الرياض / Riyadh', district: 'حي الملقا / Al-Malqa', nationalAddress: '3245 6789 1234', areaSqm: 145, rooms: 3, bathrooms: 2, floor: 12, price: 1150000 },
    { unitNumber: 'B-0402', projectId: 'PRJ-ALNOOR', projectName: 'مشروع النور السكني / Al-Noor Residential', city: 'جدة / Jeddah', district: 'حي الشاطئ / Al-Shatea', nationalAddress: '7512 8834 9021', areaSqm: 98, rooms: 2, bathrooms: 2, floor: 4, price: 780000 }
  ];
  for (let i = 0; i < demoUnits.length; i++) {
    const u = demoUnits[i];
    const unitId = 'UNIT-SEED-' + (i + 1);
    await store.pool.query(
      `INSERT INTO units (id, unit_number, project_id, project_name, city, district, national_address, area_sqm, rooms, bathrooms, floor, price, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SAR')`,
      [unitId, u.unitNumber, u.projectId, u.projectName, u.city, u.district, u.nationalAddress, u.areaSqm, u.rooms, u.bathrooms, u.floor, u.price]
    );
    const listingId = 'LST-SEED-' + (i + 1);
    const inq = 'INQ-2025-00000' + (i + 1);
    const locked = i === 0;
    await store.pool.query(
      `INSERT INTO listings (id, inquiry_number, unit_id, status, verified, unit_locked, developer_id) VALUES ($1,$2,$3,$4,true,$5,'DEV-001')`,
      [listingId, inq, unitId, locked ? 'booked' : 'active', locked]
    );
    const accNum = 'SA-ESC-SEED000' + (i + 1);
    await store.pool.query(
      `INSERT INTO accounts (id, type, number, listing_id, unit_id, balance) VALUES ($1,'escrow',$2,$3,$4,$5)`,
      ['ACC-SEED-' + (i + 1), accNum, listingId, unitId, i === 0 ? 115000 : 0]
    );
    await pgLog('LISTING_CREATED', listingId, unitId, 'DEV-001', { inquiryNumber: inq });
    if (i === 0) {
      const snap = sanitizeUnit(u);
      await store.pool.query(
        `INSERT INTO bookings (id, listing_id, buyer_name, buyer_id, amount, unit_snapshot) VALUES ($1,$2,$3,$4,$5,$6)`,
        ['BKG-SEED-1', listingId, 'أحمد المطيري / Ahmed Al-Mutairi', 'BYR-001', 1150000, JSON.stringify(snap)]
      );
      await pgLog('UNIT_DATA_LOCKED', listingId, unitId, 'BYR-001', {});
      await pgLog('BOOKING_CONFIRMED', listingId, unitId, 'BYR-001', { bookingId: 'BKG-SEED-1' });
      await store.pool.query(
        `INSERT INTO invoices (id, number, listing_number, account_number, virtual_account_number, purpose, amount, description, status, paid_at)
         VALUES ($1,$2,$3,$4,$5,'deposit',115000,$6,'paid',now())`,
        ['INV-SEED-1', 'INV-SEED0001', inq, accNum, 'SA-DEP-SEED0001', 'عربون حجز الوحدة A-1201 / Booking deposit for unit A-1201']
      );
      await store.pool.query(
        `INSERT INTO payments (id, invoice_number, virtual_account_number, amount, method, reference) VALUES ($1,$2,$3,115000,'bank-transfer',$4)`,
        ['PAY-SEED-1', 'INV-SEED0001', 'SA-DEP-SEED0001', 'TRX-SEED0001']
      );
      await store.pool.query(
        `INSERT INTO accounts (id, type, number, purpose, parent_account_id, listing_id, unit_id, balance) VALUES ($1,'virtual',$2,'deposit',$3,$4,$5,115000)`,
        ['ACC-SEED-VA1', 'SA-DEP-SEED0001', 'ACC-SEED-1', listingId, unitId]
      );
      await pgLog('PAYMENT_COMPLETED', listingId, unitId, 'system', { invoiceNumber: 'INV-SEED0001', reference: 'TRX-SEED0001', amount: 115000 });
    }
  }
}

async function pgLog(action, listingId, unitId, actor, meta) {
  await store.pool.query(
    `INSERT INTO audit_log (id, action, listing_id, unit_id, actor, meta) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id('LOG'), action, listingId, unitId, actor || 'system', JSON.stringify(meta || {})]
  );
}

function jsonLog(entry) {
  entry.id = id('LOG'); entry.at = new Date().toISOString();
  store.jdb.auditLog.push(entry);
  if (store.jdb.auditLog.length > 5000) store.jdb.auditLog.splice(0, store.jdb.auditLog.length - 5000);
  saveJsonDb();
}

// ================= unified data operations =================
const ops = {};

// --- listings ---
ops.createListing = async (unitData, developerId) => {
  const u = sanitizeUnit(unitData);
  if (store.mode === 'pg') {
    const unitId = id('UNIT');
    await store.pool.query(
      `INSERT INTO units (id, unit_number, project_id, project_name, city, district, national_address, area_sqm, rooms, bathrooms, floor, price, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [unitId, u.unitNumber, u.projectId, u.projectName, u.city, u.district, u.nationalAddress, u.areaSqm, u.rooms, u.bathrooms, u.floor, u.price, u.currency]
    );
    const cnt = (await store.pool.query('SELECT COUNT(*)::int AS n FROM listings')).rows[0].n;
    const inq = genInquiryNumberSeq(cnt + 1);
    const listingId = id('LST');
    await store.pool.query(
      `INSERT INTO listings (id, inquiry_number, unit_id, developer_id) VALUES ($1,$2,$3,$4)`,
      [listingId, inq, unitId, developerId || null]
    );
    const accNum = genAccountNumber('escrow');
    await store.pool.query(
      `INSERT INTO accounts (id, type, number, listing_id, unit_id) VALUES ($1,'escrow',$2,$3,$4)`,
      [id('ACC'), accNum, listingId, unitId]
    );
    await pgLog('LISTING_CREATED', listingId, unitId, developerId || 'system', { inquiryNumber: inq });
    return { inquiryNumber: inq, unitId, escrowAccount: accNum };
  }
  // json
  const unit = Object.assign({ id: id('UNIT') }, u);
  store.jdb.units.push(unit);
  const inq = genInquiryNumberSeq(store.jdb.listings.length + 1);
  const listing = { id: id('LST'), inquiryNumber: inq, unitId: unit.id, status: 'active', verified: true, unitLocked: false, createdAt: new Date().toISOString(), developerId: developerId || null };
  store.jdb.listings.push(listing);
  const accNum = genAccountNumber('escrow');
  store.jdb.accounts.push({ id: id('ACC'), type: 'escrow', number: accNum, listingId: listing.id, unitId: unit.id, balance: 0, currency: u.currency, createdAt: new Date().toISOString(), active: true });
  jsonLog({ action: 'LISTING_CREATED', listingId: listing.id, inquiryNumber: inq, actor: developerId || 'system' });
  saveJsonDb();
  return { inquiryNumber: inq, unitId: unit.id, escrowAccount: accNum };
};

ops.verify = async (num) => {
  const number = String(num || '').trim().toUpperCase();
  if (store.mode === 'pg') {
    const r = await store.pool.query(
      `SELECT l.inquiry_number, l.status, l.verified, l.unit_locked, l.created_at,
              u.unit_number, u.project_name, u.city, u.district, u.national_address, u.area_sqm, u.rooms, u.bathrooms, u.floor, u.price, u.currency,
              a.number AS escrow_number,
              EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id AND b.status <> 'cancelled') AS booked
       FROM listings l
       JOIN units u ON u.id = l.unit_id
       LEFT JOIN accounts a ON a.listing_id = l.id AND a.type = 'escrow'
       WHERE l.inquiry_number = $1`, [number]);
    if (!r.rows.length) return null;
    const x = r.rows[0];
    return {
      inquiryNumber: x.inquiry_number, status: x.status, verified: x.verified, createdAt: x.created_at,
      unit: {
        unitNumber: x.unit_number, projectName: x.project_name, city: x.city, district: x.district,
        nationalAddress: x.national_address, areaSqm: x.area_sqm, rooms: x.rooms, bathrooms: x.bathrooms,
        floor: x.floor, price: x.price, currency: x.currency
      },
      unitLocked: x.unit_locked, escrowNumber: x.escrow_number, booked: x.booked
    };
  }
  const listing = store.jdb.listings.find(l => l.inquiryNumber === number);
  if (!listing) return null;
  const unit = store.jdb.units.find(v => v.id === listing.unitId) || null;
  const account = store.jdb.accounts.find(a => a.listingId === listing.id && a.type === 'escrow') || null;
  const booking = store.jdb.bookings.find(b => b.listingId === listing.id && b.status !== 'cancelled') || null;
  return {
    inquiryNumber: listing.inquiryNumber, status: listing.status, verified: listing.verified, createdAt: listing.createdAt,
    unit: unit ? sanitizeUnit(unit) : null, unitLocked: listing.unitLocked,
    escrowNumber: account ? account.number : null, booked: !!booking
  };
};

ops.listings = async () => {
  if (store.mode === 'pg') {
    const r = await store.pool.query(
      `SELECT l.inquiry_number, l.status, l.verified, l.unit_locked, l.created_at,
              u.unit_number, u.project_name, u.city, u.district, u.national_address, u.area_sqm, u.rooms, u.bathrooms, u.floor, u.price, u.currency
       FROM listings l JOIN units u ON u.id = l.unit_id ORDER BY l.created_at DESC`);
    return r.rows.map(x => ({
      inquiryNumber: x.inquiry_number, status: x.status, verified: x.verified, createdAt: x.created_at, unitLocked: x.unit_locked,
      unit: { unitNumber: x.unit_number, projectName: x.project_name, city: x.city, district: x.district, nationalAddress: x.national_address, areaSqm: x.area_sqm, rooms: x.rooms, bathrooms: x.bathrooms, floor: x.floor, price: x.price, currency: x.currency }
    }));
  }
  return store.jdb.listings.map(l => {
    const unit = store.jdb.units.find(u => u.id === l.unitId) || {};
    return { inquiryNumber: l.inquiryNumber, status: l.status, verified: l.verified, createdAt: l.createdAt, unit: sanitizeUnit(unit), unitLocked: l.unitLocked };
  });
};

// --- bookings ---
ops.book = async (inquiryNumber, buyerName, buyerId) => {
  const number = String(inquiryNumber || '').trim().toUpperCase();
  if (store.mode === 'pg') {
    const lr = await store.pool.query(`SELECT l.id, l.unit_locked FROM listings l WHERE l.inquiry_number = $1 FOR UPDATE`, [number]);
    if (!lr.rows.length) return { error: 'LISTING_NOT_FOUND' };
    const listingId = lr.rows[0].id;
    const ex = await store.pool.query(`SELECT 1 FROM bookings WHERE listing_id = $1 AND status <> 'cancelled'`, [listingId]);
    if (ex.rows.length) return { error: 'ALREADY_BOOKED' };
    const ur = await store.pool.query(`SELECT u.*, l.unit_locked FROM units u JOIN listings l ON l.unit_id = u.id WHERE l.id = $1`, [listingId]);
    const u = ur.rows[0];
    const snap = sanitizeUnit(u);
    const bookingId = id('BKG');
    await store.pool.query(
      `INSERT INTO bookings (id, listing_id, buyer_name, buyer_id, amount, unit_snapshot) VALUES ($1,$2,$3,$4,$5,$6)`,
      [bookingId, listingId, buyerName || '', buyerId || '', u.price, JSON.stringify(snap)]
    );
    await store.pool.query(`UPDATE listings SET unit_locked = true, status = 'booked' WHERE id = $1`, [listingId]);
    await pgLog('UNIT_DATA_LOCKED', listingId, u.id, buyerId || 'buyer', {});
    await pgLog('BOOKING_CONFIRMED', listingId, u.id, buyerId || 'buyer', { bookingId });
    return { bookingId, unitLocked: true };
  }
  const listing = store.jdb.listings.find(l => l.inquiryNumber === number);
  if (!listing) return { error: 'LISTING_NOT_FOUND' };
  if (listing.unitLocked) {
    const ex = store.jdb.bookings.find(x => x.listingId === listing.id && x.status !== 'cancelled');
    if (ex) return { error: 'ALREADY_BOOKED' };
  }
  const unit = store.jdb.units.find(u => u.id === listing.unitId);
  const booking = {
    id: id('BKG'), listingId: listing.id, inquiryNumber: listing.inquiryNumber,
    buyerName: buyerName || '', buyerId: buyerId || '', amount: unit ? unit.price : 0,
    status: 'confirmed', createdAt: new Date().toISOString(), unitSnapshot: unit ? sanitizeUnit(unit) : null
  };
  store.jdb.bookings.push(booking);
  listing.unitLocked = true; listing.status = 'booked';
  jsonLog({ action: 'UNIT_DATA_LOCKED', listingId: listing.id, unitId: unit ? unit.id : null, actor: buyerId || 'buyer' });
  jsonLog({ action: 'BOOKING_CONFIRMED', bookingId: booking.id, listingId: listing.id, actor: buyerId || 'buyer' });
  saveJsonDb();
  return { bookingId: booking.id, unitLocked: true };
};

ops.unitChangeRequest = async (inquiryNumber, reason, requestedBy) => {
  const number = String(inquiryNumber || '').trim().toUpperCase();
  if (store.mode === 'pg') {
    const r = await store.pool.query(`SELECT id FROM listings WHERE inquiry_number = $1`, [number]);
    if (!r.rows.length) return { error: 'LISTING_NOT_FOUND' };
    await pgLog('UNIT_CHANGE_REQUESTED', r.rows[0].id, null, requestedBy || 'system', { reason: reason || '', approvalCode: id('APR') });
    return { ok: true };
  }
  const listing = store.jdb.listings.find(l => l.inquiryNumber === number);
  if (!listing) return { error: 'LISTING_NOT_FOUND' };
  jsonLog({ action: 'UNIT_CHANGE_REQUESTED', listingId: listing.id, reason: reason || '', requestedBy: requestedBy || 'system', approvalCode: id('APR') });
  return { ok: true };
};

// --- invoices ---
ops.createInvoice = async (inquiryNumber, kind, amount, description, dueDate) => {
  if (store.mode === 'pg') {
    let listingId = null, accNum = null, vaParent = null;
    if (inquiryNumber) {
      const r = await store.pool.query(`SELECT l.id FROM listings l WHERE l.inquiry_number = $1`, [String(inquiryNumber).toUpperCase()]);
      if (r.rows.length) {
        listingId = r.rows[0].id;
        const a = await store.pool.query(`SELECT id, number FROM accounts WHERE listing_id = $1 AND type = 'escrow'`, [listingId]);
        if (a.rows.length) { accNum = a.rows[0].number; vaParent = a.rows[0].id; }
      }
    }
    if (!accNum) return { error: 'NO_ACCOUNT' };
    const vaNum = genAccountNumber(kind || 'virtual');
    await store.pool.query(
      `INSERT INTO accounts (id, type, number, purpose, parent_account_id, listing_id) VALUES ($1,'virtual',$2,$3,$4,$5)`,
      [id('ACC'), vaNum, kind || 'payment', vaParent, listingId]
    );
    const invNum = 'INV-' + Date.now().toString(36).toUpperCase();
    await store.pool.query(
      `INSERT INTO invoices (id, number, listing_number, account_number, virtual_account_number, purpose, amount, description, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id('INV'), invNum, String(inquiryNumber || '').toUpperCase() || null, accNum, vaNum, kind || 'payment', Number(amount) || 0, description || '', dueDate || null]
    );
    await pgLog('INVOICE_ISSUED', listingId, null, 'system', { invoiceNumber: invNum, virtualAccount: vaNum });
    return { invoice: { number: invNum, virtualAccountNumber: vaNum, amount: Number(amount) || 0, purpose: kind || 'payment', description: description || '', status: 'issued' } };
  }
  const listing = store.jdb.listings.find(l => l.inquiryNumber === String(inquiryNumber || '').toUpperCase());
  let account = listing && store.jdb.accounts.find(a => a.listingId === listing.id && a.type === 'escrow');
  if (!account) return { error: 'NO_ACCOUNT' };
  const vaNum = genAccountNumber(kind);
  store.jdb.accounts.push({ id: id('ACC'), type: 'virtual', purpose: kind, number: vaNum, parentAccountId: account.id, listingId: account.listingId, unitId: account.unitId, balance: 0, createdAt: new Date().toISOString(), active: true });
  const invNum = 'INV-' + Date.now().toString(36).toUpperCase();
  const invoice = {
    id: id('INV'), number: invNum, listingNumber: listing ? listing.inquiryNumber : null,
    accountNumber: account.number, virtualAccountNumber: vaNum, purpose: kind,
    amount: Number(amount) || 0, currency: 'SAR', description: description || '',
    status: 'issued', dueDate: dueDate || null, issuedAt: new Date().toISOString()
  };
  store.jdb.invoices.push(invoice);
  jsonLog({ action: 'INVOICE_ISSUED', invoiceId: invoice.id, listingId: account.listingId, virtualAccount: vaNum });
  saveJsonDb();
  return { invoice };
};

ops.createOwnerUnionInvoice = async (unitNumber, amount, cycle, description, dueDate) => {
  if (store.mode === 'pg') {
    const ur = await store.pool.query(`SELECT id FROM units WHERE unit_number = $1`, [String(unitNumber || '')]);
    const unitId = ur.rows.length ? ur.rows[0].id : null;
    let acc = await store.pool.query(`SELECT id, number FROM accounts WHERE unit_id = $1 AND type = 'ownerUnion'`, [unitId]);
    let accNum;
    if (!acc.rows.length) {
      accNum = genAccountNumber('ownerUnion');
      await store.pool.query(`INSERT INTO accounts (id, type, number, unit_id) VALUES ($1,'ownerUnion',$2,$3)`, [id('ACC'), accNum, unitId]);
    } else accNum = acc.rows[0].number;
    const invNum = 'INV-' + Date.now().toString(36).toUpperCase();
    await store.pool.query(
      `INSERT INTO invoices (id, number, account_number, virtual_account_number, purpose, cycle, amount, description, due_date)
       VALUES ($1,$2,$3,$3,'ownerUnionFees',$4,$5,$6,$7)`,
      [id('INV'), invNum, accNum, cycle || 'monthly', Number(amount) || 0, description || (unitNumber ? 'رسوم صيانة وتشغيل — ' + unitNumber : 'رسوم اتحاد الملاك'), dueDate || null]
    );
    await pgLog('OWNER_UNION_INVOICE_ISSUED', null, unitId, 'system', { invoiceNumber: invNum });
    return { invoice: { number: invNum, virtualAccountNumber: accNum, amount: Number(amount) || 0, cycle: cycle || 'monthly', status: 'issued' } };
  }
  const unit = store.jdb.units.find(u => u.unitNumber === String(unitNumber));
  let account = store.jdb.accounts.find(a => a.unitId === (unit && unit.id) && a.type === 'ownerUnion');
  if (!account) {
    account = { id: id('ACC'), type: 'ownerUnion', number: genAccountNumber('ownerUnion'), unitId: unit ? unit.id : null, listingId: null, balance: 0, createdAt: new Date().toISOString(), active: true };
    store.jdb.accounts.push(account);
  }
  const invNum = 'INV-' + Date.now().toString(36).toUpperCase();
  const invoice = {
    id: id('INV'), number: invNum, listingNumber: null, accountNumber: account.number,
    virtualAccountNumber: account.number, purpose: 'ownerUnionFees', cycle: cycle || 'monthly',
    amount: Number(amount) || 0, currency: 'SAR',
    description: description || (unit ? 'رسوم صيانة وتشغيل — ' + unitNumber : 'رسوم اتحاد الملاك'),
    status: 'issued', dueDate: dueDate || null, issuedAt: new Date().toISOString()
  };
  store.jdb.invoices.push(invoice);
  jsonLog({ action: 'OWNER_UNION_INVOICE_ISSUED', invoiceId: invoice.id, unitId: unit ? unit.id : null });
  saveJsonDb();
  return { invoice };
};

ops.pay = async (invoiceNumber, amount, method) => {
  const inv = String(invoiceNumber || '').toUpperCase();
  if (store.mode === 'pg') {
    const client = await store.pool.connect();
    try {
      await client.query('BEGIN');
      const ir = await client.query(`SELECT number, virtual_account_number, amount, status FROM invoices WHERE number = $1 FOR UPDATE`, [inv]);
      if (!ir.rows.length) { await client.query('ROLLBACK'); return { error: 'INVOICE_NOT_FOUND' }; }
      if (ir.rows[0].status === 'paid') { await client.query('ROLLBACK'); return { error: 'ALREADY_PAID' }; }
      const row = ir.rows[0];
      const payAmt = Number(amount) || Number(row.amount);
      const ref = 'TRX-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await client.query(
        `INSERT INTO payments (id, invoice_number, virtual_account_number, amount, method, reference) VALUES ($1,$2,$3,$4,$5,$6)`,
        [id('PAY'), inv, row.virtual_account_number, payAmt, method || 'bank-transfer', ref]
      );
      await client.query(`UPDATE invoices SET status = 'paid', paid_at = now() WHERE number = $1`, [inv]);
      await client.query(`UPDATE accounts SET balance = COALESCE(balance,0) + $1 WHERE number = $2`, [payAmt, row.virtual_account_number]);
      const lr = await client.query(`SELECT l.id AS listing_id FROM invoices i JOIN listings l ON l.inquiry_number = i.listing_number WHERE i.number = $1`, [inv]);
      await client.query(
        `INSERT INTO audit_log (id, action, listing_id, actor, meta) VALUES ($1,'PAYMENT_COMPLETED',$2,'system',$3)`,
        [id('LOG'), lr.rows.length ? lr.rows[0].listing_id : null, JSON.stringify({ invoiceNumber: inv, reference: ref, amount: payAmt })]
      );
      await client.query('COMMIT');
      return { payment: { invoiceNumber: inv, reference: ref, amount: payAmt } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  const invoice = store.jdb.invoices.find(i => i.number === inv);
  if (!invoice) return { error: 'INVOICE_NOT_FOUND' };
  if (invoice.status === 'paid') return { error: 'ALREADY_PAID' };
  const va = store.jdb.accounts.find(a => a.number === invoice.virtualAccountNumber);
  const payment = {
    id: id('PAY'), invoiceNumber: invoice.number, virtualAccountNumber: invoice.virtualAccountNumber,
    amount: Number(amount) || invoice.amount, method: method || 'bank-transfer',
    reference: 'TRX-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    paidAt: new Date().toISOString(), status: 'completed'
  };
  store.jdb.payments.push(payment);
  invoice.status = 'paid'; invoice.paidAt = payment.paidAt;
  if (va) va.balance = (va.balance || 0) + payment.amount;
  jsonLog({ action: 'PAYMENT_COMPLETED', invoiceNumber: invoice.number, reference: payment.reference, amount: payment.amount });
  saveJsonDb();
  return { payment };
};

ops.invoices = async (number) => {
  if (store.mode === 'pg') {
    if (number) {
      const r = await store.pool.query(
        `SELECT id, number, listing_number, account_number, virtual_account_number, purpose, cycle, amount, currency, description, status, due_date, issued_at, paid_at
         FROM invoices WHERE listing_number = $1 OR account_number = $1 OR virtual_account_number = $1`, [number.toUpperCase()]);
      return r.rows.map(pgInvoice);
    }
    const r = await store.pool.query(`SELECT id, number, listing_number, account_number, virtual_account_number, purpose, cycle, amount, currency, description, status, due_date, issued_at, paid_at FROM invoices ORDER BY issued_at DESC`);
    return r.rows.map(pgInvoice);
  }
  let items = store.jdb.invoices;
  if (number) items = items.filter(i => i.listingNumber === number.toUpperCase() || i.accountNumber === number.toUpperCase() || i.virtualAccountNumber === number.toUpperCase());
  return items;
};

function pgInvoice(x) {
  return {
    number: x.number, listingNumber: x.listing_number, accountNumber: x.account_number,
    virtualAccountNumber: x.virtual_account_number, purpose: x.purpose, cycle: x.cycle,
    amount: Number(x.amount), currency: x.currency, description: x.description,
    status: x.status, dueDate: x.due_date, issuedAt: x.issued_at, paidAt: x.paid_at
  };
}

// --- track & stats & audit ---
ops.track = async (number) => {
  const num = String(number || '').trim().toUpperCase();
  if (store.mode === 'pg') {
    let listing = null, listingId = null;
    const lr = await store.pool.query(`SELECT id, inquiry_number, status, unit_locked FROM listings WHERE inquiry_number = $1`, [num]);
    if (lr.rows.length) { listingId = lr.rows[0].id; listing = { inquiryNumber: lr.rows[0].inquiry_number, status: lr.rows[0].status, unitLocked: lr.rows[0].unit_locked }; }
    const invoices = await ops.invoices(num);
    if (!listing && !invoices.length) {
      const byInq = await store.pool.query(`SELECT l.id FROM listings l WHERE l.inquiry_number = (SELECT listing_number FROM invoices WHERE number = $1)`, [num]);
      if (byInq.rows.length) return ops.track(byInq.rows[0].inquiry_number ? (await store.pool.query('SELECT inquiry_number FROM listings WHERE id = $1', [byInq.rows[0].id])).rows[0].inquiry_number : num);
      return null;
    }
    let timeline = [];
    if (listingId) {
      const tr = await store.pool.query(`SELECT id, action, listing_id, actor, meta, at FROM audit_log WHERE listing_id = $1 ORDER BY at DESC LIMIT 100`, [listingId]);
      timeline = tr.rows.map(x => ({ id: x.id, action: x.action, listingId: x.listing_id, actor: x.actor, meta: x.meta, at: x.at }));
    }
    const payments = [];
    for (const inv of invoices) {
      const pr = await store.pool.query(`SELECT id, invoice_number, virtual_account_number, amount, method, reference, status, paid_at FROM payments WHERE invoice_number = $1`, [inv.number]);
      pr.rows.forEach(x => payments.push({ invoiceNumber: x.invoice_number, virtualAccountNumber: x.virtual_account_number, amount: Number(x.amount), method: x.method, reference: x.reference, status: x.status, paidAt: x.paid_at }));
    }
    return { listing, invoices, payments, timeline };
  }
  const listing = store.jdb.listings.find(l => l.inquiryNumber === num);
  const invoiceByVa = store.jdb.invoices.find(i => i.virtualAccountNumber === num || i.accountNumber === num || i.number === num);
  if (!listing && !invoiceByVa) return null;
  const invoices = store.jdb.invoices.filter(i => (listing && i.listingNumber === listing.inquiryNumber) || i.virtualAccountNumber === num || i.accountNumber === num || i.number === num);
  const payments = store.jdb.payments.filter(p => invoices.some(i => i.number === p.invoiceNumber));
  const listingId = listing ? listing.id : null;
  const timeline = store.jdb.auditLog.filter(e => e.listingId === listingId || (!listingId && invoices.some(i => i.number === (e.meta && e.meta.invoiceNumber)))).slice(-100).reverse();
  return { listing: listing ? { inquiryNumber: listing.inquiryNumber, status: listing.status, unitLocked: listing.unitLocked } : null, invoices, payments, timeline };
};

ops.stats = async () => {
  if (store.mode === 'pg') {
    const r = await store.pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM listings) AS listings,
        (SELECT COUNT(*)::int FROM bookings WHERE status = 'confirmed') AS bookings,
        (SELECT COUNT(*)::int FROM invoices) AS invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE status = 'paid') AS paid_invoices,
        (SELECT COALESCE(SUM(amount),0)::float FROM payments WHERE status = 'completed') AS payments_total,
        (SELECT COUNT(*)::int FROM accounts) AS accounts,
        (SELECT COUNT(*)::int FROM audit_log) AS audit_entries`);
    const x = r.rows[0];
    return { listings: x.listings, bookings: x.bookings, invoices: x.invoices, paidInvoices: x.paid_invoices, paymentsTotal: x.payments_total, accounts: x.accounts, auditEntries: x.audit_entries };
  }
  const paid = store.jdb.payments.reduce((s, p) => s + (p.amount || 0), 0);
  return {
    listings: store.jdb.listings.length,
    bookings: store.jdb.bookings.filter(b => b.status === 'confirmed').length,
    invoices: store.jdb.invoices.length,
    paidInvoices: store.jdb.invoices.filter(i => i.status === 'paid').length,
    paymentsTotal: paid, accounts: store.jdb.accounts.length, auditEntries: store.jdb.auditLog.length
  };
};

ops.audit = async (limit) => {
  const l = Math.min(Number(limit) || 50, 200);
  if (store.mode === 'pg') {
    const r = await store.pool.query(`SELECT id, action, listing_id, unit_id, actor, meta, at FROM audit_log ORDER BY at DESC LIMIT $1`, [l]);
    return r.rows.map(x => ({ id: x.id, action: x.action, listingId: x.listing_id, unitId: x.unit_id, actor: x.actor, meta: x.meta, at: x.at }));
  }
  return store.jdb.auditLog.slice(-l).reverse();
};

// ================= HTTP helpers =================
function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 1e6) { reject(new Error('payload too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ================= static files =================
function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? path.join(PUBLIC, 'index.html') : path.join(PUBLIC, pathname);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      file = path.join(PUBLIC, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// ================= router =================
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (p.startsWith('/api/')) {
      const route = p.slice(5).replace(/\/+$/, '');
      const Q = u.searchParams;
      if (req.method === 'GET') {
        if (route === 'health') return send(res, 200, { ok: true, storage: store.mode, time: new Date().toISOString() });
        if (route === 'verify') {
          const v = await ops.verify(Q.get('number'));
          if (!v) return send(res, 404, { ok: false, error: 'LISTING_NOT_FOUND', messageAr: 'لا يوجد عرض بهذا الرقم', messageEn: 'No listing with this number' });
          return send(res, 200, { ok: true, listing: v });
        }
        if (route === 'listings') return send(res, 200, { ok: true, count: (await ops.listings()).length, listings: await ops.listings() });
        if (route === 'invoices') return send(res, 200, { ok: true, count: (await ops.invoices(Q.get('number'))).length, invoices: await ops.invoices(Q.get('number')) });
        if (route === 'track') {
          const t = await ops.track(Q.get('number'));
          if (!t) return send(res, 404, { ok: false, error: 'NOT_FOUND' });
          return send(res, 200, { ok: true, ...t });
        }
        if (route === 'stats') return send(res, 200, { ok: true, stats: await ops.stats() });
        if (route === 'audit') return send(res, 200, { ok: true, entries: await ops.audit(Q.get('limit')) });
        return send(res, 404, { ok: false, error: 'ROUTE_NOT_FOUND' });
      }
      if (req.method === 'POST') {
        const b = await readBody(req);
        if (route === 'listings') {
          if (!b.unit || !b.unit.unitNumber || !b.unit.city || !b.unit.price) return send(res, 400, { ok: false, error: 'INVALID_INPUT', messageAr: 'بيانات الوحدة غير مكتملة', messageEn: 'Incomplete unit data' });
          const r = await ops.createListing(b.unit, b.developerId);
          return send(res, 201, { ok: true, ...r });
        }
        if (route === 'book') {
          const r = await ops.book(b.inquiryNumber, b.buyerName, b.buyerId);
          if (r.error === 'LISTING_NOT_FOUND') return send(res, 404, { ok: false, error: r.error });
          if (r.error) return send(res, 409, { ok: false, error: r.error, messageAr: 'الوحدة محجوزة مسبقاً', messageEn: 'Unit already booked' });
          return send(res, 201, { ok: true, ...r });
        }
        if (route === 'unit-change-request') {
          const r = await ops.unitChangeRequest(b.inquiryNumber, b.reason, b.requestedBy);
          if (r.error) return send(res, 404, { ok: false, error: r.error });
          return send(res, 200, { ok: true, messageAr: 'تم تسجيل طلب التعديل كإجراء رسمي موثق بانتظار الاعتماد', messageEn: 'Change request recorded as a formal documented action pending approval' });
        }
        if (route === 'invoices') {
          const r = await ops.createInvoice(b.inquiryNumber, b.kind, b.amount, b.description, b.dueDate);
          if (r.error) return send(res, 400, { ok: false, error: r.error, messageAr: 'لا يوجد حساب عقاري مرتبط', messageEn: 'No linked real-estate account' });
          return send(res, 201, { ok: true, ...r });
        }
        if (route === 'owner-union-invoices') {
          if (!b.unitNumber || !b.amount) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
          const r = await ops.createOwnerUnionInvoice(b.unitNumber, b.amount, b.cycle, b.description, b.dueDate);
          return send(res, 201, { ok: true, ...r });
        }
        if (route === 'pay') {
          const r = await ops.pay(b.invoiceNumber, b.amount, b.method);
          if (r.error === 'INVOICE_NOT_FOUND') return send(res, 404, { ok: false, error: r.error });
          if (r.error) return send(res, 409, { ok: false, error: r.error });
          return send(res, 201, { ok: true, ...r });
        }
        return send(res, 404, { ok: false, error: 'ROUTE_NOT_FOUND' });
      }
      return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }
    serveStatic(req, res, p);
  } catch (e) {
    console.error('[api]', e.message);
    send(res, 500, { ok: false, error: 'SERVER_ERROR', message: e.message });
  }
});

// ================= startup =================
async function main() {
  if (DATABASE_URL) {
    try {
      await initPg(DATABASE_URL);
      console.log('[db] PostgreSQL connected');
    } catch (e) {
      console.error('[db] PostgreSQL connection failed, falling back to JSON store:', e.message);
      loadJsonDb();
    }
  } else if (EMBEDDED_PG) {
    try {
      const Embedded = require('embedded-postgres').default;
      const dataDir = process.env.PG_DATA_DIR || path.join(DATA_DIR, 'pgdata');
      const pgdb = new Embedded({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: Number(process.env.PG_PORT) || 5432, persistent: process.env.PG_PERSISTENT !== '0' });
      try { await pgdb.initialise(); } catch (e) { /* already initialised */ }
      await pgdb.start();
      try { await pgdb.createDatabase('muwaqe'); } catch (e) { /* exists */ }
      await initPg(`postgres://postgres:postgres@localhost:${process.env.PG_PORT || 5432}/muwaqe`);
      console.log('[db] Embedded PostgreSQL started');
    } catch (e) {
      console.error('[db] Embedded PostgreSQL failed, falling back to JSON store:', e.message);
      loadJsonDb();
    }
  } else {
    loadJsonDb();
    console.log('[db] JSON file store (' + DB_FILE + ')');
  }
  server.listen(PORT, () => console.log(`Muwaqe Estates platform running → http://localhost:${PORT} [storage: ${store.mode}]`));
}

main();
