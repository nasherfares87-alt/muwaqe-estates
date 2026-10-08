'use strict';
/**
 * Muwaqe Estates — Digital Real Estate Governance Platform
 * Zero-dependency Node.js server (REST API + static frontend).
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ---------- simple JSON file DB ----------
let db = null;
let saveTimer = null;

function defaultDb() {
  return {
    users: [],
    listings: [],      // العروض العقارية
    units: [],          // الوحدات
    inquiries: [],      // الاستفسارات
    bookings: [],       // الحجوزات
    invoices: [],       // الفواتير
    payments: [],       // المدفوعات
    accounts: [],       // الحسابات العقارية المستقلة / الافتراضية
    auditLog: []        // سجل التوثيق
  };
}

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      for (const k of Object.keys(defaultDb())) if (!db[k]) db[k] = [];
      return;
    }
  } catch (e) {
    console.error('[db] load failed, starting fresh:', e.message);
  }
  db = defaultDb();
  seed();
  saveDb();
}

function saveDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDb, 150);
}

function id(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function log(entry) {
  entry.id = id('LOG');
  entry.at = new Date().toISOString();
  db.auditLog.push(entry);
  if (db.auditLog.length > 5000) db.auditLog.splice(0, db.auditLog.length - 5000);
  persist();
}

// ---------- helpers ----------
function genInquiryNumber() {
  const seq = String(db.listings.length + 1).padStart(6, '0');
  return 'INQ-' + new Date().getFullYear() + '-' + seq;
}

function genVirtualAccount(kind) {
  const kinds = { escrow: 'SA-ESC', deposit: 'SA-DEP', rent: 'SA-RNT', fee: 'SA-FEE', ownerUnion: 'SA-UNI' };
  const prefix = kinds[kind] || 'SA-VRT';
  return prefix + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function sanitizeUnit(u) {
  return {
    unitNumber: u.unitNumber,
    projectId: u.projectId,
    projectName: u.projectName,
    city: u.city,
    district: u.district,
    nationalAddress: u.nationalAddress,
    areaSqm: u.areaSqm,
    rooms: u.rooms,
    bathrooms: u.bathrooms,
    floor: u.floor,
    price: u.price,
    currency: u.currency || 'SAR'
  };
}

function send(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers));
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 1e6) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ---------- API handlers ----------
const api = {};

// استفسار عن عرض بالرقم الموحد (تحقق عام)
api.verify = (req, res, q) => {
  const num = (q.get('number') || '').trim().toUpperCase();
  const listing = db.listings.find(l => l.inquiryNumber === num);
  if (!listing) return send(res, 404, { ok: false, error: 'LISTING_NOT_FOUND', messageAr: 'لا يوجد عرض بهذا الرقم', messageEn: 'No listing with this number' });
  const unit = db.units.find(u => u.id === listing.unitId) || null;
  const account = db.accounts.find(a => a.listingId === listing.id && a.type === 'escrow') || null;
  const booking = db.bookings.find(b => b.listingId === listing.id && b.status !== 'cancelled') || null;
  send(res, 200, {
    ok: true,
    listing: {
      inquiryNumber: listing.inquiryNumber,
      status: listing.status,
      verified: listing.verified,
      createdAt: listing.createdAt,
      unit: unit ? sanitizeUnit(unit) : null,
      unitLocked: listing.unitLocked,
      hasEscrowAccount: !!account,
      escrowNumber: account ? account.number : null,
      booked: !!booking
    }
  });
};

// قائمة العروض
api.listings = (req, res, q) => {
  const items = db.listings.map(l => {
    const unit = db.units.find(u => u.id === l.unitId) || {};
    return {
      inquiryNumber: l.inquiryNumber,
      status: l.status,
      verified: l.verified,
      createdAt: l.createdAt,
      unit: sanitizeUnit(unit),
      unitLocked: l.unitLocked
    };
  });
  send(res, 200, { ok: true, count: items.length, listings: items });
};

// إنشاء عرض جديد + رقم استفسار موحد + حساب عقاري مستقل
api.createListing = async (req, res) => {
  const b = await readBody(req);
  if (!b.unit || !b.unit.unitNumber || !b.unit.city || !b.unit.price) {
    return send(res, 400, { ok: false, error: 'INVALID_INPUT', messageAr: 'بيانات الوحدة غير مكتملة', messageEn: 'Incomplete unit data' });
  }
  const unit = Object.assign({ id: id('UNIT') }, sanitizeUnit(b.unit));
  db.units.push(unit);
  const listing = {
    id: id('LST'),
    inquiryNumber: genInquiryNumber(),
    unitId: unit.id,
    status: 'active',
    verified: true,
    unitLocked: false,
    createdAt: new Date().toISOString(),
    developerId: b.developerId || null
  };
  db.listings.push(listing);
  const account = {
    id: id('ACC'),
    type: 'escrow',
    number: genVirtualAccount('escrow'),
    listingId: listing.id,
    unitId: unit.id,
    balance: 0,
    currency: unit.currency,
    createdAt: new Date().toISOString(),
    active: true
  };
  db.accounts.push(account);
  log({ action: 'LISTING_CREATED', listingId: listing.id, inquiryNumber: listing.inquiryNumber, actor: b.developerId || 'system' });
  send(res, 201, { ok: true, inquiryNumber: listing.inquiryNumber, unitId: unit.id, escrowAccount: account.number });
};

// حجز
api.book = async (req, res) => {
  const b = await readBody(req);
  const listing = db.listings.find(l => l.inquiryNumber === String(b.inquiryNumber || '').toUpperCase());
  if (!listing) return send(res, 404, { ok: false, error: 'LISTING_NOT_FOUND' });
  if (listing.unitLocked) {
    const ex = db.bookings.find(x => x.listingId === listing.id && x.status !== 'cancelled');
    if (ex) return send(res, 409, { ok: false, error: 'ALREADY_BOOKED', messageAr: 'الوحدة محجوزة مسبقاً', messageEn: 'Unit already booked' });
  }
  const unit = db.units.find(u => u.id === listing.unitId);
  const booking = {
    id: id('BKG'),
    listingId: listing.id,
    inquiryNumber: listing.inquiryNumber,
    buyerName: b.buyerName || '',
    buyerId: b.buyerId || '',
    amount: b.amount != null ? b.amount : (unit ? unit.price : 0),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    unitSnapshot: unit ? sanitizeUnit(unit) : null
  };
  db.bookings.push(booking);
  listing.unitLocked = true;
  listing.status = 'booked';
  if (unit) log({ action: 'UNIT_DATA_LOCKED', listingId: listing.id, unitId: unit.id, actor: b.buyerId || 'buyer' });
  log({ action: 'BOOKING_CONFIRMED', bookingId: booking.id, listingId: listing.id, actor: b.buyerId || 'buyer' });
  send(res, 201, { ok: true, bookingId: booking.id, unitLocked: listing.unitLocked });
};

// طلب تعديل بيانات وحدة مؤمنة (إجراء رسمي موثق)
api.requestUnitChange = async (req, res) => {
  const b = await readBody(req);
  const listing = db.listings.find(l => l.inquiryNumber === String(b.inquiryNumber || '').toUpperCase());
  if (!listing) return send(res, 404, { ok: false, error: 'LISTING_NOT_FOUND' });
  if (!listing.unitLocked) return send(res, 409, { ok: false, error: 'UNIT_NOT_LOCKED' });
  log({ action: 'UNIT_CHANGE_REQUESTED', listingId: listing.id, reason: b.reason || '', requestedBy: b.requestedBy || 'system', approvalCode: id('APR') });
  send(res, 200, { ok: true, messageAr: 'تم تسجيل طلب التعديل كإجراء رسمي موثق بانتظار الاعتماد', messageEn: 'Change request recorded as a formal documented action pending approval' });
};

// فوترة (دفعات/عربون/إيجار/رسوم)
api.invoices = (req, res, q) => {
  const num = q.get('number');
  let items = db.invoices;
  if (num) items = items.filter(i => i.listingNumber === num.toUpperCase() || i.accountNumber === num.toUpperCase());
  send(res, 200, { ok: true, count: items.length, invoices: items });
};

api.createInvoice = async (req, res) => {
  const b = await readBody(req);
  const listing = db.listings.find(l => l.inquiryNumber === String(b.inquiryNumber || '').toUpperCase());
  const kind = b.kind || 'payment';
  let account;
  if (listing) {
    account = db.accounts.find(a => a.listingId === listing.id && (a.type === 'escrow'));
  }
  if (!account) account = db.accounts.find(a => a.number === String(b.accountNumber || '').toUpperCase());
  if (!account) return send(res, 400, { ok: false, error: 'NO_ACCOUNT', messageAr: 'لا يوجد حساب عقاري مرتبط', messageEn: 'No linked real-estate account' });
  const va = {
    id: id('ACC'),
    type: 'virtual',
    purpose: kind,
    number: genVirtualAccount(kind === 'deposit' ? 'deposit' : kind === 'rent' ? 'rent' : kind === 'fee' ? 'fee' : 'escrow'),
    parentAccountId: account.id,
    listingId: account.listingId,
    unitId: account.unitId,
    balance: 0,
    createdAt: new Date().toISOString(),
    active: true
  };
  db.accounts.push(va);
  const invoice = {
    id: id('INV'),
    number: 'INV-' + Date.now().toString(36).toUpperCase(),
    listingNumber: listing ? listing.inquiryNumber : null,
    accountNumber: account.number,
    virtualAccountNumber: va.number,
    purpose: kind,
    amount: Number(b.amount) || 0,
    currency: 'SAR',
    description: b.description || '',
    status: 'issued',
    dueDate: b.dueDate || null,
    issuedAt: new Date().toISOString()
  };
  db.invoices.push(invoice);
  log({ action: 'INVOICE_ISSUED', invoiceId: invoice.id, listingId: account.listingId, virtualAccount: va.number });
  send(res, 201, { ok: true, invoice });
};

// فواتير اتحادات الملاك الدورية
api.createOwnerUnionInvoice = async (req, res) => {
  const b = await readBody(req);
  if (!b.unitNumber || !b.amount) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
  const unit = db.units.find(u => u.unitNumber === String(b.unitNumber));
  let account = db.accounts.find(a => a.unitId === (unit && unit.id) && a.type === 'ownerUnion');
  if (!account) {
    account = {
      id: id('ACC'),
      type: 'ownerUnion',
      number: genVirtualAccount('ownerUnion'),
      unitId: unit ? unit.id : null,
      listingId: null,
      balance: 0,
      createdAt: new Date().toISOString(),
      active: true
    };
    db.accounts.push(account);
  }
  const invoice = {
    id: id('INV'),
    number: 'INV-' + Date.now().toString(36).toUpperCase(),
    listingNumber: null,
    accountNumber: account.number,
    virtualAccountNumber: account.number,
    purpose: 'ownerUnionFees',
    cycle: b.cycle || 'monthly',
    amount: Number(b.amount),
    currency: 'SAR',
    description: b.description || (unit ? 'رسوم صيانة وتشغيل — ' + b.unitNumber : 'رسوم اتحاد الملاك'),
    status: 'issued',
    dueDate: b.dueDate || null,
    issuedAt: new Date().toISOString()
  };
  db.invoices.push(invoice);
  log({ action: 'OWNER_UNION_INVOICE_ISSUED', invoiceId: invoice.id, unitId: unit ? unit.id : null });
  send(res, 201, { ok: true, invoice });
};

// دفع إلى حساب افتراضي
api.pay = async (req, res) => {
  const b = await readBody(req);
  const invoice = db.invoices.find(i => i.number === String(b.invoiceNumber || '').toUpperCase());
  if (!invoice) return send(res, 404, { ok: false, error: 'INVOICE_NOT_FOUND' });
  if (invoice.status === 'paid') return send(res, 409, { ok: false, error: 'ALREADY_PAID' });
  const va = db.accounts.find(a => a.number === invoice.virtualAccountNumber);
  const payment = {
    id: id('PAY'),
    invoiceNumber: invoice.number,
    virtualAccountNumber: invoice.virtualAccountNumber,
    amount: Number(b.amount) || invoice.amount,
    method: b.method || 'bank-transfer',
    reference: 'TRX-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    paidAt: new Date().toISOString(),
    status: 'completed'
  };
  db.payments.push(payment);
  invoice.status = 'paid';
  invoice.paidAt = payment.paidAt;
  if (va) va.balance = (va.balance || 0) + payment.amount;
  log({ action: 'PAYMENT_COMPLETED', invoiceNumber: invoice.number, reference: payment.reference, amount: payment.amount });
  send(res, 201, { ok: true, payment });
};

// تتبع العملية الكاملة
api.track = (req, res, q) => {
  const num = (q.get('number') || '').trim().toUpperCase();
  const listing = db.listings.find(l => l.inquiryNumber === num);
  const invoiceByVa = db.invoices.find(i => i.virtualAccountNumber === num || i.accountNumber === num);
  if (!listing && !invoiceByVa) return send(res, 404, { ok: false, error: 'NOT_FOUND' });
  const target = listing || invoiceByVa;
  const listingId = listing ? listing.id : null;
  const timeline = db.auditLog.filter(e => !listingId || e.listingId === listingId);
  const invoices = db.invoices.filter(i => (listing && i.listingNumber === listing.inquiryNumber) || i.virtualAccountNumber === num || i.accountNumber === num);
  const payments = db.payments.filter(p => invoices.some(i => i.number === p.invoiceNumber));
  send(res, 200, {
    ok: true,
    listing: listing ? { inquiryNumber: listing.inquiryNumber, status: listing.status, unitLocked: listing.unitLocked } : null,
    invoices,
    payments,
    timeline
  });
};

// ملخص لوحة المعلومات
api.stats = (req, res) => {
  const paid = db.payments.reduce((s, p) => s + (p.amount || 0), 0);
  send(res, 200, {
    ok: true,
    stats: {
      listings: db.listings.length,
      bookings: db.bookings.filter(b => b.status === 'confirmed').length,
      invoices: db.invoices.length,
      paidInvoices: db.invoices.filter(i => i.status === 'paid').length,
      paymentsTotal: paid,
      accounts: db.accounts.length,
      auditEntries: db.auditLog.length
    }
  });
};

// سجل التوثيق
api.audit = (req, res, q) => {
  const limit = Math.min(Number(q.get('limit')) || 50, 200);
  send(res, 200, { ok: true, entries: db.auditLog.slice(-limit).reverse() });
};

// ---------- seed demo data ----------
function seed() {
  const demoUnits = [
    { unitNumber: 'A-1201', projectId: 'PRJ-ALNOOR', projectName: 'مشروع النور السكني / Al-Noor Residential', city: 'الرياض / Riyadh', district: 'حي الملقا / Al-Malqa', nationalAddress: '3245 6789 1234', areaSqm: 145, rooms: 3, bathrooms: 2, floor: 12, price: 1150000, currency: 'SAR' },
    { unitNumber: 'B-0402', projectId: 'PRJ-ALNOOR', projectName: 'مشروع النور السكني / Al-Noor Residential', city: 'جدة / Jeddah', district: 'حي الشاطئ / Al-Shatea', nationalAddress: '7512 8834 9021', areaSqm: 98, rooms: 2, bathrooms: 2, floor: 4, price: 780000, currency: 'SAR' }
  ];
  demoUnits.forEach((u, i) => {
    const unit = Object.assign({ id: 'UNIT-SEED-' + (i + 1) }, sanitizeUnit(u));
    db.units.push(unit);
    const listing = {
      id: 'LST-SEED-' + (i + 1),
      inquiryNumber: 'INQ-2025-00000' + (i + 1),
      unitId: unit.id,
      status: i === 0 ? 'booked' : 'active',
      verified: true,
      unitLocked: i === 0,
      createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      developerId: 'DEV-001'
    };
    db.listings.push(listing);
    const account = {
      id: 'ACC-SEED-' + (i + 1),
      type: 'escrow',
      number: 'SA-ESC-SEED000' + (i + 1),
      listingId: listing.id,
      unitId: unit.id,
      balance: i === 0 ? 115000 : 0,
      currency: 'SAR',
      createdAt: listing.createdAt,
      active: true
    };
    db.accounts.push(account);
    log({ action: 'LISTING_CREATED', listingId: listing.id, inquiryNumber: listing.inquiryNumber, actor: 'DEV-001' });
    if (i === 0) {
      const booking = {
        id: 'BKG-SEED-1', listingId: listing.id, inquiryNumber: listing.inquiryNumber,
        buyerName: 'أحمد المطيري / Ahmed Al-Mutairi', buyerId: 'BYR-001', amount: 1150000,
        status: 'confirmed', createdAt: new Date().toISOString(), unitSnapshot: sanitizeUnit(unit)
      };
      db.bookings.push(booking);
      log({ action: 'UNIT_DATA_LOCKED', listingId: listing.id, unitId: unit.id, actor: 'BYR-001' });
      log({ action: 'BOOKING_CONFIRMED', bookingId: booking.id, listingId: listing.id, actor: 'BYR-001' });
      const inv = {
        id: 'INV-SEED-1', number: 'INV-SEED0001', listingNumber: listing.inquiryNumber,
        accountNumber: account.number, virtualAccountNumber: 'SA-DEP-SEED0001',
        purpose: 'deposit', amount: 115000, currency: 'SAR',
        description: 'عربون حجز الوحدة A-1201 / Booking deposit for unit A-1201',
        status: 'paid', dueDate: null, issuedAt: new Date().toISOString(), paidAt: new Date().toISOString()
      };
      db.invoices.push(inv);
      db.payments.push({
        id: 'PAY-SEED-1', invoiceNumber: inv.number, virtualAccountNumber: inv.virtualAccountNumber,
        amount: 115000, method: 'bank-transfer', reference: 'TRX-SEED0001',
        paidAt: new Date().toISOString(), status: 'completed'
      });
      db.accounts.push({
        id: 'ACC-SEED-VA1', type: 'virtual', purpose: 'deposit', number: 'SA-DEP-SEED0001',
        parentAccountId: account.id, listingId: listing.id, unitId: unit.id,
        balance: 115000, createdAt: new Date().toISOString(), active: true
      });
      log({ action: 'PAYMENT_COMPLETED', invoiceNumber: inv.number, reference: 'TRX-SEED0001', amount: 115000 });
    }
  });
}

// ---------- static files ----------
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

// ---------- router ----------
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
      if (req.method === 'GET') {
        if (route === 'verify' && api.verify) return api.verify(req, res, u.searchParams);
        if (route === 'listings') return api.listings(req, res, u.searchParams);
        if (route === 'invoices') return api.invoices(req, res, u.searchParams);
        if (route === 'track') return api.track(req, res, u.searchParams);
        if (route === 'stats') return api.stats(req, res, u.searchParams);
        if (route === 'audit') return api.audit(req, res, u.searchParams);
      }
      if (req.method === 'POST') {
        if (route === 'listings') return await api.createListing(req, res);
        if (route === 'book') return await api.book(req, res);
        if (route === 'invoices') return await api.createInvoice(req, res);
        if (route === 'owner-union-invoices') return await api.createOwnerUnionInvoice(req, res);
        if (route === 'pay') return await api.pay(req, res);
        if (route === 'unit-change-request') return await api.requestUnitChange(req, res);
      }
      return send(res, 404, { ok: false, error: 'ROUTE_NOT_FOUND' });
    }
    serveStatic(req, res, p);
  } catch (e) {
    send(res, 400, { ok: false, error: 'BAD_REQUEST', message: e.message });
  }
});

loadDb();
server.listen(PORT, () => console.log(`Muwaqe Estates platform running → http://localhost:${PORT}`));
