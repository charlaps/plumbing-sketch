/* APS Jobs – offline job register. All data lives in localStorage on this device. */
(function () {
  'use strict';

  var KEY = 'apsJobs.v1';
  var VAT_RATE = 0.15;
  var APS_PHONE = '072 230 9222';
  var STATUSES = [
    { key: 'lead', label: 'Lead' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'booked', label: 'Booked' },
    { key: 'onsite', label: 'On site' },
    { key: 'done', label: 'Done' },
    { key: 'invoiced', label: 'Invoiced' },
    { key: 'paid', label: 'Paid' }
  ];
  var TYPES = { geyser: 'Geyser', bathroom: 'Bathroom', filter: 'Filter', leak: 'Leak', 'new': 'New install', other: 'Other' };
  var CSV_COLS = ['id', 'created', 'updated', 'client', 'phone', 'suburb', 'address', 'type', 'status', 'scope',
    'materials', 'labour', 'vat', 'depositPct', 'subtotal', 'vatAmount', 'total', 'deposit', 'notes'];

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var jobs = load();
  var filter = { q: '', status: '', suburb: '' };
  var editingId = null;

  /* ---------- storage ---------- */
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(d) ? d : []; }
    catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(jobs)); }
    catch (e) { toast('Could not save – phone storage full or private mode. Export CSV now.'); }
  }
  function uid() { return 'J' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }

  /* ---------- money ---------- */
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function money(n) {
    n = r2(n);
    var neg = n < 0; n = Math.abs(n);
    var parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-R' : 'R') + parts.join('.');
  }
  function vatOn(j) { return !!(j && j.vat === true); }
  function calc(j) {
    var sub = r2(num(j.materials) + num(j.labour));
    var vat = vatOn(j) ? r2(sub * VAT_RATE) : 0;
    var total = r2(sub + vat);
    var pct = j.depositPct === '' || j.depositPct == null ? 80 : Math.min(100, Math.max(0, num(j.depositPct)));
    return { sub: sub, vat: vat, total: total, pct: pct, deposit: r2(total * pct / 100), balance: r2(total - total * pct / 100) };
  }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function statusIdx(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].key === k) return i; return 0; }
  function statusLabel(k) { return STATUSES[statusIdx(k)].label; }
  function normSuburb(s) { s = String(s || '').trim().replace(/\s+/g, ' '); return s ? s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : ''; }
  function waNumber(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.charAt(0) === '0' && d.length === 10) d = '27' + d.slice(1);
    if (d.length === 9) d = '27' + d;
    return d;
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }

  var toastTimer;
  function toast(msg, undoFn) {
    var t = $('#toast');
    t.innerHTML = esc(msg) + (undoFn ? ' <button class="link" style="color:#9cc3ff" id="undoBtn">Undo</button>' : '');
    t.hidden = false;
    if (undoFn) $('#undoBtn').onclick = function () { undoFn(); t.hidden = true; };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, undoFn ? 5000 : 3000);
  }

  /* ---------- render ---------- */
  function suburbs() {
    var seen = {};
    jobs.forEach(function (j) { if (j.suburb) seen[j.suburb] = true; });
    ['Krugersdorp', 'Pretoria', 'Edenvale'].forEach(function (s) { seen[s] = seen[s] || false; });
    return Object.keys(seen).sort();
  }

  function renderFilters() {
    var counts = {};
    jobs.forEach(function (j) { counts[j.status] = (counts[j.status] || 0) + 1; });
    var html = '<button class="fchip" role="tab" data-status="" aria-selected="' + (filter.status === '') + '">All<small>' + jobs.length + '</small></button>';
    STATUSES.forEach(function (s) {
      html += '<button class="fchip" role="tab" data-status="' + s.key + '" aria-selected="' + (filter.status === s.key) + '">' + s.label + '<small>' + (counts[s.key] || 0) + '</small></button>';
    });
    $('#statusFilter').innerHTML = html;

    var used = {}; jobs.forEach(function (j) { if (j.suburb) used[j.suburb] = true; });
    var sel = $('#suburbFilter');
    var opts = '<option value="">All suburbs</option>';
    Object.keys(used).sort().forEach(function (s) { opts += '<option' + (s === filter.suburb ? ' selected' : '') + '>' + esc(s) + '</option>'; });
    sel.innerHTML = opts;
    if (filter.suburb && !used[filter.suburb]) { filter.suburb = ''; }
    $('#suburbList').innerHTML = suburbs().map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
  }

  function renderSummary() {
    var active = 0, toCollect = 0, paid = 0;
    jobs.forEach(function (j) {
      var c = calc(j);
      if (['booked', 'onsite'].indexOf(j.status) > -1) active++;
      if (['done', 'invoiced'].indexOf(j.status) > -1) toCollect += c.total;
      if (j.status === 'paid') paid += c.total;
    });
    $('#summary').innerHTML =
      '<div class="sum"><b>' + active + '</b><span>Booked / on site</span></div>' +
      '<div class="sum"><b>' + money(toCollect) + '</b><span>To collect</span></div>' +
      '<div class="sum"><b>' + money(paid) + '</b><span>Paid</span></div>';
    $('#summary').hidden = jobs.length === 0;
  }

  function matches(j) {
    if (filter.status && j.status !== filter.status) return false;
    if (filter.suburb && j.suburb !== filter.suburb) return false;
    if (filter.q) {
      var hay = [j.client, j.phone, j.suburb, j.address, j.scope, j.notes, TYPES[j.type]].join(' ').toLowerCase();
      var words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function cardHTML(j) {
    var c = calc(j);
    var idx = statusIdx(j.status);
    var next = STATUSES[idx + 1];
    var meta = [j.suburb, j.phone].filter(Boolean).map(esc).join(' · ');
    var money_ = (c.sub > 0) ?
      '<div class="money">' +
        (num(j.materials) ? '<span>Materials</span><span>' + money(num(j.materials)) + '</span>' : '') +
        (num(j.labour) ? '<span>Labour</span><span>' + money(num(j.labour)) + '</span>' : '') +
        (vatOn(j) ? '<span>VAT 15%</span><span>' + money(c.vat) + '</span>' : '') +
        '<span class="tot">Total' + (vatOn(j) ? ' incl. VAT' : '') + '</span><span class="tot">' + money(c.total) + '</span>' +
        '<span class="dep">Deposit ' + c.pct + '%</span><span class="dep">' + money(c.deposit) + '</span>' +
      '</div>' : '';
    return '<article class="card st-' + j.status + '" data-id="' + j.id + '">' +
      '<div class="card-top"><div class="who">' +
        '<h3>' + esc(j.client || 'No name') + '</h3>' +
        '<div class="meta"><span class="type">' + esc(TYPES[j.type] || 'Other') + '</span>' + meta + '</div>' +
        (j.address ? '<div class="meta">' + esc(j.address) + '</div>' : '') +
        '<div class="meta">Added ' + fmtDate(j.created) + (j.updated && j.updated !== j.created ? ' · updated ' + fmtDate(j.updated) : '') + '</div>' +
      '</div>' +
      '<button class="status st-' + j.status + '" data-act="next" title="' + (next ? 'Tap to move to ' + next.label : 'Paid – finished') + '" aria-label="Status ' + statusLabel(j.status) + (next ? ', tap to move to ' + next.label : '') + '">' + statusLabel(j.status) + '</button>' +
      '</div>' +
      (j.scope ? '<p class="scope">' + esc(j.scope) + '</p>' : '') +
      (j.notes ? '<p class="notes">📝 ' + esc(j.notes) + '</p>' : '') +
      money_ +
      '<div class="actions">' +
        '<a class="btn btn-wa" data-act="wa" href="#" target="_blank" rel="noopener">WhatsApp</a>' +
        (j.phone ? '<a class="btn btn-light" href="tel:' + esc(String(j.phone).replace(/[^\d+]/g, '')) + '">Call</a>' : '') +
        '<button class="btn btn-light" data-act="edit">Edit</button>' +
      '</div>' +
    '</article>';
  }

  function render() {
    renderFilters();
    renderSummary();
    var list = jobs.filter(matches).sort(function (a, b) { return (b.updated || '').localeCompare(a.updated || ''); });
    $('#list').innerHTML = list.map(cardHTML).join('');
    $('#empty').hidden = jobs.length > 0;
    $('#nomatch').hidden = !(jobs.length > 0 && list.length === 0);
    // prepare WhatsApp links
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="wa"]'), function (a) {
      var j = byId(a.closest('.card').dataset.id);
      a.href = waLink(j);
    });
  }

  function byId(id) { for (var i = 0; i < jobs.length; i++) if (jobs[i].id === id) return jobs[i]; return null; }

  /* ---------- WhatsApp ---------- */
  function waText(j) {
    var c = calc(j);
    var early = statusIdx(j.status) <= statusIdx('booked');
    var first = (j.client || '').trim().replace(/^example\s*[–-]\s*/i, '');
    var lines = [];
    lines.push('Hi' + (first ? ' ' + first : '') + ', ' + (early ? 'here is your APS Plumbing quote summary.' : 'here is your APS Plumbing job summary.'));
    lines.push('');
    lines.push('*Job:* ' + (TYPES[j.type] || 'Plumbing') + (j.suburb ? ' – ' + j.suburb : ''));
    if (j.scope) { lines.push('*Scope of work:*'); lines.push(j.scope.trim()); }
    if (c.sub > 0) {
      lines.push('');
      if (num(j.materials)) lines.push('Materials: ' + money(num(j.materials)));
      if (num(j.labour)) lines.push('Labour: ' + money(num(j.labour)));
      lines.push('*Total: ' + money(c.total) + '*');
      if (early && c.pct > 0) lines.push('Deposit to book (' + c.pct + '%): ' + money(c.deposit));
      if (!early && j.status !== 'paid' && c.pct > 0 && c.pct < 100) lines.push('Balance after ' + c.pct + '% deposit: ' + money(c.balance));
    }
    lines.push('');
    if (j.status === 'paid') lines.push('Payment received – thank you for choosing APS!');
    else if (early) lines.push('Reply YES to book, or let me know if you have any questions.');
    else lines.push('Thank you for choosing APS.');
    lines.push('APS Plumbing · ' + APS_PHONE);
    return lines.join('\n');
  }
  function waLink(j) {
    return 'https://wa.me/' + waNumber(j.phone) + '?text=' + encodeURIComponent(waText(j));
  }

  /* ---------- status ---------- */
  function advance(id) {
    var j = byId(id); if (!j) return;
    var idx = statusIdx(j.status);
    if (idx >= STATUSES.length - 1) { toast('Already Paid ✔ – use Edit to change status.'); return; }
    var prev = j.status, prevUpd = j.updated;
    j.status = STATUSES[idx + 1].key;
    j.updated = new Date().toISOString();
    save(); render();
    toast(j.client + ' → ' + statusLabel(j.status), function () { j.status = prev; j.updated = prevUpd; save(); render(); });
  }

  /* ---------- form ---------- */
  var dlg = $('#jobDlg'), form = $('#jobForm');
  $('#statusSelect').innerHTML = STATUSES.map(function (s) { return '<option value="' + s.key + '">' + s.label + '</option>'; }).join('');

  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }

  function openForm(id) {
    editingId = id || null;
    var j = id ? byId(id) : { type: 'geyser', status: 'lead', depositPct: 80, vat: false };
    form.reset();
    ['client', 'phone', 'suburb', 'address', 'type', 'scope', 'materials', 'labour', 'depositPct', 'status', 'notes'].forEach(function (k) {
      var v = j[k]; form.elements[k].value = (v == null ? '' : v);
    });
    if (!id) form.elements.depositPct.value = 80;
    form.elements.vat.checked = vatOn(j);
    form.elements.client.classList.remove('invalid');
    $('#dlgTitle').textContent = id ? 'Edit job' : 'New job';
    $('#deleteBtn').hidden = !id;
    updatePreview();
    openDlg(dlg);
    if (!id) setTimeout(function () { form.elements.client.focus(); }, 50);
  }

  function readForm() {
    var e = form.elements;
    return {
      client: e.client.value.trim(), phone: e.phone.value.trim(), suburb: normSuburb(e.suburb.value),
      address: e.address.value.trim(), type: e.type.value, scope: e.scope.value.trim(),
      materials: e.materials.value === '' ? '' : r2(num(e.materials.value)),
      labour: e.labour.value === '' ? '' : r2(num(e.labour.value)),
      depositPct: e.depositPct.value === '' ? 80 : Math.min(100, Math.max(0, Math.round(num(e.depositPct.value)))),
      vat: e.vat.checked, status: e.status.value, notes: e.notes.value.trim()
    };
  }

  function updatePreview() {
    var c = calc(readForm());
    var v = form.elements.vat.checked;
    $('#calcPreview').innerHTML =
      (v ? '<span>Subtotal</span><span>' + money(c.sub) + '</span>' +
        '<span>VAT 15%</span><span>' + money(c.vat) + '</span>' : '') +
      '<span><strong>Total' + (v ? ' incl. VAT' : '') + '</strong></span><span>' + money(c.total) + '</span>' +
      '<span>Deposit ' + c.pct + '%</span><span>' + money(c.deposit) + '</span>' +
      '<span>Balance on completion</span><span>' + money(c.balance) + '</span>';
  }
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var data = readForm();
    if (!data.client) { form.elements.client.classList.add('invalid'); form.elements.client.focus(); toast('Add the client name first.'); return; }
    var now = new Date().toISOString();
    if (editingId) {
      var j = byId(editingId);
      Object.keys(data).forEach(function (k) { j[k] = data[k]; });
      j.updated = now;
      toast('Job saved.');
    } else {
      data.id = uid(); data.created = now; data.updated = now;
      jobs.push(data);
      toast('Job added.');
      if (filter.status && filter.status !== data.status) filter.status = '';
    }
    save(); closeDlg(dlg); render();
  });

  $('#deleteBtn').addEventListener('click', function () {
    var j = byId(editingId); if (!j) return;
    if (!confirm('Delete the job for ' + j.client + '? This cannot be undone (export CSV first if unsure).')) return;
    jobs = jobs.filter(function (x) { return x.id !== editingId; });
    save(); closeDlg(dlg); render(); toast('Job deleted.');
  });

  document.addEventListener('click', function (ev) {
    var c = ev.target.closest('[data-close]');
    if (c) closeDlg(c.closest('dialog'));
  });
  [dlg, $('#helpDlg')].forEach(function (d) {
    d.addEventListener('click', function (ev) { if (ev.target === d) closeDlg(d); }); // tap backdrop
  });

  /* ---------- list events ---------- */
  $('#list').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var id = b.closest('.card').dataset.id;
    var act = b.dataset.act;
    if (act === 'next') advance(id);
    else if (act === 'edit') openForm(id);
    else if (act === 'wa') b.href = waLink(byId(id)); // refresh link at tap time
  });
  $('#addBtn').addEventListener('click', function () { openForm(null); });

  $('#q').addEventListener('input', function (e) { filter.q = e.target.value.trim(); render(); });
  $('#statusFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-status]'); if (!b) return;
    filter.status = b.dataset.status; render();
  });
  $('#suburbFilter').addEventListener('change', function (e) { filter.suburb = e.target.value; render(); });
  $('#clearFilters').addEventListener('click', function () {
    filter = { q: '', status: '', suburb: '' }; $('#q').value = ''; render();
  });

  /* ---------- menu ---------- */
  var menu = $('#menu'), menuBtn = $('#menuBtn');
  function setMenu(open) { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); }
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.closest('#list')) return;
    var act = b.dataset.act;
    if (act === 'export') { setMenu(false); exportCSV(); }
    else if (act === 'sample') { setMenu(false); addSample(); }
    else if (act === 'help') { setMenu(false); openDlg($('#helpDlg')); }
  });

  function addSample() {
    var now = new Date().toISOString();
    jobs.push({
      id: uid(), created: now, updated: now, client: 'Example – Mrs Botha', phone: '', suburb: 'Krugersdorp',
      address: '12 Example Street, Monument', type: 'geyser', status: 'quoted',
      scope: 'Remove burst 150L geyser, supply and install new 150L geyser with full safety valve set, drip tray and vacuum breakers. Test, commission and issue CoC.',
      materials: 9800, labour: 3200, depositPct: 80, vat: false, notes: 'Example job – delete me once you have real jobs.'
    });
    save(); filter = { q: '', status: '', suburb: '' }; $('#q').value = ''; render();
    toast('Example job added. Tap Edit → Delete to remove it.');
  }

  /* ---------- CSV ---------- */
  function csvCell(v) {
    v = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(v) && isNaN(Number(v))) v = "'" + v; // guard against spreadsheet formulas
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCSV() {
    if (!jobs.length) { toast('No jobs to export yet.'); return; }
    var rows = [CSV_COLS.join(',')];
    jobs.forEach(function (j) {
      var c = calc(j);
      var o = {}; Object.keys(j).forEach(function (k) { o[k] = j[k]; });
      o.status = statusLabel(j.status); o.type = TYPES[j.type] || 'Other';
      o.vat = vatOn(j) ? 'yes' : 'no';
      o.subtotal = c.sub.toFixed(2); o.vatAmount = c.vat.toFixed(2); o.total = c.total.toFixed(2); o.deposit = c.deposit.toFixed(2);
      rows.push(CSV_COLS.map(function (k) { return csvCell(o[k]); }).join(','));
    });
    var blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'APS-Jobs-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Exported ' + jobs.length + ' jobs.');
  }

  function parseCSV(text) {
    text = text.replace(/^\ufeff/, '');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
  }
  function keyFrom(map, val, fallback) {
    val = String(val || '').trim().toLowerCase().replace(/\s+/g, '');
    for (var k in map) if (k === val || String(map[k]).toLowerCase().replace(/\s+/g, '') === val) return k;
    return fallback;
  }
  function importCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) { toast('That CSV has no jobs in it.'); return; }
    var head = rows[0].map(function (h) { return h.trim(); });
    var col = function (r, name) { var i = head.indexOf(name); return i > -1 ? (r[i] || '').replace(/^'(?=[=+\-@])/, '') : ''; };
    if (head.indexOf('client') === -1) { toast('Not an APS Jobs CSV (no "client" column).'); return; }
    var stMap = {}; STATUSES.forEach(function (s) { stMap[s.key] = s.label; });
    var added = 0, updated = 0, now = new Date().toISOString();
    rows.slice(1).forEach(function (r) {
      var j = {
        id: col(r, 'id') || uid(), created: col(r, 'created') || now, updated: col(r, 'updated') || now,
        client: col(r, 'client').trim(), phone: col(r, 'phone').trim(), suburb: normSuburb(col(r, 'suburb')),
        address: col(r, 'address').trim(), type: keyFrom(TYPES, col(r, 'type'), 'other'),
        status: keyFrom(stMap, col(r, 'status'), 'lead'), scope: col(r, 'scope').trim(),
        materials: col(r, 'materials') === '' ? '' : r2(num(col(r, 'materials'))),
        labour: col(r, 'labour') === '' ? '' : r2(num(col(r, 'labour'))),
        depositPct: col(r, 'depositPct') === '' ? 80 : num(col(r, 'depositPct')),
        vat: /^(yes|true|1)$/i.test(col(r, 'vat').trim()), notes: col(r, 'notes').trim()
      };
      if (!j.client) return;
      var ex = byId(j.id);
      if (ex) { Object.keys(j).forEach(function (k) { ex[k] = j[k]; }); updated++; }
      else { jobs.push(j); added++; }
    });
    save(); render();
    toast('Imported: ' + added + ' new, ' + updated + ' updated.');
  }
  $('#importFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    setMenu(false);
    var rd = new FileReader();
    rd.onload = function () { importCSV(String(rd.result)); e.target.value = ''; };
    rd.readAsText(f);
  });

  /* ---------- go ---------- */
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  // expose for testing
  window.APSJobs = { calc: calc, money: money, waText: waText, waNumber: waNumber, parseCSV: parseCSV };
})();
