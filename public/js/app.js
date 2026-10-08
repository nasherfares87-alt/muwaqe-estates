'use strict';
async function api(path, opts) {
  const res = await fetch('/api/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
  return res.json();
}

function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = v; });
  return o;
}

function post(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body) });
}

function showResult(el, html) { el.innerHTML = html; }
function okMsg(msg) { return '<div class="msg-ok">' + msg + '</div>'; }
function errMsg(msg) { return '<div class="msg-err">' + msg + '</div>'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function unitTable(unit) {
  if (!unit) return '';
  const rows = [
    ['Unit / الوحدة', esc(unit.unitNumber)],
    ['Project / المشروع', esc(unit.projectName || '—')],
    ['City / المدينة', esc(unit.city)],
    ['District / الحي', esc(unit.district || '—')],
    ['National Address / العنوان الوطني', esc(unit.nationalAddress || '—')],
    ['Area / المساحة', esc(unit.areaSqm) + ' m²'],
    ['Rooms / الغرف', esc(unit.rooms || '—')],
    ['Price / السعر', Number(unit.price).toLocaleString() + ' ' + esc(unit.currency)]
  ];
  return '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td></tr>').join('') + '</table>';
}

async function loadStats() {
  const r = await api('stats');
  if (!r.ok) return;
  const s = r.stats;
  const items = [
    [s.listings, t('statListings')],
    [s.bookings, t('statBookings')],
    [s.invoices, t('statInvoices')],
    [s.paidInvoices, t('statPaid')],
    [Number(s.paymentsTotal).toLocaleString(), t('statPaidAmt')],
    [s.accounts, t('statAccounts')],
    [s.auditEntries, t('statAudit')]
  ];
  document.getElementById('statsGrid').innerHTML = items.map(i => '<div class="stat"><b>' + esc(i[0]) + '</b><span>' + esc(i[1]) + '</span></div>').join('');
  document.getElementById('heroStats').innerHTML =
    '<div class="hstat"><b>' + s.listings + '</b><span>' + t('statListings') + '</span></div>' +
    '<div class="hstat"><b>' + s.bookings + '</b><span>' + t('statBookings') + '</span></div>' +
    '<div class="hstat"><b>' + s.paidInvoices + '</b><span>' + t('statPaid') + '</span></div>';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  document.addEventListener('langchange', loadStats);

  document.getElementById('verifyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const num = document.getElementById('verifyInput').value.trim();
    const el = document.getElementById('verifyResult');
    const r = await api('verify?number=' + encodeURIComponent(num));
    if (!r.ok) return showResult(el, errMsg(r.messageEn ? t('notFound') : t('notFound')));
    const l = r.listing;
    const status = l.booked ? t('fBooked') : t('fActive');
    showResult(el,
      okMsg(t('verifiedOk')) +
      unitTable(l.unit) +
      '<table>' +
      '<tr><td>' + t('fInquiry') + '</td><td><b>' + esc(l.inquiryNumber) + '</b></td></tr>' +
      '<tr><td>' + t('fStatus') + '</td><td><b>' + esc(status) + '</b></td></tr>' +
      '<tr><td>' + t('fUnit') + '</td><td><b>' + (l.unitLocked ? t('fLocked') : t('fUnlocked')) + '</b></td></tr>' +
      '<tr><td>' + t('fEscrow') + '</td><td><b>' + esc(l.escrowNumber || '—') + '</b></td></tr>' +
      '</table>');
  });

  document.getElementById('listingForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = formData(e.target);
    const r = await post('listings', { unit: b, developerId: 'DEV-001' });
    const el = document.getElementById('listingResult');
    if (!r.ok) return showResult(el, errMsg('Error'));
    showResult(el, okMsg(t('fInquiry') + ': ' + r.inquiryNumber) + '<table><tr><td>' + t('fEscrow') + '</td><td><b>' + esc(r.escrowAccount) + '</b></td></tr></table>');
    loadStats(); e.target.reset();
  });

  document.getElementById('bookForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = formData(e.target);
    const r = await post('book', b);
    const el = document.getElementById('bookResult');
    if (!r.ok) return showResult(el, errMsg(r.error === 'ALREADY_BOOKED' ? (t('fBooked')) : 'Error'));
    showResult(el, okMsg(t('fBooked') + ' — ' + t('fUnit') + ': ' + t('fLocked')));
    loadStats(); e.target.reset();
  });

  document.getElementById('invoiceForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = formData(e.target);
    const r = await post('invoices', b);
    const el = document.getElementById('invoiceResult');
    if (!r.ok) return showResult(el, errMsg('Error'));
    showResult(el, okMsg('Invoice: ' + r.invoice.number) + '<table><tr><td>Virtual account</td><td><b>' + esc(r.invoice.virtualAccountNumber) + '</b></td></tr><tr><td>Amount</td><td><b>' + Number(r.invoice.amount).toLocaleString() + ' SAR</b></td></tr></table>');
    loadStats(); e.target.reset();
  });

  document.getElementById('payForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = formData(e.target);
    const r = await post('pay', b);
    const el = document.getElementById('payResult');
    if (!r.ok) return showResult(el, errMsg(r.error === 'ALREADY_PAID' ? 'Already paid' : 'Error'));
    showResult(el, okMsg('Paid ✓ Reference: ' + r.payment.reference));
    loadStats(); e.target.reset();
  });

  document.getElementById('unionForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = formData(e.target);
    const r = await post('owner-union-invoices', b);
    const el = document.getElementById('unionResult');
    if (!r.ok) return showResult(el, errMsg('Error'));
    showResult(el, okMsg('Invoice: ' + r.invoice.number + ' (' + r.invoice.cycle + ')'));
    loadStats(); e.target.reset();
  });

  document.getElementById('trackForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = formData(e.target);
    const r = await api('track?number=' + encodeURIComponent(b.number));
    const el = document.getElementById('trackResult');
    if (!r.ok) return showResult(el, errMsg(t('notFound')));
    let html = okMsg(t('tracked')) + '<pre class="code">' + esc(JSON.stringify({ listing: r.listing, invoices: r.invoices, payments: r.payments, timelineCount: r.timeline.length }, null, 2)) + '</pre>';
    showResult(el, html);
  });
});
