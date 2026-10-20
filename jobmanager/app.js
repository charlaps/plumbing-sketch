/* APS Job Manager — phone UI. Local logins until Supabase is connected. */
(function () {
  'use strict';

  var R = window.APSRates;
  var APS = {
    name: 'APS – Architectural Plumbing Services',
    phone: '072 230 9222',
    wa: '27722309222',
    email: 'charl@agasouthafrica.co.za'
  };
  var NOT_INCL = 'Tiling, building, plaster, paint, electrical work, and any client-supplied items.';
  var STAGES = [
    ['lead', 'Lead'], ['quoted', 'Quoted'], ['booked', 'Booked'], ['progress', 'In progress'],
    ['done', 'Done'], ['invoiced', 'Invoiced'], ['paid', 'Paid']
  ];
  var COLORS = ['#0277BD', '#2E7D32', '#EF6C00', '#6A1B9A', '#00838F', '#C62828'];
  var photoUrls = [];
  var drawSeq = 0;
  var toastTimer = 0;

  var App = {
    user: null,
    hasUsers: false,
    users: [],
    jobs: [],
    quotes: {},
    invoices: {},
    route: { name: 'jobs' },
    search: '',
    filter: 'all',
    day: '',
    book: null,
    draft: null,
    liveCard: null,
    matHits: [],
    cloudTeam: null,
    clients: [],
    sites: [],
    places: [],
    demoOn: false,
    clientQ: '',
    stockPlace: '',
    stockHits: [],
    repFrom: '',
    repTo: '',
    reportCache: null,
    focusId: ''
  };
  window.APSApp = {
    onSync: function () {
      paintSync();
      if (!App.user) return;
      var busy = { quote: 1, edit: 1, card: 1, invoice: 1 };
      if (busy[App.route.name]) return;
      reload().then(draw);
    }
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return R.money(n); }
  function staff() { return App.user && (App.user.role === 'owner' || App.user.role === 'office'); }
  function isOwner() { return App.user && App.user.role === 'owner'; }
  function wide() { return window.matchMedia('(min-width: 960px)').matches; }
  function useDesk() { return !!(App.user && staff() && wide()); }
  function home() { return useDesk() ? '#/dashboard' : '#/jobs'; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(key) {
    var p = String(key || todayISO()).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function shiftDay(key, days) {
    var d = parseDay(key);
    d.setDate(d.getDate() + days);
    return dayKey(d);
  }
  function weekDays(key) {
    var d = parseDay(key);
    var off = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - off);
    var out = [];
    for (var i = 0; i < 7; i++) { out.push(dayKey(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function fmtDay(key) {
    return parseDay(key).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }
  function fmtWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  }
  function fromLocal(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  function toLocal(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function combine(day, time) {
    if (!day || !time) return null;
    var d = new Date(day + 'T' + time);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  function nextNo(prefix) {
    var d = new Date();
    var rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return prefix + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + rnd;
  }
  function stageName(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i][0] === id) return STAGES[i][1];
    return id || '';
  }
  function wa(phone, text) {
    var p = String(phone || '').replace(/\D/g, '');
    if (p.charAt(0) === '0') p = '27' + p.slice(1);
    if (p.length === 9) p = '27' + p;
    if (!p) return '';
    return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text);
  }
  function payHref(link) {
    var t = String(link || '').trim();
    return /^https:\/\/[^\s]+$/i.test(t) ? t : '';
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }
  function b64e(obj) {
    var json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function b64d(s) {
    var t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return JSON.parse(decodeURIComponent(escape(atob(t))));
  }
  function hashPin(pin, salt) {
    var data = new TextEncoder().encode(salt + ':' + pin);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }
  function team() {
    if (APSSync.configured() && App.cloudTeam && App.cloudTeam.length) {
      return App.cloudTeam.filter(function (p) { return p.active !== false; }).map(function (p) {
        return { id: p.id, name: p.name, role: p.role, phone: p.phone || '' };
      });
    }
    return App.users.filter(function (u) { return u.active !== false; });
  }
  function userName(id) {
    if (!id) return 'Unassigned';
    var list = team();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    var all = App.users || [];
    for (var j = 0; j < all.length; j++) if (all[j].id === id) return all[j].name;
    return 'Plumber';
  }
  function visibleJobs() {
    if (staff()) return App.jobs;
    return App.jobs.filter(function (j) { return j.assigned_to === App.user.id; });
  }
  function canSee(job) { return staff() || (job && job.assigned_to === App.user.id); }
  function canSet(job, status) {
    if (!job) return false;
    if (staff()) return true;
    if (job.assigned_to !== App.user.id) return false;
    var ok = { booked: ['progress'], progress: ['done', 'booked'], done: ['progress'] };
    return (ok[job.status] || []).indexOf(status) >= 0;
  }
  function quoteOf(job) { return job && job.quote_id ? App.quotes[job.quote_id] : null; }
  function invoiceOf(job) { return job && job.invoice_id ? App.invoices[job.invoice_id] : null; }
  function totalsOf(job) {
    var q = quoteOf(job);
    if (q) return R.totals(q);
    var inv = invoiceOf(job);
    if (inv && inv.totals) return inv.totals;
    return null;
  }

  function parse() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
    var bits = raw.split('/').filter(Boolean);
    if (!bits.length) return { name: 'jobs', id: '' };
    var name = bits[0] === 'a' ? 'approve' : bits[0];
    return { name: name, id: bits.slice(1).join('/') };
  }
  function go(hash) {
    if (location.hash === hash) { App.route = parse(); return draw(); }
    location.hash = hash;
  }

  function side() {
    var r = App.route.name;
    var items = [
      ['dashboard', 'Dashboard', '#/dashboard'],
      ['jobs', 'Jobs', '#/jobs'],
      ['board', 'Pipeline', '#/board'],
      ['calendar', 'Calendar', '#/calendar'],
      ['clients', 'Clients', '#/clients'],
      ['stock', 'Stock', '#/stock'],
      ['map', 'Map', '#/map'],
      ['invoices', 'Invoices', '#/invoices'],
      ['reports', 'Reports', '#/reports'],
      ['more', 'More', '#/more']
    ];
    return '<aside class="side"><a class="brand" href="#/dashboard"><img src="icon-192.png" alt=""><span>APS Job Manager</span></a>' +
      items.map(function (it) {
        var on = r === it[0] || (it[0] === 'jobs' && (r === 'job' || r === 'edit' || r === 'quote' || r === 'card' || r === 'preview')) ||
          (it[0] === 'clients' && r === 'client') || (it[0] === 'stock' && r === 'po') || (it[0] === 'invoices' && r === 'invoice') ||
          (it[0] === 'more' && r === 'team');
        return '<a class="' + (on ? 'on' : '') + '" href="' + it[2] + '">' + it[1] + '</a>';
      }).join('') + '</aside>';
  }
  function frame(inner, opt) {
    opt = opt || {};
    if (opt.bare) return '<main>' + inner + '</main><div id="toast" class="toast" hidden></div>';
    var back = opt.back ? '<button class="back" type="button" data-act="go" data-to="' + esc(opt.back) + '">‹</button>' : '';
    var head = '<header class="top"><div class="top-in">' + back +
      '<img class="logo" src="icon-192.png" alt="APS">' +
      '<h1>' + esc(opt.title || 'Job Manager') + (opt.sub ? '<small>' + esc(opt.sub) + '</small>' : '') + '</h1>' +
      '<span class="syncpill" id="syncPill">On this phone</span></div></header>';
    var desk = useDesk();
    return (desk ? '<div class="shell">' + side() + '<div class="deskmain">' : '') +
      head + '<main>' + inner + '</main>' +
      (desk ? '</div></div>' : (App.user ? nav() : '')) +
      '<div id="toast" class="toast" hidden></div>';
  }
  function nav() {
    var r = App.route.name;
    var items = [['jobs', 'Jobs', '#/jobs'], ['calendar', 'Calendar', '#/calendar']];
    if (staff()) items.push(['invoices', 'Invoices', '#/invoices']);
    items.push(['more', 'More', '#/more']);
    return '<nav class="nav">' + items.map(function (it) {
      var on = r === it[0] || (it[0] === 'jobs' && (r === 'job' || r === 'edit' || r === 'quote' || r === 'card' || r === 'preview')) || (it[0] === 'invoices' && r === 'invoice');
      return '<a class="' + (on ? 'on' : '') + '" href="' + it[2] + '">' + it[1] + '</a>';
    }).join('') + '</nav>';
  }
  function paintSync() {
    var el = $('syncPill');
    if (!el) return;
    APSSync.status().then(function (s) {
      if ($('syncPill')) $('syncPill').textContent = s.label;
    });
  }

  function loadSession() {
    if (APSSync.configured()) {
      return DB.get('meta', 'cloud_user').then(function (cached) {
        return APSSync.client().then(function (sb) {
          return sb.auth.getSession().then(function (res) {
            var session = res.data && res.data.session;
            if (!session) return;
            return sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(function (prof) {
              if (prof.data) {
                App.user = { id: prof.data.id, name: prof.data.name, role: prof.data.role, phone: prof.data.phone || '', email: session.user.email };
                return DB.put('meta', { id: 'cloud_user', user: App.user });
              }
            });
          });
        }).catch(function () {
          if (cached && cached.user) App.user = cached.user;
        });
      });
    }
    return DB.get('meta', 'session').then(function (s) {
      if (!s || !s.user_id) return;
      return DB.get('users', s.user_id).then(function (u) {
        if (u && u.active !== false) App.user = publicUser(u);
      });
    });
  }
  function publicUser(u) {
    return { id: u.id, name: u.name, role: u.role, phone: u.phone || '', color: u.color || COLORS[0] };
  }
  function reload() {
    return Promise.all([
      DB.all('users'), DB.all('jobs'), DB.all('quotes'), DB.all('invoices'),
      DB.all('clients'), DB.all('sites'), DB.all('places'), DB.get('meta', 'demo_on')
    ]).then(function (all) {
      App.users = all[0] || [];
      App.hasUsers = App.users.some(function (u) { return u.active !== false; });
      App.jobs = (all[1] || []).slice().sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); });
      App.quotes = {};
      (all[2] || []).forEach(function (q) { App.quotes[q.id] = q; });
      App.invoices = {};
      (all[3] || []).forEach(function (inv) { App.invoices[inv.id] = inv; });
      App.clients = all[4] || [];
      App.sites = all[5] || [];
      App.places = all[6] || [];
      App.demoOn = !!(all[7] && all[7].on);
    }).then(function () {
      if (!App.user) return;
      var bridge = window.APSBridge ? APSBridge.importAll() : Promise.resolve();
      return bridge.then(function () {
        if (App.stockAttrs || !window.APSOffice || !APSOffice.enrichStock) return;
        return APSOffice.enrichStock().then(function () { App.stockAttrs = true; }, function () { App.stockAttrs = true; });
      });
    }).then(function () {
      if (!APSSync.configured()) return;
      return DB.get('meta', 'cloud_team').then(function (cached) {
        if (cached && cached.rows) App.cloudTeam = cached.rows;
        if (navigator.onLine === false) return;
        return APSSync.client().then(function (sb) {
          if (!sb) return;
          return sb.from('profiles').select('*').then(function (res) {
            if (res.data) {
              App.cloudTeam = res.data;
              return DB.put('meta', { id: 'cloud_team', rows: res.data });
            }
          });
        }).catch(function () {});
      });
    });
  }

  function boot() {
    return DB.open().then(function () {
      App.route = parse();
      return DB.all('users');
    }).then(function (users) {
      App.users = users || [];
      App.hasUsers = App.users.some(function (u) { return u.active !== false; });
      return loadSession();
    }).then(function () {
      if (App.user) return reload();
      if (App.route.name === 'approve') return;
      if (!APSSync.configured() && !App.hasUsers) App.route = { name: 'setup', id: '' };
      else App.route = { name: 'login', id: '' };
    }).then(function () {
      var bare = !location.hash || location.hash === '#' || location.hash === '#/';
      if (App.user && bare && useDesk()) {
        App.route = { name: 'dashboard', id: '' };
        location.hash = '#/dashboard';
      }
    }).then(draw).then(function () {
      var wasWide = wide();
      window.addEventListener('resize', function () {
        var now = wide();
        if (now === wasWide) return;
        wasWide = now;
        draw();
      });
      window.addEventListener('hashchange', onHash);
      document.addEventListener('click', onClick);
      document.addEventListener('change', onChange);
      document.addEventListener('input', onInput);
      document.addEventListener('submit', onSubmit);
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('online', function () { if (APSSync.configured()) APSSync.kick(); paintSync(); });
      setInterval(function () {
        var el = $('timerRead');
        if (el && App.liveCard) el.textContent = fmtDur(cardElapsed(App.liveCard));
      }, 500);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }

  function onHash() {
    App.route = parse();
    App.liveCard = null;
    var p = Promise.resolve();
    if (!App.user) {
      p = loadSession().then(function () {
        if (App.user) return reload();
        if (App.route.name === 'approve') return;
        if (!APSSync.configured() && !App.hasUsers) App.route = { name: 'setup', id: '' };
        else if (App.route.name !== 'login' && App.route.name !== 'setup') App.route = { name: 'login', id: '' };
      });
    } else p = reload();
    p.then(draw);
  }

  function draw() {
    var seq = ++drawSeq;
    revokePhotos();
    if (window.APSOffice) APSOffice.unmount();
    return Promise.resolve(view()).then(function (html) {
      if (seq !== drawSeq) return;
      var root = $('app');
      root.classList.toggle('desk', useDesk() && App.route.name !== 'approve');
      root.innerHTML = html;
      paintSync();
      var sign = $('sign');
      if (sign) bindSign(sign);
      if (window.APSOffice) APSOffice.mount();
      if (App.focusId) {
        var focus = $(App.focusId);
        App.focusId = '';
        if (focus) {
          focus.focus();
          var n = focus.value.length;
          if (focus.setSelectionRange) focus.setSelectionRange(n, n);
        }
      }
    }).catch(function (err) {
      $('app').innerHTML = frame('<div class="panel"><h2>Something went wrong</h2><p>' + esc(err.message || 'Please try again.') + '</p></div>', { title: 'Job Manager' });
    });
  }

  function land() {
    var h = location.hash || '';
    if (h.indexOf('#/from/') === 0) {
      App.route = parse();
      return reload().then(draw);
    }
    return go(home());
  }
  function viewFrom(fid) {
    var q = window.APSBridge ? APSBridge.quoteByFinale(fid) : null;
    if (q && q.job_id) {
      location.replace('#/job/' + q.job_id);
      return frame('<p class="muted">Opening the quote in Job Manager…</p>', { title: 'Quote' });
    }
    return frame('<div class="panel"><h2>Quote not on this phone yet</h2><p>Save it in Quote Finale on this phone, then open Job Manager again.</p></div>', { title: 'Quote' });
  }
  function view() {
    var r = App.route;
    if (r.name === 'from') return viewFrom(r.id);
    if (r.name === 'approve') return viewApprove(r.id);
    if (r.name === 'setup') return viewSetup();
    if (!App.user || r.name === 'login') return viewLogin();
    if (window.APSOffice && APSOffice.routes[r.name]) return APSOffice.view(r);
    if (r.name === 'job') return viewJob(r.id);
    if (r.name === 'edit') return viewEdit(r.id);
    if (r.name === 'calendar') return viewCalendar();
    if (r.name === 'quote') return viewQuote(r.id);
    if (r.name === 'preview') return viewPreview(r.id);
    if (r.name === 'card') return viewCard(r.id);
    if (r.name === 'invoice') return viewInvoice(r.id);
    if (r.name === 'invoices') return viewInvoices();
    if (r.name === 'team') return viewTeam();
    if (r.name === 'more') return viewMore();
    return viewJobs();
  }

  function viewSetup() {
    return frame(
      '<img class="logo-hero" src="icon-192.png" alt="APS">' +
      '<h2>Set up this phone</h2>' +
      '<p class="muted">APS Job Manager stays on this phone until you connect Supabase. Choose a PIN for the owner.</p>' +
      '<form id="setupForm">' +
      field('Your name', 'name', 'Charl Knoetze') +
      field('Phone', 'phone', APS.phone, 'tel') +
      field('PIN (4 digits or more)', 'pin', '', 'numeric', 'password') +
      field('Repeat PIN', 'pin2', '', 'numeric', 'password') +
      '<button class="btn btn-block" type="submit">Save and open</button></form>' +
      '<p class="muted">Add the office and each plumber from More, then Team. Or open a job file sent from another phone.</p>' +
      '<label class="btn btn-light btn-block filebtn">Open a job file<input id="setupFile" type="file" accept="application/json,.json"></label>',
      { title: 'APS', bare: false }
    );
  }

  function viewLogin() {
    if (APSSync.configured()) {
      return frame(
        '<img class="logo-hero" src="icon-192.png" alt="APS"><h2>Sign in</h2>' +
        '<p class="muted">Use the email and password Charl created in Supabase.</p>' +
        '<form id="cloudForm">' +
        field('Email', 'email', '', 'email', 'email') +
        field('Password', 'password', '', 'text', 'password') +
        '<button class="btn btn-block" type="submit">Sign in</button></form>',
        { title: 'APS' }
      );
    }
    var people = App.users.filter(function (u) { return u.active !== false; });
    var list = people.map(function (u) {
      return '<button type="button" class="btn btn-light btn-block" data-act="login-pick" data-id="' + esc(u.id) + '">' +
        esc(u.name) + ' · ' + esc(roleLabel(u.role)) + '</button>';
    }).join('');
    var pin = App.loginId ? '<form id="pinForm">' + field('PIN', 'pin', '', 'numeric', 'password') +
      '<button class="btn btn-block" type="submit">Open</button></form>' : '<p class="muted">Tap your name, then enter your PIN.</p>';
    return frame('<img class="logo-hero" src="icon-192.png" alt="APS"><h2>Who is using this phone?</h2>' + list + pin, { title: 'APS' });
  }

  function roleLabel(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'office') return 'Office';
    return 'Plumber';
  }

  function field(label, name, value, mode, type) {
    return '<label class="field">' + esc(label) + '<input name="' + esc(name) + '" value="' + esc(value || '') + '"' +
      (mode ? ' inputmode="' + mode + '"' : '') + (type ? ' type="' + type + '"' : '') + ' autocomplete="off"></label>';
  }

  function viewJobs() {
    var jobs = filteredJobs();
    var chips = '<div class="chips"><button type="button" class="chip' + (App.filter === 'all' ? ' on' : '') + '" data-act="filter" data-status="all">All</button>' +
      STAGES.map(function (s) {
        return '<button type="button" class="chip' + (App.filter === s[0] ? ' on' : '') + '" data-act="filter" data-status="' + s[0] + '">' + s[1] + '</button>';
      }).join('') + '</div>';
    var body = '<input class="search" id="jobSearch" placeholder="Search client, suburb, job" value="' + esc(App.search) + '">' + chips;
    if (staff()) body += '<a class="btn btn-block" href="#/edit/new">+ New job</a>';
    if (staff() && visibleJobs().length) body += moneyStrip();
    if (!visibleJobs().length) {
      body += '<div class="panel empty"><h2>No jobs yet</h2><p>Add a lead, quote it, then book it on the calendar.</p>' +
        (staff() ? '<button class="btn btn-light" type="button" data-act="example">Show an example</button>' : '') + '</div>';
    } else body += '<div id="jobList">' + jobListHtml(jobs) + '</div>';
    return frame(body, { title: 'Jobs', sub: App.user.name });
  }
  function moneyStrip() {
    var quoted = 0, owing = 0, paid = 0;
    var month = todayISO().slice(0, 7);
    App.jobs.forEach(function (j) {
      var t = totalsOf(j);
      if (!t) return;
      if (j.status === 'quoted' || j.status === 'booked' || j.status === 'progress' || j.status === 'done') quoted += t.total;
      if (j.status === 'invoiced') {
        var inv = invoiceOf(j);
        owing += (inv && inv.deposit_paid && t.bal != null) ? t.bal : t.total;
      }
      if (j.status === 'paid' && String(j.updated_at || '').slice(0, 7) === month) paid += t.total;
    });
    return '<div class="two"><div class="panel"><b class="money">' + money(quoted) + '</b><div class="muted">Open work</div></div>' +
      '<div class="panel"><b class="money">' + money(owing) + '</b><div class="muted">Invoiced, not paid</div></div></div>' +
      '<p class="muted">Paid this month ' + money(paid) + '. No VAT.</p>';
  }
  function filteredJobs() {
    var q = App.search.trim().toLowerCase();
    return visibleJobs().filter(function (j) {
      if (App.filter !== 'all' && j.status !== App.filter) return false;
      if (!q) return true;
      var hay = (j.client_name + ' ' + j.suburb + ' ' + j.title + ' ' + j.scope + ' ' + j.phone + ' ' + j.no).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function jobListHtml(jobs) {
    jobs = jobs || filteredJobs();
    if (!jobs.length) return '<p class="muted">Nothing in this list.</p>';
    return jobs.map(function (j) {
      var t = totalsOf(j);
      var when = j.start_at ? fmtWhen(j.start_at) : stageName(j.status);
      return '<a class="card st-' + esc(j.status) + '" href="#/job/' + esc(j.id) + '">' +
        '<div class="row"><span class="title">' + esc(j.client_name || 'No name') + '</span>' +
        '<span class="badge bg-' + esc(j.status) + '">' + esc(stageName(j.status)) + '</span></div>' +
        '<div class="muted">' + esc([quoteOf(j) && quoteOf(j).no, j.suburb, when, userName(j.assigned_to)].filter(Boolean).join(' · ')) + '</div>' +
        '<div>' + esc(j.title || j.scope || '') + '</div>' +
        (t ? '<div class="row"><span class="money">' + money(t.total) + '</span><span class="muted">Deposit ' + money(t.dep) + '</span></div>' : '') +
        '</a>';
    }).join('');
  }

  function jobById(id) {
    for (var i = 0; i < App.jobs.length; i++) if (App.jobs[i].id === id) return App.jobs[i];
    return null;
  }

  function viewJob(id) {
    var job = jobById(id);
    if (!job) return frame('<div class="panel"><h2>Job not found</h2><a class="btn" href="#/jobs">Back to jobs</a></div>', { title: 'Job', back: '#/jobs' });
    if (!canSee(job)) return frame('<div class="panel"><h2>This job is not on your list</h2></div>', { title: 'Job', back: '#/jobs' });
    var t = totalsOf(job);
    var q = quoteOf(job);
    var next = { lead: 'quoted', quoted: 'booked', booked: 'progress', progress: 'done', done: 'invoiced', invoiced: 'paid' }[job.status];
    var steps = '<div class="steps">' + STAGES.map(function (s) {
      var cls = s[0] === job.status ? ' on' : '';
      if (!canSet(job, s[0]) && s[0] !== job.status) return '<button type="button" disabled>' + s[1] + '</button>';
      return '<button type="button" class="' + cls + '" data-act="set-status" data-id="' + esc(job.id) + '" data-status="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    var call = job.phone ? '<a class="btn btn-light btn-block" href="tel:' + esc(job.phone.replace(/[^\d+]/g, '')) + '">Call ' + esc(job.phone) + '</a>' : '';
    var quoteBtn = '';
    if (staff()) quoteBtn = '<a class="btn btn-block" href="#/quote/' + esc(job.id) + '">' + (q ? 'Edit quote' : 'Make a quote') + '</a>';
    else if (q) quoteBtn = '<a class="btn btn-block" href="#/preview/' + esc(q.id) + '">View quote</a>';
    var invBtn = '';
    if (staff()) {
      invBtn = job.invoice_id
        ? '<a class="btn btn-block" href="#/invoice/' + esc(job.invoice_id) + '">Open invoice</a>'
        : '<button class="btn btn-block" type="button" data-act="create-invoice" data-id="' + esc(job.id) + '">Invoice this job</button>';
    }
    var way = wa(job.phone, wayText(job));
    var done = wa(job.phone, doneText(job));
    var waRow = job.phone
      ? '<a class="btn btn-wa btn-block" data-act="wa" data-id="' + esc(job.id) + '" data-kind="way" href="' + esc(way) + '">WhatsApp: on our way</a>' +
        '<a class="btn btn-wa btn-block" data-act="wa" data-id="' + esc(job.id) + '" data-kind="done" href="' + esc(done) + '">WhatsApp: job done</a>'
      : '<p class="muted">Add a phone number to send WhatsApp updates.</p>';
    var html = '<div class="panel"><div class="row"><h2>' + esc(job.client_name || 'No name') + '</h2>' +
      '<span class="badge bg-' + esc(job.status) + '">' + esc(stageName(job.status)) + '</span></div>' +
      '<p class="muted">' + esc([q && q.no, job.no, job.suburb].filter(Boolean).join(' · ')) + '</p>' +
      '<p>' + esc(job.title || '') + '</p>' +
      (job.scope ? '<p>' + esc(job.scope) + '</p>' : '') +
      (job.address ? '<p>' + esc(job.address) + '</p>' : '') +
      '<p class="muted">' + esc(fmtWhen(job.start_at) || 'No time booked') + ' · ' + esc(userName(job.assigned_to)) + '</p>' +
      (staff() && job.client_id ? '<p><a href="#/client/' + esc(job.client_id) + '">Client record</a></p>' : '') +
      call + '</div>' +
      '<div class="panel"><h3>Stage</h3>' + steps +
      (next && canSet(job, next) ? '<button class="btn btn-block" type="button" data-act="set-status" data-id="' + esc(job.id) + '" data-status="' + next + '">Move to ' + esc(stageName(next)) + '</button>' : '') +
      '</div>' +
      '<div class="panel"><h3>Quote</h3>' +
      (t ? '<p class="money">' + money(t.total) + '</p><p class="muted">Deposit ' + money(t.dep) + ' · balance ' + money(t.bal) + (q ? ' · ' + esc(q.status) : '') + '</p>' : '<p class="muted">No quote yet.</p>') +
      quoteBtn + '</div>' +
      '<div class="panel"><h3>On site</h3>' +
      '<a class="btn btn-block" href="#/card/' + esc(job.id) + '">Job card</a>' +
      '<a class="btn btn-light btn-block" href="#/calendar">Calendar</a></div>' +
      (staff() ? '<div class="panel"><h3>Invoice</h3>' + invBtn + '</div>' : '') +
      '<div class="panel"><h3>WhatsApp the client</h3>' + waRow + '</div>' +
      (staff() ? '<div class="panel noprint"><a class="btn btn-light btn-block" href="#/edit/' + esc(job.id) + '">Edit details</a>' +
        '<button class="btn btn-light btn-block" type="button" data-act="send-job" data-id="' + esc(job.id) + '">Send to another phone</button>' +
        '<button class="btn btn-danger btn-block" type="button" data-act="delete-job" data-id="' + esc(job.id) + '">Delete job</button></div>' : '');
    return frame(html, { title: 'Job', back: '#/jobs', sub: job.no });
  }

  function wayText(job) {
    var when = job.start_at ? ' Booked for ' + fmtWhen(job.start_at) + '.' : '';
    return 'Hi ' + (job.client_name || 'there') + ', this is ' + APS.name + '. We are on our way.' + when + ' Charl · ' + APS.phone;
  }
  function doneText(job) {
    return 'Hi ' + (job.client_name || 'there') + ', your plumbing job is done' + (job.title ? ' (' + job.title + ')' : '') + '. Thank you. Charl · ' + APS.phone;
  }

  function viewEdit(id) {
    var pref = '';
    if (String(id).indexOf('new/') === 0) { pref = id.slice(4); id = 'new'; }
    var job = id === 'new' ? {
      id: '', client_name: '', phone: '', email: '', address: '', suburb: '', title: '', scope: '', notes: '',
      assigned_to: '', start_at: '', end_at: '', status: 'lead', client_id: '', site_id: ''
    } : jobById(id);
    if (!job) return frame('<div class="panel">Job not found.</div>', { title: 'Edit', back: '#/jobs' });
    if (id !== 'new' && !staff()) return frame('<div class="panel">The office edits job details.</div>', { title: 'Edit', back: '#/job/' + id });
    if (id === 'new' && pref) {
      var prefClient = App.clients.filter(function (c) { return c.id === pref; })[0];
      if (prefClient) {
        job.client_id = prefClient.id;
        job.client_name = prefClient.name;
        job.phone = prefClient.phone || '';
        job.email = prefClient.email || '';
      }
    }
    var opts = '<option value="">Unassigned</option>' + team().map(function (u) {
      return '<option value="' + esc(u.id) + '"' + (u.id === job.assigned_to ? ' selected' : '') + '>' + esc(u.name) + ' · ' + esc(roleLabel(u.role)) + '</option>';
    }).join('');
    var clientOpts = '<option value="">Type a name below</option>' + App.clients.slice().sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    }).map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === job.client_id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var sites = App.sites.filter(function (s) { return s.client_id === job.client_id; });
    var siteOpts = '<option value="">No saved site</option>' + sites.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === job.site_id ? ' selected' : '') + '>' + esc((s.label || 'Site') + (s.suburb ? ' · ' + s.suburb : '')) + '</option>';
    }).join('');
    return frame('<form id="jobForm"><input type="hidden" name="id" value="' + esc(job.id) + '">' +
      '<label class="field">Saved client<select name="client_id">' + clientOpts + '</select></label>' +
      '<p class="muted">Pick a saved client, or type a name. A client record is created if the name is new.</p>' +
      field('Client name', 'client_name', job.client_name) +
      '<label class="field">Site<select name="site_id">' + siteOpts + '</select></label>' +
      '<div class="two">' + field('Phone', 'phone', job.phone, 'tel') + field('Email', 'email', job.email, 'email', 'email') + '</div>' +
      '<div class="two">' + field('Suburb', 'suburb', job.suburb) + field('Job title', 'title', job.title) + '</div>' +
      field('Address', 'address', job.address) +
      '<label class="field">Scope<textarea name="scope">' + esc(job.scope || '') + '</textarea></label>' +
      '<label class="field">Assign<select name="assigned_to">' + opts + '</select></label>' +
      '<div class="two">' + field('Start', 'start_at', toLocal(job.start_at), '', 'datetime-local') +
      field('End', 'end_at', toLocal(job.end_at), '', 'datetime-local') + '</div>' +
      '<label class="field">Notes (not sent to the client)<textarea name="notes">' + esc(job.notes || '') + '</textarea></label>' +
      '<button class="btn btn-block" type="submit">Save job</button></form>',
      { title: id === 'new' ? 'New job' : 'Edit job', back: id === 'new' ? '#/jobs' : '#/job/' + id });
  }

  function viewCalendar() {
    var day = App.day || todayISO();
    App.day = day;
    var days = weekDays(day);
    var head = '<div class="row"><button class="btn btn-light" type="button" data-act="shift" data-d="-7">‹</button>' +
      '<strong>' + esc(fmtDay(days[0])) + ' – ' + esc(fmtDay(days[6])) + '</strong>' +
      '<button class="btn btn-light" type="button" data-act="shift" data-d="7">›</button></div>' +
      '<button class="btn btn-light btn-block" type="button" data-act="today">Today</button>';
    var grid = '<div class="week">' + days.map(function (k) {
      var d = parseDay(k);
      var n = visibleJobs().filter(function (j) { return j.start_at && dayKey(new Date(j.start_at)) === k; }).length;
      return '<button type="button" class="' + (k === day ? 'on' : '') + '" data-act="pick-day" data-day="' + k + '">' +
        d.toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2) + '<small>' + d.getDate() + (n ? ' · ' + n : '') + '</small></button>';
    }).join('') + '</div>';
    var list = visibleJobs().filter(function (j) { return j.start_at && dayKey(new Date(j.start_at)) === day; })
      .sort(function (a, b) { return String(a.start_at).localeCompare(String(b.start_at)); });
    var rows = list.length ? list.map(function (j) {
      return '<a class="card st-' + esc(j.status) + '" href="#/job/' + esc(j.id) + '"><span class="title">' + esc(j.client_name) + '</span>' +
        '<div class="muted">' + esc(fmtWhen(j.start_at)) + ' · ' + esc(userName(j.assigned_to)) + '</div>' +
        '<div>' + esc(j.title || '') + '</div></a>';
    }).join('') : '<div class="panel empty">Nothing booked on this day.</div>';
    var loose = '';
    if (staff()) {
      var pending = App.jobs.filter(function (j) { return !j.start_at && j.status !== 'paid' && j.status !== 'lead'; });
      if (pending.length) {
        loose = '<h3>No time yet</h3>' + pending.slice(0, 8).map(function (j) {
          return '<a class="card st-' + esc(j.status) + '" href="#/job/' + esc(j.id) + '">' + esc(j.client_name) + ' · ' + esc(stageName(j.status)) + '</a>';
        }).join('');
      }
    }
    var book = '';
    if (staff()) {
      book = '<button class="btn btn-block" type="button" data-act="book-open">Book a job</button>';
      if (App.book) book += bookForm();
    }
    return frame(head + grid + book + rows + loose, { title: 'Calendar', back: '#/jobs' });
  }
  function bookForm() {
    var b = App.book;
    var opts = '<option value="">Choose a job</option>' + visibleJobs().filter(function (j) { return j.status !== 'paid'; }).map(function (j) {
      return '<option value="' + esc(j.id) + '"' + (j.id === b.job_id ? ' selected' : '') + '>' + esc(j.client_name || j.no) + ' · ' + esc(stageName(j.status)) + '</option>';
    }).join('');
    var people = '<option value="">Unassigned</option>' + team().map(function (u) {
      return '<option value="' + esc(u.id) + '"' + (u.id === b.assigned_to ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('');
    return '<form id="bookForm" class="panel"><h3>Book ' + esc(fmtDay(b.day)) + '</h3>' +
      '<label class="field">Existing job<select name="job_id">' + opts + '</select></label>' +
      '<p class="muted">Or type a new one</p>' +
      field('Client name', 'client_name', b.client_name || '') +
      field('Phone', 'phone', b.phone || '', 'tel') +
      field('Job title', 'title', b.title || '') +
      '<div class="two">' + field('Start', 'start', b.start || '08:00', '', 'time') + field('End', 'end', b.end || '09:00', '', 'time') + '</div>' +
      '<label class="field">Plumber<select name="assigned_to">' + people + '</select></label>' +
      '<button class="btn btn-block" type="submit">Save booking</button>' +
      '<button class="btn btn-light btn-block" type="button" data-act="book-cancel">Cancel</button></form>';
  }

  function viewQuote(jobId) {
    var job = jobById(jobId);
    if (!job || !staff()) return frame('<div class="panel">Open this from a job.</div>', { title: 'Quote', back: '#/jobs' });
    var q = job.quote_id && App.quotes[job.quote_id];
    if (!App.draft || App.draft.job_id !== job.id) {
      App.draft = q ? Object.assign({ items: q.items || [] }, q) : blankQuote(job);
    }
    q = App.draft;
    var t = R.totals(q);
    var quick = '<div class="chips">' + R.QUICK.map(function (pair, i) {
      var jobLine = R.BYNAME[pair[1]];
      return '<button type="button" class="chip" data-act="add-quick" data-i="' + i + '">' + esc(pair[0]) + (jobLine ? ' ' + money(jobLine.l) : '') + '</button>';
    }).join('') + '</div>';
    var lines = (q.items || []).map(function (line) {
      var label = line.kind === 'material' ? (line.generic || line.name) : line.name;
      return '<div class="line"><div class="grow"><b>' + esc(label) + '</b><span class="muted">' +
        (line.kind === 'material' ? 'Material · sell ' : '') + money(line.each) + ' each</span></div>' +
        '<div class="qty"><button type="button" data-act="qty" data-id="' + esc(line.id) + '" data-d="-1">−</button><span>' + esc(String(line.qty)) + '</span>' +
        '<button type="button" data-act="qty" data-id="' + esc(line.id) + '" data-d="1">+</button></div>' +
        '<button type="button" class="btn btn-light" data-act="del-line" data-id="' + esc(line.id) + '">✕</button></div>';
    }).join('') || '<p class="muted">Nothing added yet.</p>';
    var pct = R.RATES.markup[q.tier === 'low' ? 'low' : 'high'];
    var html = '<p class="warn">Rates: R585/h · call-out R585 (first 30 min) · after-hours R880/h · minimum R1,080 · crew day R4,320 · point R1,800 · CoC R765. No VAT.</p>' +
      '<div class="panel"><h3>Quick add</h3>' + quick +
      '<p class="muted">A point is strip-out R270 + first fix R900 + second fix R630. The client sees generic names and totals only.</p>' +
      '<input class="search" id="labSearch" placeholder="Search labour, e.g. geyser, tap">' +
      '<div id="labHits"></div></div>' +
      '<div class="panel"><h3>On this quote</h3>' + lines + '</div>' +
      '<div class="panel"><h3>Materials</h3>' +
      '<label class="field">Client sees this name<input id="matName" placeholder="e.g. 150 L geyser"></label>' +
      '<div class="two"><label class="field">Cost price R<input id="matCost" inputmode="decimal" placeholder="0"></label>' +
      '<label class="field">Qty<input id="matQty" inputmode="decimal" value="1"></label></div>' +
      '<label class="field">Markup<select id="matCls"><option value="f">Fitting +' + pct.f + '%</option><option value="p">Pipe +' + pct.p + '%</option><option value="e">Expensive item +' + pct.e + '%</option></select></label>' +
      '<p id="matSell" class="muted"></p><button class="btn btn-block" type="button" data-act="add-mat">Add material</button>' +
      '<label class="field">Or search the Plumblink list<input id="matSearch" placeholder="valve, geyser, 22mm"></label>' +
      '<div id="matHits"></div>' +
      '<label class="field">Extra materials total, sell price, if you are not listing them<input id="matTyped" inputmode="decimal" value="' + esc(q.mat_typed || '') + '"></label>' +
      '<label class="field">Markup tier<select id="tier"><option value="high"' + (q.tier !== 'low' ? ' selected' : '') + '>High 25 / 35 / 45</option><option value="low"' + (q.tier === 'low' ? ' selected' : '') + '>Low 20 / 30 / 40</option></select></label>' +
      '<label class="check"><input id="consTick" type="checkbox"' + (q.cons !== false ? ' checked' : '') + '> 5% consumables on materials only</label>' +
      '<label class="check"><input id="ahTick" type="checkbox"' + (q.ah ? ' checked' : '') + '> After-hours tick (+50% on these labour lines). Leave this off if you used the After-hours R880 button.</label>' +
      '</div>' +
      '<div class="panel" id="totals">' + totalsHtml(t) + '</div>' +
      '<label class="field">Not included<textarea id="notInc">' + esc(q.not_included || NOT_INCL) + '</textarea></label>' +
      '<button class="btn btn-block" type="button" data-act="save-quote">Save quote</button>' +
      '<a class="btn btn-light btn-block" href="#/preview/' + esc(q.id) + '">Client view</a>' +
      '<button class="btn btn-light btn-block" type="button" data-act="copy-link">Copy approval link</button>' +
      quoteWaButton(job, q);
    return frame(html, { title: 'Quote ' + (q.no || ''), back: '#/job/' + job.id, sub: job.client_name });
  }
  function blankQuote(job) {
    return {
      id: DB.uid(), no: nextNo('APS-Q-'), job_id: job.id, items: [], ah: false, cons: true, tier: 'high',
      mat_typed: 0, not_included: NOT_INCL, date: todayISO(), valid_days: 14, status: 'draft',
      approval_token: DB.token(), created_by: App.user.id
    };
  }
  function totalsHtml(t) {
    return '<table class="sum"><tr><td>Labour</td><td>' + money(t.labour) + '</td></tr>' +
      '<tr><td>' + (t.co === R.RATES.ahMin ? 'After-hours call-out' : 'Call-out') + '</td><td>' + money(t.co) + '</td></tr>' +
      '<tr><td>After-hours labour</td><td>' + money(t.ah) + '</td></tr>' +
      '<tr><td>Materials</td><td>' + money(t.mat) + '</td></tr>' +
      '<tr><td>Consumables 5%</td><td>' + money(t.cons) + '</td></tr>' +
      '<tr class="tot"><td>Total</td><td>' + money(t.total) + '</td></tr>' +
      '<tr><td>80% deposit</td><td>' + money(t.dep) + '</td></tr>' +
      '<tr><td>Balance</td><td>' + money(t.bal) + '</td></tr></table>' +
      '<p class="muted">APS is not VAT-registered. No VAT is added.</p>';
  }
  function paintTotals() {
    var box = $('totals');
    if (!box || !App.draft) return;
    box.innerHTML = totalsHtml(R.totals(App.draft));
  }
  function paintLabour(q) {
    var box = $('labHits');
    if (!box) return;
    var words = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) { box.innerHTML = ''; return; }
    var list = R.CATALOGUE.filter(function (j) {
      var hay = (j.j + ' ' + j.c).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }).slice(0, 30);
    box.innerHTML = list.map(function (j) {
      return '<div class="hit"><div class="grow"><b>' + esc(j.j) + '</b><span class="muted">' + esc(j.c) + ' · ' + esc(j.co || '') + '</span></div>' +
        '<span class="money">' + money(j.l) + '</span>' +
        '<button type="button" data-act="add-labour" data-name="' + encodeURIComponent(j.j) + '">+</button></div>';
    }).join('') || '<p class="muted">No matching labour.</p>';
  }

  function buildPublic(q, job) {
    var t = R.totals(q);
    job = job || {};
    return {
      v: 1, id: q.id, t: q.approval_token, no: q.no, date: q.date || todayISO(), valid_days: 14,
      client: job.client_name || '', phone: job.phone || '', email: job.email || '',
      addr: [job.address, job.suburb].filter(Boolean).join(', '),
      title: job.title || job.scope || 'Plumbing work',
      scope: R.scopeLines(q),
      mat: t.mat, cons: t.cons, labour: t.labourAll, total: t.total, dep: t.dep, bal: t.bal,
      labour_label: R.labourLabel(t),
      not_included: q.not_included || NOT_INCL,
      status: q.status || 'draft'
    };
  }
  function approvalUrl(pub) {
    return location.origin + location.pathname + '#/a/' + b64e(pub);
  }
  function quoteText(pub, link) {
    return [
      APS.name,
      'Quote ' + pub.no + (pub.client ? ' for ' + pub.client : ''),
      pub.title || 'Plumbing work',
      pub.scope && pub.scope.length ? pub.scope.map(function (l) { return '• ' + l; }).join('\n') : '',
      'Total: ' + money(pub.total),
      '80% deposit to book: ' + money(pub.dep),
      'Balance on completion: ' + money(pub.bal),
      'Valid 14 days. Not VAT-registered.',
      'Approve here: ' + link,
      'Charl · ' + APS.phone
    ].filter(Boolean).join('\n');
  }
  function quoteWaButton(job, q) {
    var pub = buildPublic(q, job);
    var link = approvalUrl(pub);
    var href = wa(job.phone, quoteText(pub, link));
    if (!href) return '<p class="muted">Add the client phone on the job to WhatsApp the quote.</p>';
    return '<a class="btn btn-wa btn-block" data-act="wa-quote" href="' + esc(href) + '">WhatsApp quote</a>';
  }

  function paper(pub, extra) {
    var isInv = pub.kind === 'invoice';
    var when = '';
    if (!isInv && pub.date) {
      var d = parseDay(pub.date);
      d.setDate(d.getDate() + 14);
      when = 'Valid until ' + d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    var scope = (pub.scope || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') || '<li>Plumbing work as discussed</li>';
    var foot = isInv
      ? 'Balance is due on completion. APS is not VAT-registered. No bank details are on this invoice. '
      : 'Quote valid 14 days. 80% deposit books the job and buys materials. Balance on completion. A cancellation within 24 hours may be charged. ';
    var notInc = isInv ? '' : '<div class="kicker">NOT INCLUDED</div><p>' + esc(pub.not_included || NOT_INCL) + '</p>';
    return '<article class="paper"><header><img src="icon-192.png" alt="APS"><div><div class="kicker">APS</div><strong>' + esc(APS.name) + '</strong>' +
      '<div class="muted">' + esc(APS.phone) + '<br>' + esc(APS.email) + '<br>Not VAT-registered</div></div></header>' +
      '<h2>' + esc(isInv ? 'INVOICE' : 'QUOTATION') + '</h2>' +
      '<p class="muted">' + esc(pub.no || '') + (pub.date ? ' · ' + esc(pub.date) : '') + (when ? '<br>' + esc(when) : '') + '</p>' +
      '<p><strong>' + esc(pub.client || 'Client') + '</strong><br>' + esc(pub.addr || '') + '</p>' +
      '<p><strong>' + esc(pub.title || 'Plumbing work') + '</strong></p>' +
      '<div class="kicker">SCOPE</div><ul class="clean">' + scope + '</ul>' +
      '<table class="sum">' +
      (pub.mat ? '<tr><td>Materials</td><td>' + money(pub.mat) + '</td></tr>' : '') +
      (pub.cons ? '<tr><td>Consumables (5%)</td><td>' + money(pub.cons) + '</td></tr>' : '') +
      '<tr><td>' + esc(pub.labour_label || 'Labour') + '</td><td>' + money(pub.labour || 0) + '</td></tr>' +
      '<tr class="tot"><td>TOTAL</td><td>' + money(pub.total || 0) + '</td></tr></table>' +
      '<div class="depbox"><strong>80% deposit to book: ' + money(pub.dep || 0) + '</strong><br>Balance on completion: ' + money(pub.bal || 0) + '</div>' +
      '<p class="muted">APS is not VAT-registered. No VAT is charged.</p>' +
      notInc +
      '<p class="muted">' + esc(foot) + esc(APS.name) + ' · ' + esc(APS.phone) + '</p>' + (extra || '') + '</article>';
  }

  function viewPreview(id) {
    var q = App.quotes[id] || (App.draft && App.draft.id === id ? App.draft : null);
    if (!q) return frame('<div class="panel">Quote not on this phone.</div>', { title: 'Quote', back: '#/jobs' });
    var job = jobById(q.job_id) || {};
    var pub = buildPublic(q, job);
    var link = approvalUrl(pub);
    var href = wa(job.phone || pub.phone, quoteText(pub, link));
    var back = staff() ? '#/quote/' + q.job_id : '#/job/' + q.job_id;
    var tools = '<div class="noprint"><button class="btn btn-block" type="button" data-act="copy-link" data-id="' + esc(q.id) + '">Copy approval link</button>' +
      (href ? '<a class="btn btn-wa btn-block" data-act="wa-quote" href="' + esc(href) + '">WhatsApp quote</a>' : '') +
      '<button class="btn btn-block" type="button" data-act="pdf" data-kind="quote" data-id="' + esc(q.id) + '">Download PDF</button>' +
      '<button class="btn btn-wa btn-block" type="button" data-act="pdf-share" data-kind="quote" data-id="' + esc(q.id) + '">Share PDF</button>' +
      '<button class="btn btn-light btn-block" type="button" data-act="print">Print</button>' +
      (staff() && q.status !== 'approved' ? '<button class="btn btn-light btn-block" type="button" data-act="mark" data-id="' + esc(q.id) + '" data-status="approved">Mark approved</button>' : '') +
      '<p class="muted">Status: ' + esc(q.status || 'draft') + '</p></div>';
    return frame(paper(pub) + tools, { title: 'Client view', back: back });
  }

  function viewApprove(token) {
    var pub = null;
    var remoteNote = '';
    if (token && token.length > 40) {
      try { pub = b64d(token); } catch (e) { pub = null; }
    }
    var pending = !pub && token;
    var body = pub ? approveBody(pub, remoteNote) : (pending ? '<div class="panel">Checking this quote…</div>' : '<div class="panel"><h2>This link is not an APS quote.</h2></div>');
    var html = frame(body, { bare: true });
    if (pub && pub.t) {
      var seq = drawSeq;
      DB.all('quotes').then(function (rows) {
        if (seq !== drawSeq) return;
        var local = null;
        (rows || []).forEach(function (q) { if (q.approval_token === pub.t) local = q; });
        if (!local || (local.status !== 'approved' && local.status !== 'declined') || pub.status === local.status) return;
        pub.status = local.status;
        var box = $('app');
        if (box) box.innerHTML = frame(approveBody(pub), { bare: true });
      });
    }
    if (pending) {
      APSSync.fetchQuote(token).then(function (row) {
        var box = $('app');
        if (!box) return;
        if (row && row.public) {
          row.public.status = row.status;
          box.innerHTML = frame(approveBody(row.public, ''), { bare: true });
        } else box.innerHTML = frame('<div class="panel"><h2>Quote not found.</h2><p>Ask APS to send the link again.</p></div>', { bare: true });
      });
    }
    return html;
  }
  function approveBody(pub) {
    var decided = pub.status === 'approved' || pub.status === 'declined';
    var buttons = decided ? '<p class="depbox">This quote is already ' + esc(pub.status) + '.</p>' :
      '<div class="noprint"><button class="btn btn-block" type="button" data-act="client-decide" data-decision="approved" data-token="' + esc(pub.t || '') + '">I approve this quote</button>' +
      '<button class="btn btn-light btn-block" type="button" data-act="client-decide" data-decision="declined" data-token="' + esc(pub.t || '') + '">I decline</button></div>';
    var tell = wa(APS.wa, 'I ' + (pub.status === 'declined' ? 'decline' : 'approve') + ' quote ' + (pub.no || '') + '. Total ' + money(pub.total) + '. Deposit ' + money(pub.dep) + '. ' + (pub.client || ''));
    return '<div class="panel" style="margin:12px"><img class="logo" src="icon-192.png" alt="APS"></div>' + paper(pub) + buttons +
      '<a class="btn btn-wa btn-block noprint" id="tellAps" data-no="' + esc(pub.no || '') + '" data-total="' + esc(pub.total || 0) + '" data-dep="' + esc(pub.dep || 0) + '" data-client="' + esc(pub.client || '') + '" href="' + esc(tell) + '">Tell APS on WhatsApp</a>' +
      '<div id="decideNote"></div>';
  }

  function viewCard(jobId) {
    var job = jobById(jobId);
    if (!job || !canSee(job)) return frame('<div class="panel">Job card is not available.</div>', { title: 'Job card', back: '#/jobs' });
    return DB.get('cards', job.id).then(function (card) {
      if (!card) card = { id: job.id, job_id: job.id, notes: '', signature: '', signed_name: '', signed_at: null, elapsed_ms: 0, running_since: null };
      App.liveCard = card;
      App.signDirty = false;
      return DB.all('photos').then(function (photos) {
        var mine = (photos || []).filter(function (p) { return p.job_id === job.id; });
        var figs = mine.map(function (p) {
          var url = URL.createObjectURL(p.blob);
          photoUrls.push(url);
          return '<figure><img src="' + url + '" alt="Job photo"><button class="btn btn-light btn-block" type="button" data-act="del-photo" data-id="' + esc(p.id) + '">Remove</button></figure>';
        }).join('');
        var running = !!card.running_since;
        var head = '<div class="panel"><h2>' + esc(job.client_name || 'Job card') + '</h2><p>' + esc(job.title || job.scope || '') + '</p>' +
          '<div class="timer" id="timerRead">' + fmtDur(cardElapsed(card)) + '</div>' +
          (running
            ? '<button class="btn btn-block" type="button" data-act="stop-timer" data-id="' + esc(job.id) + '">Stop timer</button>'
            : '<button class="btn btn-block" type="button" data-act="start-timer" data-id="' + esc(job.id) + '">Start timer</button>') +
          '</div>' +
          '<div class="panel"><h3>Photos</h3><div class="photos">' + figs + '</div>' +
          '<label class="btn btn-block filebtn">Add photo<input id="photoIn" type="file" accept="image/*" capture="environment"></label></div>' +
          '<div class="panel"><h3>Client signature</h3><div class="signwrap"><canvas id="sign"></canvas></div>' +
          field('Signed by', 'signed_name', card.signed_name || job.client_name || '') +
          '<button class="btn btn-light btn-block" type="button" data-act="clear-sign">Clear signature</button></div>';
        var extra = window.APSOffice ? APSOffice.cardExtra(job) : Promise.resolve('');
        return extra.then(function (more) {
          return frame(
            head + more +
            '<label class="field">Notes<textarea id="cardNotes">' + esc(card.notes || '') + '</textarea></label>' +
            '<button class="btn btn-block" type="button" data-act="save-card" data-id="' + esc(job.id) + '">Save job card</button>' +
            (canSet(job, 'done') ? '<button class="btn btn-light btn-block" type="button" data-act="set-status" data-id="' + esc(job.id) + '" data-status="done">Mark job done</button>' : ''),
            { title: 'Job card', back: '#/job/' + job.id }
          );
        });
      });
    });
  }
  function cardElapsed(card) {
    var ms = card.elapsed_ms || 0;
    if (card.running_since) ms += Date.now() - new Date(card.running_since).getTime();
    return Math.max(0, ms);
  }
  function bindSign(canvas) {
    var wrap = canvas.parentElement;
    var w = wrap.clientWidth || 320;
    var h = 180;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.strokeStyle = '#0C1F3D';
    if (App.liveCard && App.liveCard.signature) {
      var img = new Image();
      img.onload = function () { g.drawImage(img, 0, 0, w, h); };
      img.src = App.liveCard.signature;
    }
    var drawing = false;
    var last = null;
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e);
      g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke();
      last = p; e.preventDefault();
    });
    canvas.addEventListener('pointerup', function () {
      drawing = false;
      if (!last) return;
      App.signDirty = true;
      if (App.liveCard) App.liveCard.signature = canvas.toDataURL('image/png');
    });
  }
  function revokePhotos() {
    photoUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    photoUrls = [];
  }

  function viewInvoice(id) {
    var inv = App.invoices[id];
    if (!inv || !staff()) return frame('<div class="panel">Invoice not on this phone.</div>', { title: 'Invoice', back: '#/invoices' });
    var job = jobById(inv.job_id) || {};
    var pub = {
      kind: 'invoice', no: inv.no, date: inv.date, client: inv.client_name || job.client_name, addr: inv.addr || '',
      title: inv.title || job.title, scope: inv.scope || [], mat: inv.totals.mat, cons: inv.totals.cons,
      labour: inv.totals.labourAll != null ? inv.totals.labourAll : inv.totals.labour, total: inv.totals.total,
      dep: inv.totals.dep, bal: inv.totals.bal, labour_label: inv.labour_label || 'Labour', not_included: ''
    };
    var href = payHref(inv.pay_link);
    var extra = href ? '<a class="btn btn-block" href="' + esc(href) + '">Pay now</a>' : '<p class="muted">No payment link yet.</p>';
    var msg = invoiceText(inv, job, href);
    var waHref = wa(job.phone, msg);
    return frame(paper(pub, extra) +
      '<form id="invForm" class="noprint"><input type="hidden" name="id" value="' + esc(inv.id) + '">' +
      '<label class="field">Yoco or PayFast link<textarea name="pay_link" placeholder="https://">' + esc(inv.pay_link || '') + '</textarea></label>' +
      '<button class="btn btn-block" type="submit">Save link</button></form>' +
      '<div class="noprint">' +
      (waHref ? '<a class="btn btn-wa btn-block" href="' + esc(waHref) + '">WhatsApp invoice</a>' : '') +
      '<button class="btn btn-block" type="button" data-act="pdf" data-kind="invoice" data-id="' + esc(inv.id) + '">Download PDF</button>' +
      '<button class="btn btn-wa btn-block" type="button" data-act="pdf-share" data-kind="invoice" data-id="' + esc(inv.id) + '">Share PDF</button>' +
      '<button class="btn btn-light btn-block" type="button" data-act="mark-deposit" data-id="' + esc(inv.id) + '">' + (inv.deposit_paid ? 'Deposit received' : 'Mark deposit received') + '</button>' +
      '<button class="btn btn-block" type="button" data-act="mark-paid" data-id="' + esc(inv.id) + '">Mark paid</button>' +
      '<button class="btn btn-light btn-block" type="button" data-act="print">Print</button></div>',
      { title: 'Invoice', back: '#/job/' + inv.job_id, sub: inv.no });
  }
  function invoiceText(inv, job, href) {
    var lines = [
      APS.name, 'Invoice ' + inv.no, 'For: ' + (inv.client_name || job.client_name || ''),
      inv.title || '', 'Total: ' + money(inv.totals.total),
      '80% deposit: ' + money(inv.totals.dep), 'Balance: ' + money(inv.totals.bal),
      inv.deposit_paid ? 'Deposit received.' : '',
      href ? 'Pay: ' + href : '',
      'APS is not VAT-registered.', 'Charl · ' + APS.phone
    ];
    return lines.filter(Boolean).join('\n');
  }
  function viewInvoices() {
    if (!staff()) return frame('<div class="panel">Invoices are for the office.</div>', { title: 'Invoices', back: '#/jobs' });
    var list = Object.keys(App.invoices).map(function (k) { return App.invoices[k]; })
      .sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); });
    var html = list.length ? list.map(function (inv) {
      return '<a class="card st-' + (inv.status === 'paid' ? 'paid' : 'invoiced') + '" href="#/invoice/' + esc(inv.id) + '">' +
        '<span class="title">' + esc(inv.client_name || inv.no) + '</span><div class="muted">' + esc(inv.no) + ' · ' + esc(inv.status) + '</div>' +
        '<div class="money">' + money(inv.totals && inv.totals.total) + '</div></a>';
    }).join('') : '<div class="panel empty"><h2>No invoices yet</h2><p>Open a job with an approved quote and tap Invoice this job.</p></div>';
    return frame(html, { title: 'Invoices', back: '#/jobs' });
  }

  function viewTeam() {
    if (!isOwner() && !APSSync.configured()) return frame('<div class="panel">Only the owner adds people.</div>', { title: 'Team', back: '#/more' });
    var rows = team().map(function (u) {
      return '<div class="line"><div class="grow"><b>' + esc(u.name) + '</b><span class="muted">' + esc(roleLabel(u.role)) + (u.phone ? ' · ' + esc(u.phone) : '') + '</span></div>' +
        (isOwner() && !APSSync.configured() && u.id !== App.user.id ? '<button class="btn btn-light" type="button" data-act="deactivate" data-id="' + esc(u.id) + '">Remove</button>' : '') +
        '</div>';
    }).join('');
    var form = '';
    if (APSSync.configured()) {
      form = '<p class="warn">Logins are created in Supabase. Follow SETUP.md, then they appear here. Assign them on the job.</p>';
    } else if (isOwner()) {
      form = '<form id="userForm"><h3>Add a person</h3>' + field('Name', 'name', '') + field('Phone', 'phone', '', 'tel') +
        '<label class="field">Role<select name="role"><option value="plumber">Plumber</option><option value="office">Office</option><option value="owner">Owner (admin)</option></select></label>' +
        field('PIN', 'pin', '', 'numeric', 'password') +
        '<button class="btn btn-block" type="submit">Add</button></form>';
    }
    return frame('<div class="panel">' + rows + '</div>' + form, { title: 'Team', back: '#/more' });
  }

  function viewMore() {
    var syncBtn = APSSync.configured()
      ? '<button class="btn btn-block" type="button" data-act="upload-sync">Upload this phone to Supabase</button><button class="btn btn-light btn-block" type="button" data-act="pull-sync">Fetch latest</button><p class="muted" id="syncErr"></p>'
      : '<p class="warn">Saved on this phone only. To share live between the office phone and the plumbers’ phones, connect the free Supabase project. The steps are in SETUP.md in this folder.</p>';
    DB.get('meta', 'sync_error').then(function (err) {
      var el = $('syncErr');
      if (el && err && err.message) el.textContent = err.message;
    });
    var officeLinks = staff()
      ? '<a class="btn btn-block" href="#/dashboard">Dashboard</a><a class="btn btn-block" href="#/board">Pipeline</a>' +
        '<a class="btn btn-block" href="#/clients">Clients</a><a class="btn btn-block" href="#/stock">Stock</a>' +
        '<a class="btn btn-block" href="#/map">Map</a><a class="btn btn-block" href="#/reports">Reports</a>'
      : '<a class="btn btn-block" href="#/map">Map</a><a class="btn btn-block" href="#/stock">Van stock</a>';
    var demoBtn = staff()
      ? '<button class="btn btn-light btn-block" type="button" data-act="demo-toggle">' + (App.demoOn ? 'Hide demo company' : 'Show demo company') + '</button>' +
        '<p class="muted">Sample West Rand jobs, clients and stock. Hide the demo before you upload this phone if you do not want those samples in Supabase.</p>'
      : '';
    return frame(
      '<div class="panel"><h2>' + esc(App.user.name) + '</h2><p class="muted">' + esc(roleLabel(App.user.role)) + '</p>' +
      '<button class="btn btn-light btn-block" type="button" data-act="logout">Log out</button></div>' +
      officeLinks + demoBtn +
      (isOwner() || APSSync.configured() ? '<a class="btn btn-block" href="#/team">Team</a>' : '') +
      '<div class="panel"><h3>This phone</h3>' + syncBtn +
      '<button class="btn btn-light btn-block" type="button" data-act="export">Save a backup file</button>' +
      '<label class="btn btn-light btn-block filebtn">Load a backup or job file<input id="importFile" type="file" accept="application/json,.json"></label>' +
      '<p class="muted">To install: in Chrome tap the menu, then Add to Home screen. It then opens like an app and still works with no signal.</p></div>' +
      '<div class="panel"><h3>APS</h3><p>' + esc(APS.name) + '<br>' + esc(APS.phone) + '<br>WhatsApp ' + esc(APS.wa) + '<br>' + esc(APS.email) + '</p>' +
      '<p class="muted">Pipeline: Lead, Quoted, Booked, In progress, Done, Invoiced, Paid. Quotes use the Quote Finale rate book (10% off). No VAT. No bank details. Deposit 80%. Consumables are 5% of materials only.</p></div>',
      { title: 'More' }
    );
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'wa' || act === 'wa-quote') {
      if (act === 'wa') logWa(el.dataset.id, el.dataset.kind);
      if (act === 'wa-quote' && App.draft) markSent();
      return;
    }
    if (el.tagName === 'A' && el.getAttribute('href') && act !== 'go') return;
    e.preventDefault();
    Promise.resolve(handle(act, el)).catch(function (err) {
      toast(err && err.message ? err.message : 'Something went wrong');
    });
  }
  function onSubmit(e) {
    var id = e.target && e.target.getAttribute && e.target.getAttribute('id');
    if (!id) return;
    e.preventDefault();
    if (window.APSOffice && APSOffice.form(id, e.target)) return;
    var map = { setupForm: saveSetup, pinForm: savePin, cloudForm: saveCloud, jobForm: saveJob, bookForm: saveBook, userForm: saveUser, invForm: saveInvoice };
    if (!map[id]) return;
    var pending;
    try { pending = map[id](e.target); }
    catch (err) { toast(err.message || 'Could not save'); return; }
    Promise.resolve(pending).catch(function (err) { toast(err.message || 'Could not save'); });
  }
  function onChange(e) {
    var t = e.target;
    if (t.id === 'photoIn' && t.files && t.files[0]) { addPhoto(t.files[0]); t.value = ''; }
    if ((t.id === 'importFile' || t.id === 'setupFile') && t.files && t.files[0]) { importFile(t.files[0]); t.value = ''; }
    if (t.id === 'placePick') { App.stockPlace = t.value; draw(); return; }
    if (t.getAttribute && t.getAttribute('data-move')) { setStatus(t.getAttribute('data-move'), t.value); return; }
    if (t.name === 'client_id' && t.form && t.form.getAttribute('id') === 'jobForm') {
      var client = App.clients.filter(function (c) { return c.id === t.value; })[0];
      if (client) {
        t.form.client_name.value = client.name || '';
        t.form.phone.value = client.phone || '';
        t.form.email.value = client.email || '';
      }
      var site = t.form.elements.site_id;
      if (site) {
        var sites = App.sites.filter(function (s) { return s.client_id === t.value; });
        site.innerHTML = '<option value="">No saved site</option>' + sites.map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc((s.label || 'Site') + (s.suburb ? ' · ' + s.suburb : '')) + '</option>';
        }).join('');
      }
      return;
    }
    if (t.name === 'site_id' && t.form && t.form.getAttribute('id') === 'jobForm') {
      var picked = App.sites.filter(function (s) { return s.id === t.value; })[0];
      if (picked) {
        t.form.address.value = picked.address || '';
        t.form.suburb.value = picked.suburb || '';
      }
      return;
    }
    if (!App.draft) return;
    if (t.id === 'ahTick') { App.draft.ah = t.checked; persistQuote(false).then(paintTotals); }
    if (t.id === 'consTick') { App.draft.cons = t.checked; persistQuote(false).then(paintTotals); }
    if (t.id === 'tier') { App.draft.tier = t.value; reprice(App.draft); persistQuote(true); }
    if (t.id === 'matTyped') App.draft.mat_typed = Number(t.value) || 0;
    if (t.id === 'notInc') App.draft.not_included = t.value;
  }
  function onInput(e) {
    var t = e.target;
    if (t.id === 'jobSearch') {
      App.search = t.value;
      var box = $('jobList');
      if (box) box.innerHTML = jobListHtml();
    }
    if (t.id === 'labSearch') paintLabour(t.value);
    if (t.id === 'matSearch') searchMaterials(t.value);
    if (t.id === 'matCost' || t.id === 'matQty' || t.id === 'matCls') paintMatSell();
    if (t.id === 'matTyped' && App.draft) { App.draft.mat_typed = Number(t.value) || 0; paintTotals(); }
    if (t.id === 'notInc' && App.draft) App.draft.not_included = t.value;
    if (window.APSOffice) APSOffice.onInput(t);
  }
  function onHide() {
    if (document.visibilityState !== 'hidden' || !App.liveCard || !App.liveCard.running_since) return;
    App.liveCard.elapsed_ms = cardElapsed(App.liveCard);
    App.liveCard.running_since = new Date().toISOString();
    DB.save('cards', App.liveCard);
  }

  function handle(act, el) {
    if (window.APSOffice && APSOffice.act(act, el)) return;
    if (act === 'go') return go(el.dataset.to);
    if (act === 'login-pick') { App.loginId = el.dataset.id; return draw(); }
    if (act === 'logout') return logout();
    if (act === 'filter') { App.filter = el.dataset.status; return draw(); }
    if (act === 'example') return exampleJob();
    if (act === 'set-status') return setStatus(el.dataset.id, el.dataset.status);
    if (act === 'delete-job') return deleteJob(el.dataset.id);
    if (act === 'send-job') return sendJob(el.dataset.id);
    if (act === 'shift') { App.day = shiftDay(App.day || todayISO(), +el.dataset.d); return draw(); }
    if (act === 'today') { App.day = todayISO(); return draw(); }
    if (act === 'pick-day') { App.day = el.dataset.day; if (App.book) App.book.day = App.day; return draw(); }
    if (act === 'book-open') { App.book = { day: App.day || todayISO(), job_id: '', start: '08:00', end: '09:00', assigned_to: '' }; return draw(); }
    if (act === 'book-cancel') { App.book = null; return draw(); }
    if (act === 'add-quick') return addLabour(R.QUICK[+el.dataset.i][1]);
    if (act === 'add-labour') return addLabour(decodeURIComponent(el.dataset.name));
    if (act === 'qty') return changeQty(el.dataset.id, +el.dataset.d);
    if (act === 'del-line') return changeQty(el.dataset.id, -999);
    if (act === 'add-mat') return addTypedMaterial();
    if (act === 'add-mat-hit') return addHit(+el.dataset.i);
    if (act === 'save-quote') {
      var draft = App.draft;
      var has = draft && ((draft.items && draft.items.length) || Number(draft.mat_typed) > 0);
      if (!has) { toast('Add labour or a material first'); return; }
      return persistQuote(false).then(function () { toast('Quote saved'); go('#/job/' + App.draft.job_id); });
    }
    if (act === 'copy-link') return copyLink(el.dataset.id);
    if (act === 'print') { window.print(); return; }
    if (act === 'mark') return markQuote(el.dataset.id, el.dataset.status);
    if (act === 'client-decide') return clientDecide(el.dataset.decision, el.dataset.token);
    if (act === 'create-invoice') return createInvoice(el.dataset.id);
    if (act === 'mark-paid') return markPaid(el.dataset.id);
    if (act === 'mark-deposit') return markDeposit(el.dataset.id);
    if (act === 'start-timer') return startTimer(el.dataset.id);
    if (act === 'stop-timer') return stopTimer(el.dataset.id);
    if (act === 'save-card') return saveCard(el.dataset.id);
    if (act === 'clear-sign') return clearSign();
    if (act === 'del-photo') return DB.del('photos', el.dataset.id).then(function () { toast('Photo removed'); return draw(); });
    if (act === 'deactivate') return deactivate(el.dataset.id);
    if (act === 'export') return exportBackup();
    if (act === 'upload-sync') return uploadSync();
    if (act === 'pull-sync') return APSSync.pull().then(reload).then(draw).then(function () { toast('Fetched'); });
  }

  function saveSetup(form) {
    var name = form.name.value.trim();
    var pin = form.pin.value.trim();
    if (!name) return toast('Enter your name');
    if (!/^\d{4,}$/.test(pin)) return toast('Use a PIN of at least 4 digits');
    if (pin !== form.pin2.value.trim()) return toast('The PINs do not match');
    var user = { id: DB.uid(), name: name, role: 'owner', phone: form.phone.value.trim(), color: COLORS[0], active: true, salt: DB.uid() };
    return hashPin(pin, user.salt).then(function (hash) {
      user.pin_hash = hash;
      return DB.put('users', user);
    }).then(function () {
      App.user = publicUser(user);
      App.hasUsers = true;
      return DB.put('meta', { id: 'session', user_id: user.id });
    }).then(function () { toast('PIN saved on this phone'); land(); });
  }
  function savePin(form) {
    var pin = form.pin.value.trim();
    return DB.get('users', App.loginId).then(function (user) {
      if (!user) return toast('Choose your name again');
      return hashPin(pin, user.salt).then(function (hash) {
        if (hash !== user.pin_hash) return toast('Wrong PIN');
        App.user = publicUser(user);
        return DB.put('meta', { id: 'session', user_id: user.id }).then(function () { land(); });
      });
    });
  }
  function saveCloud(form) {
    var email = form.email.value.trim();
    var password = form.password.value;
    return APSSync.client().then(function (sb) {
      return sb.auth.signInWithPassword({ email: email, password: password });
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message || 'Sign-in failed');
      return APSSync.client().then(function (sb) {
        return sb.from('profiles').select('*').eq('id', res.data.user.id).maybeSingle();
      }).then(function (prof) {
        if (!prof.data) throw new Error('This login has no role yet. Add it in Supabase. See SETUP.md.');
        App.user = { id: prof.data.id, name: prof.data.name, role: prof.data.role, phone: prof.data.phone || '', email: email };
        return DB.put('meta', { id: 'cloud_user', user: App.user });
      });
    }).then(function () { return APSSync.kick(); }).then(function () { land(); });
  }
  function logout() {
    App.user = null;
    App.draft = null;
    var p = APSSync.configured()
      ? APSSync.client().then(function (sb) { return sb ? sb.auth.signOut() : null; }).then(function () { return DB.del('meta', 'cloud_user'); })
      : DB.del('meta', 'session');
    return p.then(function () { go('#/login'); });
  }
  function saveJob(form) {
    var id = form.elements.id.value;
    var job = id ? jobById(id) : { id: DB.uid(), no: nextNo('APS-J-'), status: 'lead', created_by: App.user.id, wa_log: [] };
    if (!job) return toast('Job not found');
    job.client_name = form.client_name.value.trim();
    if (!job.client_name) return toast('Enter the client name');
    job.phone = form.phone.value.trim();
    job.email = form.email.value.trim();
    job.address = form.address.value.trim();
    job.suburb = form.suburb.value.trim();
    job.title = form.title.value.trim();
    job.scope = form.scope.value.trim();
    job.notes = form.notes.value.trim();
    job.assigned_to = form.assigned_to.value || null;
    job.start_at = fromLocal(form.start_at.value);
    job.end_at = fromLocal(form.end_at.value);
    if (job.start_at && (job.status === 'lead' || job.status === 'quoted')) job.status = 'booked';
    var linked = window.APSOffice ? APSOffice.linkClient(job, form) : Promise.resolve();
    return linked.then(function () { return DB.save('jobs', job); }).then(reload).then(function () { toast('Saved'); go('#/job/' + job.id); });
  }
  function setStatus(id, status) {
    var job = jobById(id);
    if (!job) return;
    if (!canSet(job, status)) return toast('You cannot move it there');
    job.status = status;
    var p = DB.save('jobs', job);
    if (status === 'paid' && job.invoice_id && App.invoices[job.invoice_id]) {
      var inv = App.invoices[job.invoice_id];
      inv.status = 'paid';
      p = p.then(function () { return DB.save('invoices', inv); });
    }
    if (status === 'invoiced' && job.invoice_id && App.invoices[job.invoice_id] && App.invoices[job.invoice_id].status === 'draft') {
      App.invoices[job.invoice_id].status = 'sent';
      p = p.then(function () { return DB.save('invoices', App.invoices[job.invoice_id]); });
    }
    return p.then(reload).then(draw).then(function () { toast(stageName(status)); });
  }
  function deleteJob(id) {
    if (!staff()) return;
    if (!confirm('Delete this job from this phone?')) return;
    var job = jobById(id);
    var p = Promise.resolve();
    if (job && job.quote_id) p = p.then(function () { return DB.remove('quotes', job.quote_id); });
    if (job && job.invoice_id) p = p.then(function () { return DB.remove('invoices', job.invoice_id); });
    p = p.then(function () { return DB.remove('cards', id); });
    p = p.then(function () { return DB.remove('jobs', id); });
    return p.then(reload).then(function () { toast('Deleted'); go('#/jobs'); });
  }
  function exampleJob() {
    var job = {
      id: DB.uid(), no: nextNo('APS-J-'), status: 'lead', client_name: 'Example client (delete me)',
      phone: '', email: '', suburb: 'Krugersdorp', address: '', title: 'Replace 150 L geyser',
      scope: 'Burst geyser. Make safe and quote a replacement.', notes: 'Example only.',
      assigned_to: App.user.id, created_by: App.user.id, wa_log: []
    };
    return DB.save('jobs', job).then(reload).then(function () { go('#/job/' + job.id); });
  }
  function saveBook(form) {
    var b = App.book || { day: App.day || todayISO() };
    var start = combine(b.day, form.start.value);
    var end = combine(b.day, form.end.value);
    if (start && end && end <= start) end = new Date(new Date(start).getTime() + 3600000).toISOString();
    var id = form.job_id.value;
    var job = id ? jobById(id) : null;
    if (!job) {
      var name = form.client_name.value.trim();
      if (!name) return toast('Choose a job or type a client name');
      job = {
        id: DB.uid(), no: nextNo('APS-J-'), status: 'booked', client_name: name, phone: form.phone.value.trim(),
        email: '', address: '', suburb: '', title: form.title.value.trim(), scope: '', notes: '',
        created_by: App.user.id, wa_log: []
      };
    }
    job.start_at = start;
    job.end_at = end;
    job.assigned_to = form.assigned_to.value || job.assigned_to || null;
    if (job.status === 'lead' || job.status === 'quoted') job.status = 'booked';
    App.book = null;
    return DB.save('jobs', job).then(reload).then(draw).then(function () { toast('Booked'); });
  }

  function addLabour(name) {
    var src = R.BYNAME[name];
    if (!src || !App.draft) return;
    var found = (App.draft.items || []).filter(function (i) { return i.kind !== 'material' && i.name === src.j; })[0];
    if (found) found.qty = R.r2((+found.qty || 0) + 1);
    else App.draft.items.push({ id: DB.uid(), kind: 'labour', name: src.j, generic: R.labourGeneric(src.j), qty: 1, each: src.l, co: src.co || 'No' });
    return persistQuote(true);
  }
  function changeQty(id, d) {
    if (!App.draft) return;
    var items = App.draft.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id !== id) continue;
      items[i].qty = R.r2((+items[i].qty || 0) + d);
      if (items[i].qty <= 0) items.splice(i, 1);
      break;
    }
    return persistQuote(true);
  }
  function reprice(q) {
    (q.items || []).forEach(function (i) {
      if (i.kind === 'material' && i.cost != null) i.each = R.sell(i.cost, i.cls, q.tier);
    });
  }
  function addTypedMaterial() {
    var name = ($('matName').value || '').trim();
    var cost = Number($('matCost').value);
    var qty = Number($('matQty').value) || 1;
    var cls = $('matCls').value || 'f';
    if (!name) return toast('Type what the client should see');
    if (!(cost >= 0)) return toast('Enter the cost price');
    return pushMaterial(name, name, cost, cls, qty);
  }
  function pushMaterial(generic, supplier, cost, cls, qty) {
    App.draft.items.push({
      id: DB.uid(), kind: 'material', name: generic, generic: generic, supplier: supplier,
      qty: qty, cost: cost, cls: cls, each: R.sell(cost, cls, App.draft.tier || 'high'), co: 'No'
    });
    return persistQuote(true);
  }
  function paintMatSell() {
    var el = $('matSell');
    if (!el || !App.draft) return;
    var cost = Number($('matCost') && $('matCost').value);
    var qty = Number($('matQty') && $('matQty').value) || 1;
    var cls = $('matCls') ? $('matCls').value : 'f';
    if (!(cost >= 0) || $('matCost').value === '') { el.textContent = ''; return; }
    var each = R.sell(cost, cls, App.draft.tier || 'high');
    el.textContent = 'Client pays ' + money(R.r2(each * qty)) + ' (staff only). The quote shows the name and the materials total.';
  }
  function searchMaterials(q) {
    var box = $('matHits');
    if (!box) return;
    if (!q || q.trim().length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="muted">Searching…</p>';
    Mat.load().then(function () {
      var hits = Mat.search(q).slice(0, 12);
      App.matHits = hits;
      if (!$('matHits')) return;
      $('matHits').innerHTML = hits.length ? hits.map(function (it, i) {
        var sell = R.sell(it.cost, it.cls, (App.draft && App.draft.tier) || 'high');
        return '<div class="hit"><div class="grow"><b>' + esc(it.gen) + '</b><span class="muted">' + esc(it.code) + (it.out ? ' · supplier out' : '') + ' · cost ' + money(it.cost) + '</span></div>' +
          '<span class="money">' + money(sell) + '</span><button type="button" data-act="add-mat-hit" data-i="' + i + '">+</button></div>';
      }).join('') : '<p class="muted">No fittings matched.</p>';
    }).catch(function () {
      if ($('matHits')) $('matHits').innerHTML = '<p class="muted">The price list needs a connection the first time. You can still type a material above.</p>';
    });
  }
  function addHit(i) {
    var it = App.matHits[i];
    if (!it) return;
    return pushMaterial(it.gen, it.name, it.cost, it.cls, 1);
  }
  function persistQuote(redraw) {
    var q = App.draft;
    if (!q) return Promise.resolve();
    var fp = JSON.stringify({ items: q.items, ah: !!q.ah, cons: q.cons !== false, tier: q.tier || 'high', mat: +q.mat_typed || 0 });
    if (q.fp && q.fp !== fp && (q.status === 'approved' || q.status === 'declined' || q.status === 'sent')) {
      q.status = 'draft';
      q.approved_at = null;
      q.declined_at = null;
      q.approval_token = DB.token();
      toast('Quote changed. Send the approval link again.');
    }
    q.fp = fp;
    var job = jobById(q.job_id);
    q.public = buildPublic(q, job || {});
    return DB.save('quotes', q).then(function () {
      App.quotes[q.id] = q;
      if (!job) return;
      job.quote_id = q.id;
      if (job.status === 'lead' && ((q.items && q.items.length) || Number(q.mat_typed) > 0)) job.status = 'quoted';
      return DB.save('jobs', job);
    }).then(function () { if (redraw) return draw(); });
  }
  function copyLink(id) {
    var q = (id && App.quotes[id]) || (id && App.draft && App.draft.id === id ? App.draft : null) || App.draft;
    if (!q) return;
    var job = jobById(q.job_id) || {};
    if (q === App.draft) {
      return markSent().then(function () {
        var link = approvalUrl(buildPublic(q, job));
        return copyText(link);
      });
    }
    return copyText(approvalUrl(q.public || buildPublic(q, job)));
  }
  function markSent() {
    if (App.draft && App.draft.status === 'draft') App.draft.status = 'sent';
    return persistQuote(false);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast('Link copied'); }).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Link copied'); }
    catch (e) { toast('Copy the link from the client view'); }
    ta.remove();
  }
  function markQuote(id, status) {
    var q = App.quotes[id] || App.draft;
    if (!q || !staff()) return;
    q.status = status;
    if (status === 'approved') q.approved_at = new Date().toISOString();
    if (status === 'declined') q.declined_at = new Date().toISOString();
    App.draft = q;
    return persistQuote(true).then(function () { toast(status === 'approved' ? 'Marked approved' : 'Updated'); });
  }
  function clientDecide(decision, token) {
    var note = $('decideNote');
    var local = null;
    Object.keys(App.quotes || {}).forEach(function (k) { if (App.quotes[k].approval_token === token) local = App.quotes[k]; });
    var chain = Promise.resolve();
    if (!local) {
      chain = DB.all('quotes').then(function (rows) {
        (rows || []).forEach(function (q) { if (q.approval_token === token) local = q; });
      });
    }
    return chain.then(function () {
      if (local) {
        local.status = decision;
        if (decision === 'approved') local.approved_at = new Date().toISOString();
        else local.declined_at = new Date().toISOString();
        return DB.save('quotes', local);
      }
    }).then(function () {
      if (APSSync.configured() && token) return APSSync.decide(token, decision);
    }).then(function () {
      document.querySelectorAll('[data-act="client-decide"]').forEach(function (b) { b.hidden = true; });
      var tell = $('tellAps');
      if (tell) {
        tell.href = wa(APS.wa, 'I ' + (decision === 'declined' ? 'decline' : 'approve') + ' quote ' + (tell.getAttribute('data-no') || '') +
          '. Total ' + money(Number(tell.getAttribute('data-total'))) + '. Deposit ' + money(Number(tell.getAttribute('data-dep'))) + '. ' + (tell.getAttribute('data-client') || ''));
      }
      if (note) note.innerHTML = '<div class="depbox">Thank you. Tap WhatsApp so Charl gets your answer on his phone.</div>';
      toast(decision === 'approved' ? 'Approved' : 'Declined');
    });
  }

  function createInvoice(jobId) {
    var job = jobById(jobId);
    var q = quoteOf(job);
    if (!q) return toast('Make a quote first');
    if (q.status !== 'approved' && !confirm('The client has not approved this quote yet. Invoice anyway?')) return;
    if (job.invoice_id && App.invoices[job.invoice_id]) return go('#/invoice/' + job.invoice_id);
    var t = R.totals(q);
    var inv = {
      id: DB.uid(), no: nextNo('APS-I-'), job_id: job.id, quote_id: q.id, status: 'draft', pay_link: '',
      date: todayISO(), scope: R.scopeLines(q), totals: t, labour_label: R.labourLabel(t), deposit_paid: false,
      client_name: job.client_name, title: job.title || '', addr: [job.address, job.suburb].filter(Boolean).join(', '),
      created_by: App.user.id
    };
    job.invoice_id = inv.id;
    job.status = 'invoiced';
    return DB.save('invoices', inv).then(function () { return DB.save('jobs', job); }).then(reload).then(function () { go('#/invoice/' + inv.id); });
  }
  function saveInvoice(form) {
    var inv = App.invoices[form.elements.id.value];
    if (!inv) return;
    var link = form.pay_link.value.trim();
    if (link && !payHref(link)) return toast('The pay link must start with https://');
    inv.pay_link = link;
    if (inv.status === 'draft') inv.status = 'sent';
    return DB.save('invoices', inv).then(function () { toast('Saved'); return draw(); });
  }
  function markDeposit(id) {
    var inv = App.invoices[id];
    if (!inv) return;
    inv.deposit_paid = !inv.deposit_paid;
    inv.status = inv.deposit_paid ? 'partial' : 'sent';
    return DB.save('invoices', inv).then(draw);
  }
  function markPaid(id) {
    var inv = App.invoices[id];
    if (!inv) return;
    inv.status = 'paid';
    var job = jobById(inv.job_id);
    if (job) job.status = 'paid';
    return DB.save('invoices', inv).then(function () { return job ? DB.save('jobs', job) : null; }).then(reload).then(draw).then(function () { toast('Marked paid'); });
  }

  function ensureCard(jobId) {
    return DB.get('cards', jobId).then(function (card) {
      if (card) return card;
      card = { id: jobId, job_id: jobId, notes: '', signature: '', signed_name: '', signed_at: null, elapsed_ms: 0, running_since: null };
      return DB.save('cards', card).then(function () { return card; });
    });
  }
  function startTimer(jobId) {
    var job = jobById(jobId);
    return ensureCard(jobId).then(function (card) {
      if (!card.running_since) card.running_since = new Date().toISOString();
      App.liveCard = card;
      return DB.save('cards', card);
    }).then(function () {
      if (job && (job.status === 'booked' || job.status === 'quoted' || job.status === 'lead') && canSet(job, 'progress')) {
        job.status = 'progress';
        return DB.save('jobs', job);
      }
    }).then(reload).then(draw);
  }
  function stopTimer(jobId) {
    return ensureCard(jobId).then(function (card) {
      card.elapsed_ms = cardElapsed(card);
      card.running_since = null;
      App.liveCard = card;
      return DB.save('cards', card);
    }).then(draw);
  }
  function saveCard(jobId) {
    return ensureCard(jobId).then(function (card) {
      var notes = $('cardNotes');
      var name = document.querySelector('input[name="signed_name"]');
      var canvas = $('sign');
      if (notes) card.notes = notes.value;
      if (name) card.signed_name = name.value.trim();
      if (canvas && App.signDirty) card.signature = canvas.toDataURL('image/png');
      if (card.signature) {
        if (App.signDirty || !card.signed_at) card.signed_at = new Date().toISOString();
      } else card.signed_at = null;
      if (card.running_since) {
        card.elapsed_ms = cardElapsed(card);
        card.running_since = new Date().toISOString();
      }
      App.liveCard = card;
      return DB.save('cards', card);
    }).then(function () { toast('Job card saved'); });
  }
  function clearSign() {
    var canvas = $('sign');
    if (!canvas) return;
    var g = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.strokeStyle = '#0C1F3D';
    App.signDirty = true;
    if (App.liveCard) App.liveCard.signature = '';
  }
  function addPhoto(file) {
    var jobId = App.route.id;
    if (!file || !jobId) return;
    return compress(file).then(function (blob) {
      var photo = { id: DB.uid(), job_id: jobId, blob: blob, caption: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), pending: APSSync.configured() };
      return DB.put('photos', photo).then(function () {
        if (!photo.pending) return;
        return APSSync.uploadPhoto(photo).then(function (ok) {
          if (!ok) return;
          photo.pending = false;
          return DB.put('photos', photo);
        }).catch(function () {});
      });
    }).then(function () { toast('Photo saved on this phone'); return draw(); });
  }
  function compress(file) {
    return createImageBitmap(file).then(function (img) {
      var max = 1280;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise(function (resolve) { canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.72); });
    }).catch(function () { return file; });
  }
  function logWa(jobId, kind) {
    var job = jobById(jobId);
    if (!job) return;
    job.wa_log = job.wa_log || [];
    job.wa_log.push({ kind: kind, at: new Date().toISOString() });
    DB.save('jobs', job);
  }

  function saveUser(form) {
    if (!isOwner()) return;
    var name = form.name.value.trim();
    var pin = form.pin.value.trim();
    if (!name) return toast('Enter a name');
    if (!/^\d{4,}$/.test(pin)) return toast('Use a PIN of at least 4 digits');
    var user = {
      id: DB.uid(), name: name, role: form.role.value, phone: form.phone.value.trim(), active: true,
      salt: DB.uid(), color: COLORS[App.users.length % COLORS.length]
    };
    return hashPin(pin, user.salt).then(function (hash) {
      user.pin_hash = hash;
      return DB.put('users', user);
    }).then(reload).then(draw).then(function () { toast('Added ' + name); });
  }
  function deactivate(id) {
    if (!isOwner() || id === App.user.id) return toast('The owner stays on this phone');
    return DB.get('users', id).then(function (u) {
      if (!u) return;
      u.active = false;
      return DB.put('users', u);
    }).then(reload).then(draw);
  }

  function exportBackup() {
    return collectPayload('backup').then(function (data) {
      return shareJson(data, 'aps-job-manager-backup.json');
    });
  }
  function sendJob(id) {
    var job = jobById(id);
    if (!job) return;
    return collectPayload('job', job).then(function (data) {
      return shareJson(data, (job.no || 'job') + '.json');
    });
  }
  function collectPayload(kind, onlyJob) {
    return Promise.all([DB.all('users'), DB.all('quotes'), DB.all('cards'), DB.all('photos'), DB.all('invoices')]).then(function (all) {
      var users = (all[0] || []).map(function (u) {
        return { id: u.id, name: u.name, role: u.role, phone: u.phone || '', active: u.active !== false, salt: u.salt, pin_hash: u.pin_hash, color: u.color };
      });
      var photos = all[3] || [];
      var want = onlyJob ? photos.filter(function (p) { return p.job_id === onlyJob.id; }) : photos;
      return Promise.all(want.map(function (p) {
        return blobToData(p.blob).then(function (dataUrl) {
          return { id: p.id, job_id: p.job_id, caption: p.caption || '', created_at: p.created_at, dataUrl: dataUrl };
        });
      })).then(function (photoRows) {
        if (kind === 'job') {
          return {
            app: 'aps-job-manager', v: 1, kind: 'job', at: new Date().toISOString(), users: users,
            job: onlyJob, quote: quoteOf(onlyJob), invoice: invoiceOf(onlyJob),
            card: (all[2] || []).filter(function (c) { return c.id === onlyJob.id; })[0] || null,
            photos: photoRows
          };
        }
        return {
          app: 'aps-job-manager', v: 1, kind: 'backup', at: new Date().toISOString(),
          users: users, jobs: App.jobs, quotes: all[1], invoices: all[4], cards: all[2], photos: photoRows
        };
      });
    });
  }
  function blobToData(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  function shareJson(data, name) {
    var file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        download(file, name);
      });
    }
    download(file, name);
    toast('File saved. Send it only to your own team.');
  }
  function download(file, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function importFile(file) {
    return file.text().then(function (text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('Could not read that file'); }
      if (!data || data.app !== 'aps-job-manager') throw new Error('That is not an APS job file');
      return mergeImport(data);
    }).then(function (jobId) {
      return DB.all('users').then(function (users) {
        App.users = users || [];
        App.hasUsers = App.users.some(function (u) { return u.active !== false; });
        if (!App.user && App.hasUsers) { toast('File loaded. Sign in with your PIN.'); go('#/login'); return; }
        return reload().then(function () {
          toast('Loaded');
          if (jobId) go('#/job/' + jobId);
          else draw();
        });
      });
    });
  }
  function mergeImport(data) {
    var usersHere = App.users && App.users.length;
    var chain = Promise.resolve();
    if (!usersHere && data.users && data.users.length) {
      data.users.forEach(function (u) { chain = chain.then(function () { return DB.put('users', u); }); });
    }
    var jobs = data.kind === 'job' && data.job ? [data.job] : (data.jobs || []);
    var quotes = data.kind === 'job' && data.quote ? [data.quote] : (data.quotes || []);
    var invoices = data.kind === 'job' && data.invoice ? [data.invoice] : (data.invoices || []);
    var cards = data.kind === 'job' && data.card ? [data.card] : (data.cards || []);
    function take(store, row) {
      if (!row || !row.id) return Promise.resolve();
      return DB.get(store, row.id).then(function (old) {
        if (old && String(old.updated_at || '') > String(row.updated_at || '')) return;
        return DB.put(store, row);
      });
    }
    jobs.forEach(function (row) { chain = chain.then(function () { return take('jobs', row); }); });
    quotes.forEach(function (row) { chain = chain.then(function () { return take('quotes', row); }); });
    invoices.forEach(function (row) { chain = chain.then(function () { return take('invoices', row); }); });
    cards.forEach(function (row) { chain = chain.then(function () { return take('cards', row); }); });
    (data.photos || []).forEach(function (p) {
      chain = chain.then(function () {
        if (!p.dataUrl) return;
        return fetch(p.dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
          return DB.put('photos', { id: p.id, job_id: p.job_id, blob: blob, caption: p.caption || '', created_at: p.created_at, updated_at: p.created_at });
        });
      });
    });
    return chain.then(function () { return data.job ? data.job.id : ''; });
  }

  function uploadSync() {
    if (!APSSync.configured()) return toast('Add the Supabase keys in config.js first');
    return APSSync.client().then(function (sb) {
      return sb.from('profiles').select('id');
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      var ids = (res.data || []).map(function (p) { return p.id; });
      return APSSync.queueAll(ids);
    }).then(function () { APSSync.kick(); toast('Upload started. Assign plumbers again if their Supabase login is new.'); });
  }

  var Mat = {
    items: null,
    loading: null,
    load: function () {
      if (Mat.items) return Promise.resolve(Mat.items);
      if (!Mat.loading) {
        Mat.loading = Mat._load().then(function (rows) { Mat.items = rows; return rows; }).finally(function () { Mat.loading = null; });
      }
      return Mat.loading;
    },
    _load: function () {
      function build(itemsJson, data) {
        var clsOf = R.classifier(data);
        var names = data.names || {};
        var checks = data.checks || {};
        var cats = itemsJson.cats || [];
        return itemsJson.rows.map(function (row) {
          var code = row[0];
          var name = names[code] || row[1];
          var cat = cats[row[2]] || '';
          var cost = Number(row[3]) || 0;
          var out = false;
          if (checks[code]) { cost = Number(checks[code][0]); out = checks[code][2] === 'O'; }
          var gen = R.genericName(name);
          var attrs = R.fittingAttrs(name, cat);
          var hay = [name, gen, code, attrs.type, attrs.material, attrs.joint, attrs.size, R.sizeWords(attrs.size)].join(' ').toLowerCase().replace(/[\/]+/g, ' ').replace(/(\d)\s+mm\b/g, '$1mm');
          return { code: code, name: name, gen: gen, cost: cost, cls: clsOf(code), out: out, cat: cat, ftype: attrs.type, material: attrs.material, joint: attrs.joint, size: attrs.size, hay: hay };
        });
      }
      return DB.get('meta', 'plumblink').then(function (cached) {
        if (cached && cached.v === 2 && cached.items && cached.items.length && cached.items[0].cat != null) return cached.items;
        return Promise.all([fetch('../field/items.json'), fetch('../quote-app/aps-data.json')]).then(function (pair) {
          if (!pair[0].ok || !pair[1].ok) throw new Error('Price list did not load');
          return Promise.all([pair[0].json(), pair[1].json()]);
        }).then(function (pair) {
          var rows = build(pair[0], pair[1]);
          return DB.put('meta', { id: 'plumblink', v: 2, snap: pair[0].snap || '', items: rows }).catch(function () {}).then(function () { return rows; });
        }).catch(function (err) {
          if (cached && cached.items && cached.items.length) return cached.items;
          throw err;
        });
      });
    },
    search: function (q) {
      var toks = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!toks.length || !Mat.items) return [];
      var out = [];
      for (var i = 0; i < Mat.items.length; i++) {
        var it = Mat.items[i];
        var ok = true;
        var score = 0;
        for (var k = 0; k < toks.length; k++) {
          var p = it.hay.indexOf(toks[k]);
          if (p < 0) { ok = false; break; }
          score += p === 0 ? 3 : 1;
        }
        if (!ok) continue;
        if (it.code === q.trim()) score += 20;
        if (it.out) score -= 2;
        out.push([score, it]);
      }
      out.sort(function (a, b) { return b[0] - a[0]; });
      return out.map(function (x) { return x[1]; });
    }
  };

  window.APSJM = {
    App: App, esc: esc, money: money, toast: toast, go: go, draw: draw, reload: reload,
    staff: staff, isOwner: isOwner, wide: wide, team: team, userName: userName,
    jobById: jobById, quoteOf: quoteOf, invoiceOf: invoiceOf, totalsOf: totalsOf,
    canSet: canSet, setStatus: setStatus, STAGES: STAGES, stageName: stageName,
    todayISO: todayISO, fmtWhen: fmtWhen, fmtDay: fmtDay, fmtDur: fmtDur,
    dayKey: dayKey, parseDay: parseDay, APS: APS, R: R, DB: DB, field: field, frame: frame,
    wa: wa, visibleJobs: visibleJobs, canSee: canSee, nextNo: nextNo, home: home,
    buildPublic: buildPublic,
    loadCatalogue: function () { return Mat.load(); },
    searchCatalogue: function (q) { return Mat.search(q); }
  };

  boot().catch(function (err) {
    var root = $('app');
    if (root) root.innerHTML = '<main><h2>Could not open Job Manager</h2><p>' + esc(err && err.message ? err.message : 'Please reload.') + '</p></main>';
  });
})();
