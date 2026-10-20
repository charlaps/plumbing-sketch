/* Quote Finale writes localStorage aps_jm_bridge. This phone imports it into Job Manager.
   Same quote id updates the same job. A job that has moved on stays at its stage. */
(function (global) {
  'use strict';
  var KEY = 'aps_jm_bridge';

  function A() { return global.APSJM; }

  function readBag() {
    try {
      var bag = JSON.parse(localStorage.getItem(KEY) || '{}');
      return bag && typeof bag === 'object' ? bag : {};
    } catch (e) {
      return {};
    }
  }

  function norm(s) { return String(s || '').trim().toLowerCase(); }

  function quoteByFinale(id) {
    var quotes = A().App.quotes || {};
    var keys = Object.keys(quotes);
    for (var i = 0; i < keys.length; i++) {
      if (quotes[keys[i]].finale_id === id) return quotes[keys[i]];
    }
    return null;
  }

  function findImport(env) {
    if (!env || !A() || !A().App) return null;
    var quotes = A().App.quotes || {};
    var keys = Object.keys(quotes);
    var i, q;
    if (env.quote_id) {
      for (i = 0; i < keys.length; i++) {
        q = quotes[keys[i]];
        if (q.id === env.quote_id) return q;
      }
    }
    if (env.import_id) {
      for (i = 0; i < keys.length; i++) {
        q = quotes[keys[i]];
        if (q.import_id && q.import_id === env.import_id) return q;
      }
    }
    return null;
  }

  function moneyStamp(q) {
    var t = global.APSRates.totals(q || {});
    var items = (q && q.items || []).map(function (i) {
      return [i.kind, i.name, i.generic, i.qty, i.each, i.co];
    });
    return JSON.stringify([t.total, items, !!(q && q.ah), !(q && q.cons === false), Number(q && q.disc) || 0, q && q.callout_lock, Number(q && q.mat_typed) || 0]);
  }

  function remember(list, row) {
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === row.id) { list[i] = row; return; }
    list.unshift(row);
  }

  function clientFor(env) {
    var name = String(env.client || '').trim() || 'Client';
    var found = (A().App.clients || []).filter(function (c) { return norm(c.name) === norm(name); })[0];
    if (found) {
      var patch = false;
      if (!found.phone && env.phone) { found.phone = env.phone; patch = true; }
      if (!found.email && env.email) { found.email = env.email; patch = true; }
      if (!patch) return Promise.resolve(found);
      return DB.save('clients', found).then(function (row) {
        remember(A().App.clients, row);
        return row;
      });
    }
    var client = {
      id: DB.uid(), name: name, phone: env.phone || '', email: env.email || '', notes: '', demo: false
    };
    return DB.save('clients', client).then(function (row) {
      A().App.clients.push(row);
      return row;
    });
  }

  function siteFor(client, env) {
    var address = String(env.address || '').trim();
    var suburb = String(env.suburb || '').trim();
    var found = (A().App.sites || []).filter(function (s) {
      return s.client_id === client.id && norm(s.address) === norm(address) && norm(s.suburb) === norm(suburb);
    })[0];
    if (found) return Promise.resolve(found);
    var pin = global.APSOffice && global.APSOffice.pinFor ? global.APSOffice.pinFor(suburb) : null;
    var site = {
      id: DB.uid(), client_id: client.id, label: suburb || 'Site', address: address, suburb: suburb,
      lat: pin ? pin[0] : null, lng: pin ? pin[1] : null, notes: '', demo: false
    };
    return DB.save('sites', site).then(function (row) {
      A().App.sites.push(row);
      return row;
    });
  }

  function applyQuote(quote, env, job) {
    var changedMoney = quote.finale_at && quote.finale_at !== env.updated_at;
    quote.no = env.no || quote.no;
    quote.job_id = job.id;
    quote.items = env.items || [];
    quote.ah = !!env.ah;
    quote.cons = env.cons !== false;
    quote.tier = env.tier === 'low' ? 'low' : 'high';
    quote.mat_typed = Number(env.mat_typed) || 0;
    quote.not_included = env.not_included || '';
    quote.date = env.date || quote.date;
    quote.valid_days = 14;
    quote.disc = Number(env.disc) || 0;
    quote.callout_lock = (env.callout_lock == null || env.callout_lock === '') ? null : Number(env.callout_lock);
    quote.finale_id = env.finale_id;
    quote.finale_at = env.updated_at || '';
    quote.demo = false;
    if (!quote.approval_token) quote.approval_token = DB.token();
    if (!quote.created_by) quote.created_by = A().App.user.id;
    if (changedMoney && (quote.status === 'approved' || quote.status === 'sent')) {
      quote.status = 'draft';
      quote.approval_token = DB.token();
      quote.approved_at = null;
      quote.declined_at = null;
    }
    if (!quote.status) quote.status = 'draft';
    return quote;
  }

  function importOne(env) {
    if (!env || !env.finale_id) return Promise.resolve(false);
    var existing = quoteByFinale(env.finale_id);
    var job = existing ? A().jobById(existing.job_id) : null;
    if (existing && job && existing.finale_at === env.updated_at) return Promise.resolve(false);
    return clientFor(env).then(function (client) {
      return siteFor(client, env).then(function (site) {
        var created = !job;
        if (!job) {
          job = {
            id: DB.uid(), no: A().nextNo('APS-J-'), status: 'quoted', wa_log: [],
            created_by: A().App.user.id, demo: false
          };
        }
        job.client_name = client.name;
        job.phone = env.phone || client.phone || '';
        job.email = env.email || client.email || '';
        job.address = site.address || '';
        job.suburb = site.suburb || '';
        job.client_id = client.id;
        job.site_id = site.id;
        job.title = env.title || job.title || 'Plumbing work';
        job.scope = env.scope || '';
        if (site.lat != null && job.lat == null) { job.lat = site.lat; job.lng = site.lng; }
        if (created) job.status = 'quoted';
        job.demo = false;
        var quote = existing || {
          id: DB.uid(), status: 'draft', approval_token: DB.token(), created_by: A().App.user.id
        };
        applyQuote(quote, env, job);
        job.quote_id = quote.id;
        return DB.save('jobs', job).then(function (savedJob) {
          remember(A().App.jobs, savedJob);
          return DB.save('quotes', quote);
        }).then(function (savedQuote) {
          A().App.quotes[savedQuote.id] = savedQuote;
          return true;
        });
      });
    });
  }

  function applyImported(quote, env, job) {
    var before = moneyStamp(quote);
    var hadStatus = quote.status;
    quote.no = env.no || quote.no || A().nextNo('APS-Q-');
    quote.job_id = job.id;
    quote.items = (env.items || []).map(function (line) {
      var copy = {};
      var k;
      for (k in line) if (Object.prototype.hasOwnProperty.call(line, k)) copy[k] = line[k];
      if (!copy.id) copy.id = DB.uid();
      return copy;
    });
    quote.ah = !!env.ah;
    quote.cons = env.cons !== false;
    quote.tier = env.tier === 'low' ? 'low' : 'high';
    quote.mat_typed = Number(env.mat_typed) || 0;
    quote.not_included = env.not_included == null ? '' : env.not_included;
    quote.date = env.date || quote.date || A().todayISO();
    quote.valid_days = env.valid_days || 14;
    quote.disc = Number(env.disc) || 0;
    quote.callout_lock = (env.callout_lock == null || env.callout_lock === '') ? null : Number(env.callout_lock);
    quote.description = env.description || '';
    if (env.import_id) quote.import_id = env.import_id;
    quote.demo = false;
    if (!quote.approval_token) quote.approval_token = DB.token();
    if (!quote.created_by) quote.created_by = A().App.user.id;
    if (before !== moneyStamp(quote) && (hadStatus === 'approved' || hadStatus === 'sent' || hadStatus === 'declined')) {
      quote.status = 'draft';
      quote.approval_token = DB.token();
      quote.approved_at = null;
      quote.declined_at = null;
    }
    if (!quote.status) quote.status = 'draft';
    return quote;
  }

  function importPayload(env) {
    if (!A() || !A().App || !A().App.user) return Promise.reject(new Error('Sign in on this phone first'));
    if (!env || (!env.quote_id && !env.import_id)) return Promise.reject(new Error('This quote has no id'));
    var existing = findImport(env);
    var job = existing ? A().jobById(existing.job_id) : null;
    return clientFor(env).then(function (client) {
      return siteFor(client, env).then(function (site) {
        var created = !job;
        if (!job) {
          job = {
            id: DB.uid(), no: A().nextNo('APS-J-'), status: 'quoted', wa_log: [],
            created_by: A().App.user.id, demo: false
          };
        }
        job.client_name = client.name;
        job.phone = env.phone || client.phone || '';
        job.email = env.email || client.email || '';
        job.address = site.address || '';
        job.suburb = site.suburb || '';
        job.client_id = client.id;
        job.site_id = site.id;
        job.title = env.title || job.title || 'Plumbing work';
        job.scope = env.description || '';
        if (site.lat != null && job.lat == null) { job.lat = site.lat; job.lng = site.lng; }
        if (created || job.status === 'lead') job.status = 'quoted';
        job.demo = false;
        var quote = existing || {
          id: env.quote_id || DB.uid(), status: 'draft', approval_token: DB.token(), created_by: A().App.user.id
        };
        applyImported(quote, env, job);
        job.quote_id = quote.id;
        if (A().buildPublic) quote.public = A().buildPublic(quote, job);
        return DB.save('jobs', job).then(function (savedJob) {
          remember(A().App.jobs, savedJob);
          return DB.save('quotes', quote).then(function (savedQuote) {
            A().App.quotes[savedQuote.id] = savedQuote;
            return { job: savedJob, quote: savedQuote, updated: !!existing };
          });
        });
      });
    });
  }

  function importAll() {
    if (!A() || !A().App || !A().App.user) return Promise.resolve(false);
    var bag = readBag();
    var quotes = bag.quotes || {};
    var ids = Object.keys(quotes);
    if (!ids.length) return Promise.resolve(false);
    return ids.reduce(function (chain, id) {
      return chain.then(function (changed) {
        return importOne(quotes[id]).then(function (did) { return changed || did; });
      });
    }, Promise.resolve(false));
  }

  global.APSBridge = { importAll: importAll, quoteByFinale: quoteByFinale, findImport: findImport, importPayload: importPayload };
})(window);
