'use strict';
async function api(path, opts) {
  const res = await fetch('/api/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
  return res.json();
}
function post(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body) }); }
function formData(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = v; }); return o; }
function show(el, html) { el.innerHTML = html; }
function okMsg(m) { return '<div class="msg-ok">' + m + '</div>'; }
function errMsg(m) { return '<div class="msg-err">' + m + '</div>'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function unitTable(u) {
  if (!u) return '';
  const rows = [
    ['Unit / الوحدة', esc(u.unitNumber)], ['Project / المشروع', esc(u.projectName || '—')],
    ['City / المدينة', esc(u.city)], ['District / الحي', esc(u.district || '—')],
    ['National Address / العنوان الوطني', esc(u.nationalAddress || '—')],
    ['Area / المساحة', esc(u.areaSqm) + ' m²'], ['Rooms / الغرف', esc(u.rooms || '—')],
    ['Price / السعر', Number(u.price).toLocaleString() + ' ' + esc(u.currency)]
  ];
  return '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td></tr>').join('') + '</table>';
}

// --- navigation ---
function go(view) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(tb => tb.classList.toggle('active', tb.dataset.go === view));
  window.scrollTo(0, 0);
  if (view === 'listings') loadListings();
  if (view === 'home') loadStats();
}

async function loadStats() {
  const r = await api('stats');
  if (!r.ok) return;
  const s = r.stats;
  const items = [[s.listings, t('statListings')], [s.bookings, t('statBookings')], [s.invoices, t('statInvoices')], [s.paidInvoices, t('statPaid')]];
  document.getElementById('statsGrid').innerHTML = items.map(i => '<div class="stat"><b>' + esc(i[0]) + '</b><span>' + esc(i[1]) + '</span></div>').join('');
}

async function loadListings() {
  const r = await api('listings');
  const el = document.getElementById('mListingsResult');
  if (!r.ok) return show(el, errMsg('Error'));
  if (!r.listings.length) return show(el, '<p class="msg-ok">' + esc(t('noData')) + '</p>');
  el.innerHTML = r.listings.map(l =>
    '<div class="listing-card"><div class="lq">' + esc(l.inquiryNumber) + '</div>' +
    unitTable(l.unit) +
    '<span class="badge-status ' + esc(l.status) + '">' + esc(l.status === 'booked' ? t('fBooked') : t('fActive')) + '</span>' +
    (l.unitLocked ? ' <span class="badge-status active">' + esc(t('fLocked')) + '</span>' : '') +
    '</div>').join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  document.addEventListener('langchange', loadStats);

  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

  document.getElementById('mVerifyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await api('verify?number=' + encodeURIComponent(document.getElementById('mVerifyInput').value.trim()));
    const el = document.getElementById('mVerifyResult');
    if (!r.ok) return show(el, errMsg(t('notFound')));
    const l = r.listing;
    show(el, okMsg(t('verifiedOk')) + unitTable(l.unit) +
      '<table>' +
      '<tr><td>' + t('fInquiry') + '</td><td><b>' + esc(l.inquiryNumber) + '</b></td></tr>' +
      '<tr><td>' + t('fStatus') + '</td><td><b>' + esc(l.booked ? t('fBooked') : t('fActive')) + '</b></td></tr>' +
      '<tr><td>' + t('fUnit') + '</td><td><b>' + (l.unitLocked ? t('fLocked') : t('fUnlocked')) + '</b></td></tr>' +
      '<tr><td>' + t('fEscrow') + '</td><td><b>' + esc(l.escrowNumber || '—') + '</b></td></tr></table>');
  });

  document.getElementById('mBookForm').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await post('book', formData(e.target));
    const el = document.getElementById('mBookResult');
    if (!r.ok) return show(el, errMsg(r.error === 'ALREADY_BOOKED' ? t('fBooked') : 'Error'));
    show(el, okMsg(t('fBooked') + ' — ' + t('fUnit') + ': ' + t('fLocked')));
    loadStats(); e.target.reset();
  });

  document.getElementById('mInvoiceForm').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await post('invoices', formData(e.target));
    const el = document.getElementById('mInvoiceResult');
    if (!r.ok) return show(el, errMsg('Error'));
    show(el, okMsg('Invoice: ' + esc(r.invoice.number)) +
      '<table><tr><td>Virtual account</td><td><b>' + esc(r.invoice.virtualAccountNumber) + '</b></td></tr>' +
      '<tr><td>Amount</td><td><b>' + Number(r.invoice.amount).toLocaleString() + ' SAR</b></td></tr></table>');
    loadStats(); e.target.reset();
  });

  document.getElementById('mPayForm').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await post('pay', formData(e.target));
    const el = document.getElementById('mPayResult');
    if (!r.ok) return show(el, errMsg(r.error === 'ALREADY_PAID' ? 'Already paid' : 'Error'));
    show(el, okMsg('Paid ✓ Reference: ' + esc(r.payment.reference)));
    loadStats(); e.target.reset();
  });

  document.getElementById('mTrackForm').addEventListener('submit', async e => {
    e.preventDefault();
    const num = formData(e.target).number;
    const r = await api('track?number=' + encodeURIComponent(num));
    const el = document.getElementById('mTrackResult');
    if (!r.ok) return show(el, errMsg(t('notFound')));
    show(el, okMsg(t('tracked')) + '<pre class="code">' + esc(JSON.stringify({ listing: r.listing, invoices: r.invoices, payments: r.payments, timelineCount: r.timeline.length }, null, 2)) + '</pre>');
  });

  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    const link = document.getElementById('fullSiteLink');
    if (link) link.href = '/?full=1';
  }
});
