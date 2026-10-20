/* Office screens: dashboard, pipeline, clients, stock, map, reports. Phone plumbers keep the simple job list. */
(function (global) {
  'use strict';

  var mapObj = null;
  var leafletP = null;
  var SUBURBS = {
    krugersdorp: [-26.086, 27.775], roodepoort: [-26.120, 27.872], randburg: [-26.144, 27.982],
    johannesburg: [-26.204, 28.047], sandton: [-26.107, 28.056], soweto: [-26.268, 27.858],
    pretoria: [-25.747, 28.229], midrand: [-25.989, 28.128], centurion: [-25.860, 28.189],
    kempton: [-26.104, 28.232], benoni: [-26.188, 28.321], bokburg: [-26.215, 28.259],
    boksburg: [-26.215, 28.259], germiston: [-26.216, 28.167], alberton: [-26.267, 28.122],
    randfontein: [-26.184, 27.702], westonaria: [-26.319, 27.648]
  };

  function A() { return global.APSJM; }
  function esc(s) { return A().esc(s); }
  function money(n) { return A().money(n); }
  function pinFor(suburb) {
    var key = String(suburb || '').toLowerCase();
    var names = Object.keys(SUBURBS);
    for (var i = 0; i < names.length; i++) if (key.indexOf(names[i]) >= 0) return SUBURBS[names[i]];
    return null;
  }
  function dayAdd(key, days) {
    var d = A().parseDay(key);
    d.setDate(d.getDate() + days);
    return A().dayKey(d);
  }
  function inRange(iso, from, to) {
    if (!iso) return false;
    var day = String(iso).slice(0, 10);
    return day >= from && day <= to;
  }
  function jobsOf(clientId) {
    return (A().App.jobs || []).filter(function (j) { return j.client_id === clientId; });
  }
  function sitesOf(clientId) {
    return (A().App.sites || []).filter(function (s) { return s.client_id === clientId; });
  }

  function quoteOverdue(q) {
    if (!q || q.status !== 'sent' || !q.date) return false;
    return dayAdd(q.date, q.valid_days || 14) < A().todayISO();
  }
  function invoiceOverdue(inv) {
    if (!inv || inv.status === 'paid' || inv.status === 'draft' || !inv.date) return false;
    return dayAdd(inv.date, 7) < A().todayISO();
  }

  function ensurePlaces() {
    return DB.all('places').then(function (rows) {
      rows = rows || [];
      var chain = Promise.resolve(rows);
      if (!rows.some(function (p) { return p.kind === 'warehouse'; })) {
        chain = chain.then(function (list) {
          var wh = { id: DB.uid(), name: 'APS store - Krugersdorp', kind: 'warehouse', user_id: null, demo: false };
          return DB.save('places', wh).then(function () { list.push(wh); return list; });
        });
      }
      return chain.then(function (list) {
        var user = A().App.user;
        if (!user) return list;
        if (list.some(function (p) { return p.kind === 'van' && p.user_id === user.id; })) return list;
        var van = { id: DB.uid(), name: 'Van - ' + user.name, kind: 'van', user_id: user.id, demo: false };
        return DB.save('places', van).then(function () { list.push(van); return list; });
      });
    });
  }

  function levelFor(levels, itemId, placeId) {
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].item_id === itemId && levels[i].place_id === placeId) return levels[i];
    }
    return null;
  }

  function adjust(itemId, placeId, delta, kind, jobId, note) {
    return DB.all('stock_levels').then(function (rows) {
      var level = levelFor(rows || [], itemId, placeId);
      var qty = level ? Number(level.qty) || 0 : 0;
      if (delta < 0 && qty + delta < -0.001) throw new Error('Not enough in that place');
      if (!level) level = { id: DB.uid(), item_id: itemId, place_id: placeId, qty: 0 };
      level.qty = Math.round((qty + delta) * 100) / 100;
      return DB.save('stock_levels', level);
    }).then(function () {
      return DB.save('stock_moves', {
        id: DB.uid(), item_id: itemId, place_id: placeId, qty: delta,
        job_id: jobId || null, kind: kind || 'adjust', note: note || ''
      });
    });
  }

  function lowList(items, levels) {
    var out = [];
    (levels || []).forEach(function (lv) {
      var item = (items || []).filter(function (it) { return it.id === lv.item_id; })[0];
      if (!item || !(Number(item.reorder) > 0)) return;
      if (Number(lv.qty) <= Number(item.reorder)) out.push({ item: item, level: lv });
    });
    return out;
  }

  function viewDashboard() {
    if (!A().staff()) return A().frame('<div class="panel"><h2>Office dashboard</h2><p>This screen is for the owner and the office.</p></div>', { title: 'Dashboard' });
    return Promise.all([DB.all('stock_items'), DB.all('stock_levels')]).then(function (pair) {
      var today = A().todayISO();
      var todays = A().visibleJobs().filter(function (j) { return j.start_at && A().dayKey(new Date(j.start_at)) === today; })
        .sort(function (a, b) { return String(a.start_at).localeCompare(String(b.start_at)); });
      var quotes = Object.keys(A().App.quotes).map(function (k) { return A().App.quotes[k]; });
      var invoices = Object.keys(A().App.invoices).map(function (k) { return A().App.invoices[k]; });
      var overdueQ = quotes.filter(quoteOverdue);
      var overdueI = invoices.filter(invoiceOverdue);
      var owing = 0;
      invoices.forEach(function (inv) {
        if (!inv.totals || inv.status === 'paid') return;
        owing += inv.deposit_paid ? Number(inv.totals.bal) || 0 : Number(inv.totals.total) || 0;
      });
      var lows = lowList(pair[0], pair[1]);
      var stages = A().STAGES.map(function (s) {
        var n = A().App.jobs.filter(function (j) { return j.status === s[0]; }).length;
        return '<div class="stat"><b>' + n + '</b><span>' + esc(s[1]) + '</span></div>';
      }).join('');
      var todayHtml = todays.length ? todays.map(function (j) {
        return '<a class="card st-' + esc(j.status) + '" href="#/job/' + esc(j.id) + '"><span class="title">' + esc(j.client_name) + '</span>' +
          '<div class="muted">' + esc(A().fmtWhen(j.start_at)) + ' · ' + esc(A().userName(j.assigned_to)) + '</div>' +
          '<div>' + esc(j.title || '') + '</div></a>';
      }).join('') : '<p class="muted">Nothing booked today.</p>';
      var people = A().team().filter(function (u) { return u.role === 'plumber' || u.role === 'owner'; });
      var sched = people.map(function (u) {
        var list = todays.filter(function (j) { return j.assigned_to === u.id; });
        return '<div class="panel"><h3>' + esc(u.name) + '</h3>' +
          (list.length ? list.map(function (j) {
            return '<a href="#/job/' + esc(j.id) + '">' + esc(A().fmtWhen(j.start_at).replace(/.*?, /, '')) + ' ' + esc(j.client_name) + '</a>';
          }).join('') : '<p class="muted">Free today</p>') + '</div>';
      }).join('');
      var late = '';
      if (overdueQ.length || overdueI.length) {
        late = '<div class="panel"><h3>Overdue</h3>' +
          overdueQ.map(function (q) {
            var job = A().jobById(q.job_id);
            return '<a href="#/preview/' + esc(q.id) + '">Quote ' + esc(q.no) + ' · ' + esc(job ? job.client_name : '') + '</a>';
          }).join('') +
          overdueI.map(function (inv) {
            return '<a href="#/invoice/' + esc(inv.id) + '">Invoice ' + esc(inv.no) + ' · ' + esc(inv.client_name || '') + '</a>';
          }).join('') + '</div>';
      }
      var html = '<div class="stats">' +
        '<div class="stat"><b>' + todays.length + '</b><span>Today</span></div>' +
        '<div class="stat"><b>' + money(owing) + '</b><span>Outstanding</span></div>' +
        '<div class="stat"><b>' + (overdueQ.length + overdueI.length) + '</b><span>Overdue</span></div>' +
        '<div class="stat"><b>' + lows.length + '</b><span>Low stock</span></div></div>' +
        '<div class="stage-row">' + stages + '</div>' +
        (A().App.demoOn ? '' : '<p class="warn">The lists are yours. More, then Show demo company, fills them with sample West Rand jobs.</p>') +
        '<div class="split"><div><h3>Today</h3>' + todayHtml + '</div><div><h3>Team today</h3><div class="sched">' + (sched || '<p class="muted">Add plumbers under Team.</p>') + '</div></div></div>' +
        late +
        (lows.length ? '<div class="panel"><h3>Low stock</h3>' + lows.slice(0, 6).map(function (row) {
          var place = (A().App.places || []).filter(function (p) { return p.id === row.level.place_id; })[0];
          return '<div class="line"><div class="grow"><b>' + esc(row.item.generic || row.item.name) + '</b><span class="muted">' + esc(place ? place.name : '') + ' · ' + row.level.qty + ' left, reorder ' + row.item.reorder + '</span></div></div>';
        }).join('') + '<a class="btn btn-light btn-block" href="#/stock">Open stock</a></div>' : '') +
        '<div class="noprint"><a class="btn btn-block" href="#/board">Open the pipeline</a></div>';
      return A().frame(html, { title: 'Dashboard', sub: A().App.user.name });
    });
  }

  function viewBoard() {
    if (!A().staff()) return A().frame('<div class="panel">The pipeline board is for the office.</div>', { title: 'Pipeline' });
    var cols = A().STAGES.map(function (s) {
      var cards = A().App.jobs.filter(function (j) { return j.status === s[0]; }).map(function (j) {
        var t = A().totalsOf(j);
        var opts = A().STAGES.map(function (st) {
          return '<option value="' + st[0] + '"' + (st[0] === j.status ? ' selected' : '') + '>' + st[1] + '</option>';
        }).join('');
        return '<article class="card st-' + esc(j.status) + ' drag" data-drag="' + esc(j.id) + '">' +
          '<a href="#/job/' + esc(j.id) + '"><b>' + esc(j.client_name || 'No name') + '</b></a>' +
          '<div class="muted">' + esc(j.suburb || '') + (j.start_at ? ' · ' + esc(A().fmtWhen(j.start_at)) : '') + '</div>' +
          '<div>' + esc(j.title || '') + '</div>' +
          (t ? '<div class="money">' + money(t.total) + '</div>' : '') +
          '<select data-move="' + esc(j.id) + '" aria-label="Move stage">' + opts + '</select></article>';
      }).join('');
      return '<section class="col" data-col="' + s[0] + '"><h3>' + esc(s[1]) + '</h3>' + cards + '</section>';
    }).join('');
    return A().frame('<p class="muted">Drag a card to another column, or use the stage list on the card.</p><div id="board" class="board">' + cols + '</div>', { title: 'Pipeline' });
  }

  function viewClients() {
    if (!A().staff()) return A().frame('<div class="panel">Clients are kept by the office.</div>', { title: 'Clients' });
    var q = (A().App.clientQ || '').trim().toLowerCase();
    var list = (A().App.clients || []).filter(function (c) {
      if (!q) return true;
      var sites = sitesOf(c.id).map(function (s) { return s.address + ' ' + s.suburb + ' ' + s.label; }).join(' ');
      return (c.name + ' ' + c.phone + ' ' + c.email + ' ' + c.notes + ' ' + sites).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var cards = list.map(function (c) {
      var n = jobsOf(c.id).length;
      var siteN = sitesOf(c.id).length;
      return '<a class="card" href="#/client/' + esc(c.id) + '"><span class="title">' + esc(c.name) + '</span>' +
        '<div class="muted">' + esc(c.phone || 'No phone') + ' · ' + siteN + ' site' + (siteN === 1 ? '' : 's') + ' · ' + n + ' job' + (n === 1 ? '' : 's') + '</div></a>';
    }).join('') || '<p class="muted">No clients yet. A new job creates one, or add one here.</p>';
    return A().frame(
      '<input class="search" id="clientSearch" placeholder="Search name, phone, suburb" value="' + esc(A().App.clientQ || '') + '">' +
      cards +
      '<form id="clientForm" class="panel"><h3>New client</h3>' +
      A().field('Name', 'name', '') + A().field('Phone', 'phone', '', 'tel') + A().field('Email', 'email', '', 'email', 'email') +
      '<label class="field">Notes<textarea name="notes"></textarea></label>' +
      '<button class="btn btn-block" type="submit">Save client</button></form>',
      { title: 'Clients' }
    );
  }

  function viewClient(id) {
    if (!A().staff()) return A().frame('<div class="panel">Clients are kept by the office.</div>', { title: 'Client' });
    var c = (A().App.clients || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return A().frame('<div class="panel">Client not on this phone.</div>', { title: 'Client', back: '#/clients' });
    return Promise.all([DB.all('contacts'), DB.all('quotes'), DB.all('invoices')]).then(function (all) {
      var contacts = (all[0] || []).filter(function (x) { return x.client_id === c.id; });
      var sites = sitesOf(c.id);
      var jobs = jobsOf(c.id);
      var contactHtml = contacts.map(function (p) {
        return '<div class="line"><div class="grow"><b>' + esc(p.name) + '</b><span class="muted">' + esc(p.role || 'Contact') + (p.phone ? ' · ' + esc(p.phone) : '') + '</span></div></div>';
      }).join('') || '<p class="muted">No extra contacts.</p>';
      var siteHtml = sites.map(function (s) {
        return '<div class="panel"><b>' + esc(s.label || 'Site') + '</b><div>' + esc(s.address) + (s.suburb ? ', ' + esc(s.suburb) : '') + '</div>' +
          (s.notes ? '<p class="muted">' + esc(s.notes) + '</p>' : '') +
          '<p class="muted">' + jobs.filter(function (j) { return j.site_id === s.id; }).length + ' jobs at this site</p></div>';
      }).join('') || '<p class="muted">No sites yet.</p>';
      var hist = jobs.map(function (j) {
        var t = A().totalsOf(j);
        return '<a class="card st-' + esc(j.status) + '" href="#/job/' + esc(j.id) + '"><span class="title">' + esc(j.title || j.no) + '</span>' +
          '<div class="muted">' + esc(A().stageName(j.status)) + (j.suburb ? ' · ' + esc(j.suburb) : '') + '</div>' +
          (t ? '<div class="money">' + money(t.total) + '</div>' : '') + '</a>';
      }).join('') || '<p class="muted">No jobs yet.</p>';
      return A().frame(
        '<div class="panel"><h2>' + esc(c.name) + '</h2><p>' + esc(c.phone || '') + (c.email ? '<br>' + esc(c.email) : '') + '</p>' +
        (c.notes ? '<p>' + esc(c.notes) + '</p>' : '') +
        '<a class="btn btn-block" href="#/edit/new/' + esc(c.id) + '">New job for this client</a></div>' +
        '<div class="panel"><h3>People</h3>' + contactHtml +
        '<form id="contactForm">' + A().field('Name', 'name', '') + A().field('Phone', 'phone', '', 'tel') + A().field('Role', 'role', 'Owner') +
        '<input type="hidden" name="client_id" value="' + esc(c.id) + '"><button class="btn btn-light btn-block" type="submit">Add contact</button></form></div>' +
        '<h3>Sites</h3>' + siteHtml +
        '<form id="siteForm" class="panel"><h3>New site</h3><input type="hidden" name="client_id" value="' + esc(c.id) + '">' +
        A().field('Label', 'label', 'Home') + A().field('Address', 'address', '') + A().field('Suburb', 'suburb', '') +
        '<label class="field">Notes<textarea name="notes"></textarea></label>' +
        '<button class="btn btn-block" type="submit">Save site</button></form>' +
        '<h3>History</h3>' + hist,
        { title: c.name, back: '#/clients' }
      );
    });
  }

  function viewStock() {
    return ensurePlaces().then(function () { return A().reload(); }).then(function () {
      return Promise.all([DB.all('stock_items'), DB.all('stock_levels'), DB.all('places'), DB.all('purchase_orders')]);
    }).then(function (all) {
      var items = all[0] || [];
      var levels = all[1] || [];
      var places = all[2] || [];
      A().App.places = places;
      var placeId = A().App.stockPlace || (places[0] && places[0].id) || '';
      if (!places.some(function (p) { return p.id === placeId; })) placeId = places[0] ? places[0].id : '';
      A().App.stockPlace = placeId;
      var lows = lowList(items, levels);
      var here = levels.filter(function (lv) { return lv.place_id === placeId && Number(lv.qty) !== 0; });
      var rows = here.map(function (lv) {
        var item = items.filter(function (it) { return it.id === lv.item_id; })[0];
        if (!item) return '';
        var low = Number(item.reorder) > 0 && Number(lv.qty) <= Number(item.reorder);
        return '<div class="line"><div class="grow"><b>' + esc(item.generic || item.name) + '</b><span class="muted">' + esc(item.code || '') + (low ? ' · low' : '') + '</span></div><b>' + lv.qty + '</b></div>';
      }).join('') || '<p class="muted">Nothing counted in this place yet.</p>';
      var placeOpts = places.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === placeId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      var itemOpts = '<option value="">Choose an item</option>' + items.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).slice(0, 400).map(function (it) {
        return '<option value="' + esc(it.id) + '">' + esc(it.generic || it.name) + '</option>';
      }).join('');
      var pos = A().staff() ? '<a class="btn btn-block" href="#/po">Purchase orders</a>' : '';
      var vans = A().staff() ? '<form id="vanForm" class="panel"><h3>Add a van</h3><label class="field">Plumber<select name="user_id">' +
        A().team().map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>'; }).join('') +
        '</select></label><button class="btn btn-light btn-block" type="submit">Add van</button></form>' : '';
      var importBtn = A().staff() ? '<button class="btn btn-light btn-block" type="button" data-act="import-stock">Load the Plumblink list into stock</button><p class="muted">That copies generic names and cost prices onto this phone. It does not order anything.</p>' : '';
      return A().frame(
        (lows.length ? '<div class="panel"><h3>Low stock</h3>' + lows.slice(0, 8).map(function (row) {
          return '<div>' + esc(row.item.generic || row.item.name) + ' · ' + row.level.qty + '</div>';
        }).join('') + '</div>' : '') +
        '<label class="field">Place<select id="placePick">' + placeOpts + '</select></label>' +
        rows +
        '<form id="receiveForm" class="panel"><h3>Count or receive</h3>' +
        '<label class="field">Item<select name="item_id">' + itemOpts + '</select></label>' +
        A().field('Quantity to add', 'qty', '1', 'decimal') +
        '<button class="btn btn-block" type="submit">Add into this place</button></form>' +
        '<form id="transferForm" class="panel"><h3>Transfer</h3>' +
        '<label class="field">Item<select name="item_id">' + itemOpts + '</select></label>' +
        '<label class="field">From<select name="from_id">' + placeOpts + '</select></label>' +
        '<label class="field">To<select name="to_id">' + placeOpts + '</select></label>' +
        A().field('Quantity', 'qty', '1', 'decimal') +
        '<button class="btn btn-block" type="submit">Move stock</button></form>' +
        '<div class="panel"><h3>Find a fitting</h3><input class="search" id="stockSearch" placeholder="valve, geyser, 22mm">' +
        '<div id="stockHits"></div>' + importBtn + '</div>' + pos + vans,
        { title: 'Stock' }
      );
    });
  }

  function viewPO(id) {
    if (!A().staff()) return A().frame('<div class="panel">Purchase orders are for the office.</div>', { title: 'Orders' });
    return Promise.all([DB.all('purchase_orders'), DB.all('stock_items'), DB.all('places')]).then(function (all) {
      var orders = all[0] || [];
      var items = all[1] || [];
      var places = (all[2] || []).filter(function (p) { return p.kind === 'warehouse'; });
      if (!id) {
        var list = orders.sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); }).map(function (po) {
          return '<a class="card" href="#/po/' + esc(po.id) + '"><span class="title">' + esc(po.no) + '</span><div class="muted">' + esc(po.supplier) + ' · ' + esc(po.status) + '</div></a>';
        }).join('') || '<p class="muted">No orders yet.</p>';
        return A().frame(list + '<button class="btn btn-block" type="button" data-act="new-po">New order to Plumblink Krugersdorp</button>', { title: 'Purchase orders', back: '#/stock' });
      }
      var po = orders.filter(function (p) { return p.id === id; })[0];
      if (!po) return A().frame('<div class="panel">Order not on this phone.</div>', { title: 'Order', back: '#/po' });
      var lines = (po.lines || []).map(function (line, i) {
        return '<div class="line"><div class="grow"><b>' + esc(line.name) + '</b><span class="muted">' + line.qty + ' × cost ' + money(line.cost) + '</span></div>' +
          (po.status === 'received' ? '' : '<button class="btn btn-light" type="button" data-act="po-del" data-i="' + i + '" data-id="' + esc(po.id) + '">Remove</button>') +
          '</div>';
      }).join('') || '<p class="muted">No lines yet.</p>';
      var itemOpts = items.map(function (it) {
        return '<option value="' + esc(it.id) + '">' + esc(it.generic || it.name) + '</option>';
      }).join('');
      var placeOpts = places.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === po.place_id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      var add = po.status === 'received' ? '' : '<form id="poLineForm" class="panel"><input type="hidden" name="id" value="' + esc(po.id) + '">' +
        '<label class="field">Add item<select name="item_id">' + itemOpts + '</select></label>' +
        A().field('Qty', 'qty', '1', 'decimal') + '<button class="btn btn-light btn-block" type="submit">Add line</button></form>';
      var recv = po.status === 'received' ? '<p class="depbox">Received into stock.</p>' :
        '<form id="poHead" class="panel"><input type="hidden" name="id" value="' + esc(po.id) + '">' +
        A().field('Supplier', 'supplier', po.supplier || 'Plumblink Krugersdorp') +
        '<label class="field">Receive into<select name="place_id">' + placeOpts + '</select></label>' +
        '<button class="btn btn-light btn-block" type="submit">Save order</button></form>' +
        '<button class="btn btn-block" type="button" data-act="po-receive" data-id="' + esc(po.id) + '">Receive into stock</button>';
      return A().frame('<div class="panel"><h2>' + esc(po.no) + '</h2><p class="muted">' + esc(po.status) + '</p></div>' + lines + add + recv,
        { title: 'Order', back: '#/po', sub: po.supplier });
    });
  }

  function viewMap() {
    return A().frame(
      '<div class="mapwrap"><div id="mapBox">Loading the map…</div></div>' +
      '<button class="btn btn-block" type="button" data-act="checkin">Check in where I am</button>' +
      '<p class="muted">Pins are jobs with a site pin. Blue rings are the latest check-in from each plumber. The map uses OpenStreetMap.</p>' +
      '<div id="mapList"></div>',
      { title: 'Map' }
    );
  }

  function viewReports() {
    if (!A().staff()) return A().frame('<div class="panel">Reports are for the office.</div>', { title: 'Reports' });
    var from = A().App.repFrom || A().todayISO().slice(0, 8) + '01';
    var to = A().App.repTo || A().todayISO();
    return Promise.all([DB.all('cards'), DB.all('stock_moves')]).then(function (pair) {
      var cards = pair[0] || [];
      var jobs = A().App.jobs.filter(function (j) {
        return inRange(j.created_at, from, to) || inRange(j.start_at, from, to);
      });
      var quotes = Object.keys(A().App.quotes).map(function (k) { return A().App.quotes[k]; }).filter(function (q) { return inRange(q.date, from, to); });
      var invoices = Object.keys(A().App.invoices).map(function (k) { return A().App.invoices[k]; }).filter(function (inv) { return inRange(inv.date, from, to); });
      var quoted = 0, won = 0;
      quotes.forEach(function (q) {
        var t = APSRates.totals(q).total;
        quoted += t;
        if (q.status === 'approved') won += t;
      });
      var paid = 0, due = 0;
      invoices.forEach(function (inv) {
        var t = inv.totals ? Number(inv.totals.total) || 0 : 0;
        if (inv.status === 'paid') paid += t;
        else due += inv.deposit_paid && inv.totals ? Number(inv.totals.bal) || 0 : t;
      });
      var stageRows = A().STAGES.map(function (s) {
        return { label: s[1], value: jobs.filter(function (j) { return j.status === s[0]; }).length, text: '' };
      });
      var hours = {};
      var counts = {};
      jobs.forEach(function (j) {
        var who = j.assigned_to || 'none';
        counts[who] = (counts[who] || 0) + 1;
        var card = cards.filter(function (c) { return c.id === j.id || c.job_id === j.id; })[0];
        var ms = card ? (card.elapsed_ms || 0) : 0;
        if (card && card.running_since) ms += Date.now() - new Date(card.running_since).getTime();
        hours[who] = (hours[who] || 0) + ms;
      });
      var people = Object.keys(counts).map(function (id) {
        return { label: id === 'none' ? 'Unassigned' : A().userName(id), value: counts[id], text: (hours[id] / 3600000).toFixed(1) + ' h' };
      });
      var cost = 0, charged = 0;
      quotes.forEach(function (q) {
        (q.items || []).forEach(function (line) {
          if (line.kind !== 'material') return;
          var qty = Number(line.qty) || 0;
          cost += (Number(line.cost) || 0) * qty;
          charged += (Number(line.each) || 0) * qty;
        });
        charged += Number(q.mat_typed) || 0;
      });
      function bars(rows, color) {
        var max = 1;
        rows.forEach(function (r) { if (r.value > max) max = r.value; });
        return '<div class="bars">' + rows.map(function (r) {
          var w = Math.max(2, Math.round(r.value / max * 100));
          return '<div class="bar"><span>' + esc(r.label) + '</span><i style="width:' + w + '%;background:' + color + '"></i><b>' + esc(r.text || String(r.value)) + '</b></div>';
        }).join('') + '</div>';
      }
      A().App.reportCache = { from: from, to: to, quoted: quoted, won: won, paid: paid, due: due, jobs: jobs.length, cost: cost, charged: charged, stageRows: stageRows, people: people };
      return A().frame(
        '<form id="reportForm"><div class="two">' + A().field('From', 'from', from, '', 'date') + A().field('To', 'to', to, '', 'date') + '</div>' +
        '<button class="btn btn-light btn-block" type="submit">Update report</button></form>' +
        '<div class="stats"><div class="stat"><b>' + money(paid) + '</b><span>Paid</span></div>' +
        '<div class="stat"><b>' + money(due) + '</b><span>Outstanding</span></div>' +
        '<div class="stat"><b>' + money(quoted) + '</b><span>Quoted</span></div>' +
        '<div class="stat"><b>' + money(won) + '</b><span>Won</span></div></div>' +
        '<div class="panel"><h3>Quoted against won</h3>' + bars([{ label: 'Quoted', value: quoted, text: money(quoted) }, { label: 'Won', value: won, text: money(won) }], '#004AAD') + '</div>' +
        '<div class="panel"><h3>Paid against outstanding</h3>' + bars([{ label: 'Paid', value: paid, text: money(paid) }, { label: 'Outstanding', value: due, text: money(due) }], '#2E7D32') + '</div>' +
        '<div class="panel"><h3>Jobs by stage</h3>' + bars(stageRows, '#0277BD') + '</div>' +
        '<div class="panel"><h3>Jobs and hours by person</h3>' + (people.length ? bars(people, '#EF6C00') : '<p class="muted">No jobs in this range.</p>') + '</div>' +
        '<div class="panel"><h3>Materials, cost against charged</h3>' + bars([{ label: 'Cost', value: cost, text: money(cost) }, { label: 'Charged', value: charged, text: money(charged) }], '#6A1B9A') +
        '<p class="muted">Charged is the sell price on the quote. Cost is what you typed or what came from the price list. No VAT.</p></div>' +
        '<button class="btn btn-block" type="button" data-act="csv">Download CSV</button>',
        { title: 'Reports' }
      );
    });
  }

  function loadLeaflet() {
    if (global.L) return Promise.resolve(global.L);
    if (leafletP) return leafletP;
    leafletP = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      s.onload = function () { if (global.L) resolve(global.L); else reject(new Error('The map did not start.')); };
      s.onerror = function () { leafletP = null; reject(new Error('The map needs a signal the first time.')); };
      document.head.appendChild(s);
    });
    return leafletP;
  }

  function mountMap() {
    var box = document.getElementById('mapBox');
    if (!box) return;
    var jobs = A().visibleJobs().filter(function (j) { return j.lat && j.lng; });
    var list = document.getElementById('mapList');
    if (list) {
      list.innerHTML = (jobs.length ? jobs : A().visibleJobs()).slice(0, 12).map(function (j) {
        return '<a class="card st-' + esc(j.status) + '" href="#/job/' + esc(j.id) + '"><b>' + esc(j.client_name) + '</b><div class="muted">' + esc(j.suburb || 'No pin yet') + '</div></a>';
      }).join('');
    }
    loadLeaflet().then(function (L) {
      if (!document.getElementById('mapBox')) return;
      box.innerHTML = '';
      mapObj = L.map(box, { scrollWheelZoom: false }).setView([-26.1, 27.8], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapObj);
      var colors = { lead: '#5C6B82', quoted: '#7D3C98', booked: '#0277BD', progress: '#EF6C00', done: '#2E7D32', invoiced: '#AD1457', paid: '#1B5E20' };
      var bounds = [];
      jobs.forEach(function (j) {
        var icon = L.divIcon({ className: 'pin', html: '<span style="background:' + (colors[j.status] || '#004AAD') + '"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
        L.marker([j.lat, j.lng], { icon: icon }).addTo(mapObj).bindPopup('<b>' + esc(j.client_name) + '</b><br>' + esc(j.title || '') + '<br><a href="#/job/' + j.id + '">Open job</a>');
        bounds.push([j.lat, j.lng]);
      });
      return DB.all('checkins').then(function (rows) {
        var latest = {};
        (rows || []).forEach(function (r) {
          if (!A().staff() && r.user_id !== A().App.user.id) return;
          if (!latest[r.user_id] || String(r.created_at) > String(latest[r.user_id].created_at)) latest[r.user_id] = r;
        });
        Object.keys(latest).forEach(function (id) {
          var r = latest[id];
          var icon = L.divIcon({ className: 'pin who', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
          L.marker([r.lat, r.lng], { icon: icon }).addTo(mapObj).bindPopup(esc(A().userName(r.user_id)) + '<br>Checked in');
          bounds.push([r.lat, r.lng]);
        });
        if (bounds.length) mapObj.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
        setTimeout(function () { if (mapObj) mapObj.invalidateSize(); }, 80);
      });
    }).catch(function (err) {
      if (box) box.innerHTML = '<p class="muted">' + esc(err.message || 'Map unavailable') + '</p>';
    });
  }

  function mountBoard() {
    var board = document.getElementById('board');
    if (!board) return;
    board.querySelectorAll('[data-drag]').forEach(function (card) {
      card.addEventListener('pointerdown', function (e) {
        if (e.target.closest('a,button,select')) return;
        card._drag = { x: e.clientX, y: e.clientY, moved: false };
        card.setPointerCapture(e.pointerId);
      });
      card.addEventListener('pointermove', function (e) {
        if (!card._drag) return;
        var dx = e.clientX - card._drag.x;
        var dy = e.clientY - card._drag.y;
        if (Math.abs(dx) + Math.abs(dy) < 8) return;
        card._drag.moved = true;
        card.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        card.style.zIndex = '5';
      });
      card.addEventListener('pointerup', function (e) {
        if (!card._drag || !card._drag.moved) { card._drag = null; return; }
        card.style.visibility = 'hidden';
        var under = document.elementFromPoint(e.clientX, e.clientY);
        card.style.visibility = '';
        card.style.transform = '';
        card.style.zIndex = '';
        card._drag = null;
        var col = under && under.closest('[data-col]');
        if (!col) return;
        var status = col.getAttribute('data-col');
        var job = A().jobById(card.getAttribute('data-drag'));
        if (!job || job.status === status) return;
        A().setStatus(job.id, status);
      });
    });
  }

  function linkClient(job, form) {
    var clientId = form.client_id ? form.client_id.value : '';
    var siteId = form.site_id ? form.site_id.value : '';
    var chain = Promise.resolve();
    if (clientId) {
      job.client_id = clientId;
      var found = (A().App.clients || []).filter(function (c) { return c.id === clientId; })[0];
      if (found) {
        job.client_name = job.client_name || found.name;
        job.phone = job.phone || found.phone || '';
        job.email = job.email || found.email || '';
      }
    } else if (job.client_name) {
      var same = (A().App.clients || []).filter(function (c) { return c.name.toLowerCase() === job.client_name.toLowerCase(); })[0];
      if (same) job.client_id = same.id;
      else {
        var client = { id: DB.uid(), name: job.client_name, phone: job.phone || '', email: job.email || '', notes: '', demo: false };
        job.client_id = client.id;
        chain = DB.save('clients', client);
      }
    }
    return chain.then(function () {
      if (!job.client_id) return;
      if (siteId) {
        job.site_id = siteId;
        var site = (A().App.sites || []).filter(function (s) { return s.id === siteId; })[0];
        if (site) {
          job.address = job.address || site.address || '';
          job.suburb = job.suburb || site.suburb || '';
          if (site.lat && job.lat == null) { job.lat = site.lat; job.lng = site.lng; }
        }
        return;
      }
      if (!job.address && !job.suburb) return;
      var match = (A().App.sites || []).filter(function (s) {
        return s.client_id === job.client_id && (s.address || '') === (job.address || '') && (s.suburb || '') === (job.suburb || '');
      })[0];
      if (match) {
        job.site_id = match.id;
        if (match.lat && job.lat == null) { job.lat = match.lat; job.lng = match.lng; }
        return;
      }
      var pin = pinFor(job.suburb);
      var created = {
        id: DB.uid(), client_id: job.client_id, label: job.suburb || 'Site', address: job.address || '',
        suburb: job.suburb || '', lat: pin ? pin[0] : null, lng: pin ? pin[1] : null, notes: '', demo: false
      };
      job.site_id = created.id;
      if (pin && job.lat == null) { job.lat = pin[0]; job.lng = pin[1]; }
      return DB.save('sites', created);
    });
  }

  function cardExtra(job) {
    return Promise.all([DB.all('stock_moves'), DB.all('stock_items'), DB.all('stock_levels'), ensurePlaces()]).then(function (all) {
      var moves = (all[0] || []).filter(function (m) { return m.job_id === job.id && Number(m.qty) < 0; });
      var items = all[1] || [];
      var places = all[2] && all[3] ? all[3] : [];
      var used = moves.map(function (m) {
        var item = items.filter(function (it) { return it.id === m.item_id; })[0];
        return '<div class="line"><div class="grow">' + esc(item ? (item.generic || item.name) : 'Part') + '</div><b>' + Math.abs(Number(m.qty)) + '</b></div>';
      }).join('') || '<p class="muted">No parts taken off the van yet.</p>';
      var opts = items.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).slice(0, 400).map(function (it) {
        return '<option value="' + esc(it.id) + '">' + esc(it.generic || it.name) + '</option>';
      }).join('');
      var placeOpts = places.map(function (p) {
        var mine = p.user_id === A().App.user.id;
        return '<option value="' + esc(p.id) + '"' + (mine ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      return '<div class="panel"><h3>Parts used</h3>' + used +
        '<form id="useForm"><input type="hidden" name="job_id" value="' + esc(job.id) + '">' +
        '<label class="field">From<select name="place_id">' + placeOpts + '</select></label>' +
        '<label class="field">Item<select name="item_id"><option value="">Choose</option>' + opts + '</select></label>' +
        A().field('Qty', 'qty', '1', 'decimal') +
        '<button class="btn btn-block" type="submit">Take off stock</button></form>' +
        '<button class="btn btn-light btn-block" type="button" data-act="checkin" data-id="' + esc(job.id) + '">Check in at this job</button>' +
        '<button class="btn btn-block" type="button" data-act="pdf" data-kind="card" data-id="' + esc(job.id) + '">Download job card PDF</button>' +
        '<button class="btn btn-wa btn-block" type="button" data-act="pdf-share" data-kind="card" data-id="' + esc(job.id) + '">Share job card PDF</button></div>';
    });
  }

  function pubOf(kind, id) {
    if (kind === 'invoice') {
      var inv = A().App.invoices[id];
      if (!inv) return null;
      var job = A().jobById(inv.job_id) || {};
      return {
        file: (inv.no || 'invoice') + '.pdf',
        pub: {
          no: inv.no, date: inv.date, client: inv.client_name || job.client_name, addr: inv.addr || '',
          title: inv.title || job.title, scope: inv.scope || [], mat: inv.totals.mat, cons: inv.totals.cons,
          labour: inv.totals.labourAll != null ? inv.totals.labourAll : inv.totals.labour,
          labour_label: inv.labour_label, total: inv.totals.total, dep: inv.totals.dep, bal: inv.totals.bal,
          pay: inv.pay_link || ''
        }
      };
    }
    var q = A().App.quotes[id] || (A().App.draft && A().App.draft.id === id ? A().App.draft : null);
    if (!q) return null;
    var j = A().jobById(q.job_id) || {};
    return { file: (q.no || 'quote') + '.pdf', pub: q.public || A().buildPublic(q, j) };
  }

  function makePdf(kind, id) {
    if (kind === 'card') {
      var job = A().jobById(id);
      if (!job) return Promise.reject(new Error('Job not on this phone'));
      return Promise.all([DB.get('cards', job.id), DB.all('stock_moves'), DB.all('stock_items')]).then(function (all) {
        var card = all[0] || {};
        var parts = (all[1] || []).filter(function (m) { return m.job_id === job.id && Number(m.qty) < 0; }).map(function (m) {
          var item = (all[2] || []).filter(function (it) { return it.id === m.item_id; })[0];
          return { qty: Math.abs(Number(m.qty)), name: item ? (item.generic || item.name) : 'Part' };
        });
        var t = A().totalsOf(job);
        var q = A().quoteOf(job);
        return APSPdf.card({
          no: job.no, client: job.client_name, addr: [job.address, job.suburb].filter(Boolean).join(', '),
          title: job.title || job.scope, stage: A().stageName(job.status), when: A().fmtWhen(job.start_at) || 'Not booked',
          plumber: A().userName(job.assigned_to), timer: A().fmtDur(card.elapsed_ms || 0), notes: card.notes || '',
          signed_name: card.signed_name || '', signature: card.signature || '',
          scope: q ? APSRates.scopeLines(q) : (job.scope ? [job.scope] : []),
          parts: parts, total: t ? t.total : null
        }).then(function (blob) { return { blob: blob, file: (job.no || 'job-card') + '.pdf' }; });
      });
    }
    var pack = pubOf(kind, id);
    if (!pack) return Promise.reject(new Error('Nothing to print'));
    return APSPdf.build(pack.pub, kind === 'invoice' ? 'INVOICE' : 'QUOTATION').then(function (blob) {
      return { blob: blob, file: pack.file };
    });
  }

  function checkin(jobId) {
    if (!navigator.geolocation) return A().toast('This phone has no location');
    A().toast('Finding you…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var row = {
        id: DB.uid(), user_id: A().App.user.id, job_id: jobId || null,
        lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || null
      };
      var chain = DB.save('checkins', row);
      if (jobId) {
        var job = A().jobById(jobId);
        if (job) {
          job.lat = row.lat;
          job.lng = row.lng;
          chain = chain.then(function () { return DB.save('jobs', job); });
        }
      }
      chain.then(function () { return A().reload(); }).then(A().draw).then(function () { A().toast('Checked in'); });
    }, function () { A().toast('Allow location for this site, then try again'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  }

  function csv() {
    var r = A().App.reportCache;
    if (!r) return;
    function cell(s) {
      s = String(s == null ? '' : s);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = [['section', 'name', 'value'].join(',')];
    function add(section, name, value) { lines.push([cell(section), cell(name), cell(value)].join(',')); }
    add('range', 'from', r.from); add('range', 'to', r.to);
    add('money', 'quoted', r.quoted.toFixed(2)); add('money', 'won', r.won.toFixed(2));
    add('money', 'paid', r.paid.toFixed(2)); add('money', 'outstanding', r.due.toFixed(2));
    add('materials', 'cost', r.cost.toFixed(2)); add('materials', 'charged', r.charged.toFixed(2));
    r.stageRows.forEach(function (row) { add('stage', row.label, row.value); });
    r.people.forEach(function (row) { add('person', row.label, row.text + ' jobs ' + row.value); });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    APSPdf.download(blob, 'aps-report-' + r.from + '.csv');
    A().toast('Report saved');
  }

  function searchStock(q) {
    var box = document.getElementById('stockHits');
    if (!box) return;
    if (!q || q.trim().length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="muted">Searching…</p>';
    var local = Promise.resolve();
    var show = function (hits) {
      DB.all('stock_items').then(function (items) {
        var words = q.toLowerCase().split(/\s+/).filter(Boolean);
        var mine = (items || []).filter(function (it) {
          var hay = (it.name + ' ' + it.generic + ' ' + it.code).toLowerCase();
          return words.every(function (w) { return hay.indexOf(w) >= 0; });
        }).slice(0, 8);
        var html = mine.map(function (it) {
          return '<div class="hit"><div class="grow"><b>' + esc(it.generic || it.name) + '</b><span class="muted">On the stock list</span></div></div>';
        }).join('');
        html += (hits || []).slice(0, 8).map(function (it, i) {
          return '<div class="hit"><div class="grow"><b>' + esc(it.gen) + '</b><span class="muted">' + esc(it.code) + ' · cost ' + money(it.cost) + '</span></div>' +
            '<button type="button" data-act="stock-add" data-i="' + i + '">Add</button></div>';
        }).join('');
        A().App.stockHits = hits || [];
        if (document.getElementById('stockHits')) document.getElementById('stockHits').innerHTML = html || '<p class="muted">Nothing matched.</p>';
      });
    };
    if (A().loadCatalogue) {
      A().loadCatalogue().then(function () { show(A().searchCatalogue(q)); }).catch(function () { show([]); });
    } else show([]);
    return local;
  }

  var routes = { dashboard: 1, board: 1, clients: 1, client: 1, stock: 1, map: 1, reports: 1, po: 1 };

  function view(route) {
    if (route.name === 'dashboard') return viewDashboard();
    if (route.name === 'board') return viewBoard();
    if (route.name === 'clients') return viewClients();
    if (route.name === 'client') return viewClient(route.id);
    if (route.name === 'stock') return viewStock();
    if (route.name === 'map') return viewMap();
    if (route.name === 'reports') return viewReports();
    if (route.name === 'po') return viewPO(route.id);
    return A().frame('<div class="panel">That screen is not here.</div>', { title: 'APS' });
  }

  function act(name, el) {
    if (name === 'demo-toggle') {
      var run = A().App.demoOn ? APSDemo.hide() : APSDemo.show();
      run.then(A().reload).then(A().draw).then(function () { A().toast(A().App.demoOn ? 'Demo company is on' : 'Demo data removed'); })
        .catch(function (err) { A().toast(err.message || 'Could not change the demo'); });
      return true;
    }
    if (name === 'pdf' || name === 'pdf-share') {
      makePdf(el.dataset.kind, el.dataset.id).then(function (file) {
        if (name === 'pdf-share') return APSPdf.share(file.blob, file.file, 'APS ' + file.file);
        APSPdf.download(file.blob, file.file);
        A().toast('PDF saved');
      }).catch(function (err) { A().toast(err.message || 'Could not make the PDF'); });
      return true;
    }
    if (name === 'checkin') { checkin(el.dataset.id || ''); return true; }
    if (name === 'csv') { csv(); return true; }
    if (name === 'import-stock') {
      if (!A().loadCatalogue) return true;
      A().toast('Loading the price list…');
      A().loadCatalogue().then(function (rows) {
        return DB.all('stock_items').then(function (have) {
          var codes = {};
          (have || []).forEach(function (it) { if (it.code) codes[it.code] = 1; });
          var now = new Date().toISOString();
          var add = [];
          (rows || []).forEach(function (it) {
            if (codes[it.code]) return;
            add.push({
              id: DB.uid(), code: it.code, name: it.gen, generic: it.gen, unit: 'each', cost: it.cost,
              reorder: 0, supplier: 'Plumblink Krugersdorp', cls: it.cls || 'f', created_at: now, updated_at: now, demo: false
            });
          });
          return DB.putAll('stock_items', add).then(function (n) { return A().draw().then(function () { A().toast('Added ' + n + ' fittings'); }); });
        });
      }).catch(function () { A().toast('The price list needs a signal the first time'); });
      return true;
    }
    if (name === 'stock-add') {
      var hit = (A().App.stockHits || [])[Number(el.dataset.i)];
      if (!hit) return true;
      DB.all('stock_items').then(function (items) {
        var found = (items || []).filter(function (it) { return it.code === hit.code; })[0];
        if (found) { A().toast('Already on the stock list'); return; }
        return DB.save('stock_items', {
          id: DB.uid(), code: hit.code, name: hit.gen, generic: hit.gen, unit: 'each', cost: hit.cost,
          reorder: 0, supplier: 'Plumblink Krugersdorp', cls: hit.cls || 'f', demo: false
        }).then(function () { return A().draw().then(function () { A().toast('Added ' + hit.gen); }); });
      });
      return true;
    }
    if (name === 'new-po') {
      ensurePlaces().then(function (places) {
        var wh = (places || []).filter(function (p) { return p.kind === 'warehouse'; })[0];
        var po = { id: DB.uid(), no: A().nextNo('APS-PO-'), supplier: 'Plumblink Krugersdorp', status: 'draft', place_id: wh ? wh.id : null, lines: [], demo: false };
        return DB.save('purchase_orders', po).then(function () { A().go('#/po/' + po.id); });
      });
      return true;
    }
    if (name === 'po-del') {
      DB.get('purchase_orders', el.dataset.id).then(function (po) {
        if (!po || po.status === 'received') return;
        po.lines.splice(Number(el.dataset.i), 1);
        return DB.save('purchase_orders', po);
      }).then(A().draw);
      return true;
    }
    if (name === 'po-receive') {
      DB.get('purchase_orders', el.dataset.id).then(function (po) {
        if (!po || po.status === 'received') return;
        if (!po.place_id) throw new Error('Choose a store to receive into');
        if (!po.lines || !po.lines.length) throw new Error('Add a line first');
        return po.lines.reduce(function (p, line) {
          return p.then(function () { return adjust(line.item_id, po.place_id, Number(line.qty) || 0, 'receive', null, po.no); });
        }, Promise.resolve()).then(function () {
          po.status = 'received';
          return DB.save('purchase_orders', po);
        });
      }).then(function () { return A().draw().then(function () { A().toast('Received'); }); }).catch(function (err) { A().toast(err.message || 'Could not receive'); });
      return true;
    }
    return false;
  }

  function form(id, node) {
    if (id === 'clientForm') {
      var name = node.name.value.trim();
      if (!name) { A().toast('Enter the name'); return true; }
      DB.save('clients', { id: DB.uid(), name: name, phone: node.phone.value.trim(), email: node.email.value.trim(), notes: node.notes.value.trim(), demo: false })
        .then(A().reload).then(A().draw).then(function () { A().toast('Client saved'); });
      return true;
    }
    if (id === 'contactForm') {
      var person = node.name.value.trim();
      if (!person) { A().toast('Enter the name'); return true; }
      DB.save('contacts', { id: DB.uid(), client_id: node.client_id.value, name: person, phone: node.phone.value.trim(), email: '', role: node.role.value.trim(), demo: false })
        .then(A().draw).then(function () { A().toast('Contact saved'); });
      return true;
    }
    if (id === 'siteForm') {
      var pin = pinFor(node.suburb.value);
      DB.save('sites', {
        id: DB.uid(), client_id: node.client_id.value, label: node.label.value.trim() || 'Site',
        address: node.address.value.trim(), suburb: node.suburb.value.trim(), notes: node.notes.value.trim(),
        lat: pin ? pin[0] : null, lng: pin ? pin[1] : null, demo: false
      }).then(A().reload).then(A().draw).then(function () { A().toast('Site saved'); });
      return true;
    }
    if (id === 'receiveForm') {
      var itemId = node.item_id.value;
      var qty = Number(node.qty.value);
      if (!itemId || !(qty > 0)) { A().toast('Choose an item and a quantity'); return true; }
      adjust(itemId, A().App.stockPlace, qty, 'receive', null, 'Received').then(function () { return A().draw().then(function () { A().toast('Stock updated'); }); })
        .catch(function (err) { A().toast(err.message); });
      return true;
    }
    if (id === 'transferForm') {
      var qtyT = Number(node.qty.value);
      if (!node.item_id.value || !(qtyT > 0)) { A().toast('Choose an item and a quantity'); return true; }
      if (node.from_id.value === node.to_id.value) { A().toast('Pick two different places'); return true; }
      adjust(node.item_id.value, node.from_id.value, -qtyT, 'transfer', null, 'Transfer out').then(function () {
        return adjust(node.item_id.value, node.to_id.value, qtyT, 'transfer', null, 'Transfer in');
      }).then(function () { return A().draw().then(function () { A().toast('Moved'); }); }).catch(function (err) { A().toast(err.message); });
      return true;
    }
    if (id === 'useForm') {
      var useQty = Number(node.qty.value);
      if (!node.item_id.value || !(useQty > 0)) { A().toast('Choose a part and a quantity'); return true; }
      adjust(node.item_id.value, node.place_id.value, -useQty, 'use', node.job_id.value, 'Used on the job')
        .then(function () { return A().draw().then(function () { A().toast('Taken off stock'); }); })
        .catch(function (err) { A().toast(err.message); });
      return true;
    }
    if (id === 'vanForm') {
      var user = A().team().filter(function (u) { return u.id === node.user_id.value; })[0];
      if (!user) return true;
      DB.save('places', { id: DB.uid(), name: 'Van - ' + user.name, kind: 'van', user_id: user.id, demo: false })
        .then(A().reload).then(A().draw).then(function () { A().toast('Van added'); });
      return true;
    }
    if (id === 'poHead') {
      DB.get('purchase_orders', node.id.value).then(function (po) {
        if (!po) return;
        po.supplier = node.supplier.value.trim() || 'Plumblink Krugersdorp';
        po.place_id = node.place_id.value || po.place_id;
        if (po.status === 'draft') po.status = 'ordered';
        return DB.save('purchase_orders', po);
      }).then(function () { return A().draw().then(function () { A().toast('Saved'); }); });
      return true;
    }
    if (id === 'poLineForm') {
      var qtyL = Number(node.qty.value);
      DB.get('purchase_orders', node.id.value).then(function (po) {
        return DB.get('stock_items', node.item_id.value).then(function (item) {
          if (!po || !item || !(qtyL > 0)) return;
          po.lines = po.lines || [];
          po.lines.push({ item_id: item.id, name: item.generic || item.name, qty: qtyL, cost: Number(item.cost) || 0 });
          return DB.save('purchase_orders', po);
        });
      }).then(A().draw);
      return true;
    }
    if (id === 'reportForm') {
      A().App.repFrom = node.from.value;
      A().App.repTo = node.to.value;
      A().draw();
      return true;
    }
    return false;
  }

  function onInput(t) {
    if (t.id === 'clientSearch') {
      A().App.clientQ = t.value;
      A().App.focusId = 'clientSearch';
      A().draw();
      return;
    }
    if (t.id === 'stockSearch') searchStock(t.value);
  }

  global.APSOffice = {
    routes: routes,
    view: view,
    act: act,
    form: form,
    onInput: onInput,
    linkClient: linkClient,
    cardExtra: cardExtra,
    pinFor: pinFor,
    mount: function () {
      if (A().App.route.name === 'map') mountMap();
      if (A().App.route.name === 'board') mountBoard();
    },
    unmount: function () {
      if (mapObj) { mapObj.remove(); mapObj = null; }
    }
  };
})(window);
