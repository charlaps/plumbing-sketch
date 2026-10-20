/* Sample company so the office screens are not empty. Rows are marked demo and can be removed. */
(function (global) {
  'use strict';

  var STORES = ['jobs', 'quotes', 'invoices', 'cards', 'clients', 'sites', 'contacts', 'places', 'stock_items', 'stock_levels', 'stock_moves', 'purchase_orders', 'checkins'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function day(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function at(offset, h, m) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(h, m || 0, 0, 0);
    return d.toISOString();
  }

  function wipe() {
    return STORES.reduce(function (chain, store) {
      return chain.then(function () {
        return DB.all(store).then(function (rows) {
          return (rows || []).reduce(function (p, row) {
            if (!row.demo) return p;
            return p.then(function () { return DB.remove(store, row.id); });
          }, Promise.resolve());
        });
      });
    }, Promise.resolve());
  }

  function put(store, row) {
    row.demo = true;
    return DB.save(store, row);
  }

  function labour(name, qty) {
    var src = APSRates.BYNAME[name];
    if (!src) {
      var keys = Object.keys(APSRates.BYNAME);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(name) === 0) { src = APSRates.BYNAME[keys[i]]; break; }
      }
    }
    if (!src) throw new Error('Missing rate: ' + name);
    return {
      id: DB.uid(), kind: 'labour', name: src.j, generic: APSRates.labourGeneric(src.j),
      qty: qty || 1, each: src.l, co: src.co || 'No'
    };
  }

  function material(name, cost, qty) {
    return {
      id: DB.uid(), kind: 'material', name: name, generic: name, qty: qty || 1,
      cost: cost, cls: 'e', each: APSRates.sell(cost, 'e', 'high'), co: 'No'
    };
  }

  function quote(job, items, status, date) {
    var q = {
      id: DB.uid(), no: 'APS-Q-DEMO-' + job.no.slice(-4), job_id: job.id, items: items,
      ah: false, cons: true, tier: 'high', mat_typed: 0,
      not_included: 'Tiling, building, plaster, paint, electrical work, and any client-supplied items.',
      date: date, valid_days: 14, status: status, approval_token: DB.token(),
      created_by: job.created_by, demo: true
    };
    var t = APSRates.totals(q);
    q.public = {
      v: 1, id: q.id, t: q.approval_token, no: q.no, date: q.date, valid_days: 14,
      client: job.client_name, phone: job.phone || '', email: job.email || '',
      addr: [job.address, job.suburb].filter(Boolean).join(', '),
      title: job.title, scope: APSRates.scopeLines(q),
      mat: t.mat, cons: t.cons, labour: t.labourAll, total: t.total, dep: t.dep, bal: t.bal,
      labour_label: APSRates.labourLabel(t), not_included: q.not_included, status: status
    };
    job.quote_id = q.id;
    return { q: q, t: t };
  }

  function invoice(job, q, t, status, date) {
    var inv = {
      id: DB.uid(), no: 'APS-I-DEMO-' + job.no.slice(-4), job_id: job.id, quote_id: q.id,
      status: status, pay_link: status === 'paid' ? '' : 'https://pay.yoco.com/aps-demo',
      date: date, scope: APSRates.scopeLines(q), totals: t, labour_label: APSRates.labourLabel(t),
      deposit_paid: status === 'paid' || status === 'partial',
      client_name: job.client_name, title: job.title,
      addr: [job.address, job.suburb].filter(Boolean).join(', '),
      created_by: job.created_by, demo: true
    };
    job.invoice_id = inv.id;
    return inv;
  }

  function seed() {
    return DB.all('users').then(function (users) {
      var people = (users || []).filter(function (u) { return u.active !== false; });
      var owner = people.filter(function (u) { return u.role === 'owner'; })[0] || people[0];
      var plumber = people.filter(function (u) { return u.role === 'plumber'; })[0] || owner;
      if (!owner) throw new Error('Set up a login first');

      var anna = { id: DB.uid(), name: 'Anna Venter', phone: '0825550101', email: 'anna.example@email.com', notes: 'Prefers morning calls. Geyser is in the ceiling.' };
      var sipho = { id: DB.uid(), name: 'Sipho Dlamini', phone: '0835550102', email: '', notes: 'Gate code on the job notes.' };
      var body = { id: DB.uid(), name: 'West Rand Body Corporate', phone: '0115550103', email: 'trustees@example.co.za', notes: 'Invoice the trustees, not the tenant.' };
      var priya = { id: DB.uid(), name: 'Priya Naidoo', phone: '0845550104', email: '', notes: 'Quote sent. Waiting on approval.' };
      var kobus = { id: DB.uid(), name: 'Kobus Meyer', phone: '0725550105', email: '', notes: 'Paid last week. Keep as a reference job.' };

      var sites = [
        { id: DB.uid(), client_id: anna.id, label: 'Home', address: '14 Rustenburg Road', suburb: 'Krugersdorp', lat: -26.095, lng: 27.770, notes: 'Ceiling geyser, trap door in the passage.' },
        { id: DB.uid(), client_id: sipho.id, label: 'Home', address: '8 Ontdekkers Road', suburb: 'Roodepoort', lat: -26.120, lng: 27.870, notes: '' },
        { id: DB.uid(), client_id: body.id, label: 'Block A', address: '1 Van Wyk Street', suburb: 'Krugersdorp', lat: -26.102, lng: 27.800, notes: 'Common passage leak.' },
        { id: DB.uid(), client_id: body.id, label: 'Block B', address: '3 Van Wyk Street', suburb: 'Krugersdorp', lat: -26.108, lng: 27.792, notes: 'New leak reported. Not quoted yet.' },
        { id: DB.uid(), client_id: priya.id, label: 'Home', address: '22 Hill Street', suburb: 'Randburg', lat: -26.143, lng: 27.978, notes: '' },
        { id: DB.uid(), client_id: kobus.id, label: 'Home', address: '5 Commissioner Street', suburb: 'Krugersdorp', lat: -26.078, lng: 27.762, notes: '' }
      ];
      var contacts = [
        { id: DB.uid(), client_id: body.id, name: 'Elsabe Kruger', phone: '0825550199', email: 'elsabe@example.co.za', role: 'Trustee' },
        { id: DB.uid(), client_id: anna.id, name: 'Anna Venter', phone: '0825550101', email: '', role: 'Owner' }
      ];

      function job(no, client, site, status, title, who, start, end) {
        return {
          id: DB.uid(), no: no, status: status, client_name: client.name, phone: client.phone, email: client.email || '',
          address: site.address, suburb: site.suburb, title: title, scope: title,
          notes: client.notes, assigned_to: who ? who.id : null, start_at: start || null, end_at: end || null,
          client_id: client.id, site_id: site.id, lat: site.lat, lng: site.lng,
          wa_log: [], created_by: owner.id, demo: true
        };
      }

      var j1 = job('APS-J-DEMO-A01', anna, sites[0], 'booked', 'Replace 150 L geyser', plumber, at(0, 8), at(0, 11));
      var j2 = job('APS-J-DEMO-A02', sipho, sites[1], 'progress', 'Burst pipe under the basin', plumber, at(0, 10, 30), at(0, 12));
      var j3 = job('APS-J-DEMO-A03', body, sites[2], 'invoiced', 'Passage leak, block A', owner, at(-18, 9), at(-18, 12));
      var j4 = job('APS-J-DEMO-A04', body, sites[3], 'lead', 'Damp wall, block B', null, null, null);
      var j5 = job('APS-J-DEMO-A05', priya, sites[4], 'quoted', 'Bathroom point, first and second fix', owner, null, null);
      var j6 = job('APS-J-DEMO-A06', kobus, sites[5], 'paid', 'Replace kitchen mixer', plumber, at(-6, 9), at(-6, 10));

      var q1 = quote(j1, [labour('Full geyser replacement 100'), material('150 L geyser', 4800, 1), labour('Geyser plumbing CoC')], 'approved', day(-2));
      var q2 = quote(j2, [labour('Repair / fault-finding labour (per hour)', 2)], 'approved', day(0));
      var q3 = quote(j3, [labour('Leak repair in ceiling (accessible, excl. ceiling repair)'), material('22mm coupler', 45, 2)], 'approved', day(-20));
      var q5 = quote(j5, [labour('Bathroom point (strip-out, first fix and second fix)')], 'sent', day(-16));
      var q6 = quote(j6, [labour('Replace kitchen mixer (standard deck)')], 'approved', day(-8));

      var i3 = invoice(j3, q3.q, q3.t, 'sent', day(-16));
      var i6 = invoice(j6, q6.q, q6.t, 'paid', day(-5));

      var wh = { id: DB.uid(), name: 'APS store - Krugersdorp', kind: 'warehouse', user_id: null };
      var van = { id: DB.uid(), name: 'Van - ' + plumber.name, kind: 'van', user_id: plumber.id };
      var items = [
        { id: DB.uid(), code: 'GEY150', name: '150 L geyser', generic: '150 L geyser', unit: 'each', cost: 4800, reorder: 1, supplier: 'Plumblink Krugersdorp', cls: 'e' },
        { id: DB.uid(), code: 'VB22', name: '22mm vacuum breaker', generic: '22mm vacuum breaker', unit: 'each', cost: 86, reorder: 4, supplier: 'Plumblink Krugersdorp', cls: 'f' },
        { id: DB.uid(), code: 'CU22', name: '22mm copper pipe', generic: '22mm copper pipe', unit: 'm', cost: 38, reorder: 10, supplier: 'Plumblink Krugersdorp', cls: 'p' },
        { id: DB.uid(), code: 'AV15', name: '15mm angle valve', generic: '15mm angle valve', unit: 'each', cost: 42, reorder: 6, supplier: 'Plumblink Krugersdorp', cls: 'f' }
      ];
      function level(item, place, qty) {
        return { id: DB.uid(), item_id: item.id, place_id: place.id, qty: qty };
      }
      var levels = [
        level(items[0], wh, 2), level(items[1], wh, 1), level(items[2], wh, 40), level(items[3], wh, 0),
        level(items[1], van, 2), level(items[3], van, 4), level(items[2], van, 8)
      ];
      var move = { id: DB.uid(), item_id: items[3].id, place_id: van.id, qty: -1, job_id: j2.id, kind: 'use', note: 'Used on the basin repair' };
      var po = {
        id: DB.uid(), no: 'APS-PO-DEMO-01', supplier: 'Plumblink Krugersdorp', status: 'draft', place_id: wh.id,
        lines: [{ item_id: items[1].id, name: items[1].name, qty: 10, cost: 86 }]
      };
      var check = { id: DB.uid(), user_id: plumber.id, job_id: j2.id, lat: -26.1204, lng: 27.8704, accuracy: 18 };

      var card2 = { id: j2.id, job_id: j2.id, notes: 'Isolated the line. Client is home.', signature: '', signed_name: '', signed_at: null, elapsed_ms: 75 * 60 * 1000, running_since: null };
      var card6 = { id: j6.id, job_id: j6.id, notes: 'New mixer fitted. Tested hot and cold.', signature: '', signed_name: 'Kobus Meyer', signed_at: at(-6, 10), elapsed_ms: 50 * 60 * 1000, running_since: null };

      var rows = [
        ['clients', anna], ['clients', sipho], ['clients', body], ['clients', priya], ['clients', kobus]
      ];
      sites.forEach(function (s) { rows.push(['sites', s]); });
      contacts.forEach(function (c) { rows.push(['contacts', c]); });
      [j1, j2, j3, j4, j5, j6].forEach(function (j) { rows.push(['jobs', j]); });
      [q1, q2, q3, q5, q6].forEach(function (pair) { rows.push(['quotes', pair.q]); });
      rows.push(['invoices', i3], ['invoices', i6], ['cards', card2], ['cards', card6]);
      rows.push(['places', wh], ['places', van]);
      items.forEach(function (it) { rows.push(['stock_items', it]); });
      levels.forEach(function (lv) { rows.push(['stock_levels', lv]); });
      rows.push(['stock_moves', move], ['purchase_orders', po], ['checkins', check]);

      return rows.reduce(function (p, pair) {
        return p.then(function () { return put(pair[0], pair[1]); });
      }, Promise.resolve());
    });
  }

  function show() {
    return DB.all('jobs').then(function (jobs) {
      if ((jobs || []).some(function (j) { return j.demo; })) return DB.put('meta', { id: 'demo_on', on: true });
      return seed().then(function () { return DB.put('meta', { id: 'demo_on', on: true }); });
    });
  }

  function hide() {
    return wipe().then(function () { return DB.put('meta', { id: 'demo_on', on: false }); });
  }

  global.APSDemo = { show: show, hide: hide };
})(window);
