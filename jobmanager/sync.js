/* Sync queue. Does nothing until config.js has a Supabase URL and anon key.
   Last save wins. Photos upload separately into the job-photos bucket. */
(function (global) {
  'use strict';
  var client = null;
  var kicking = false;
  var again = false;
  var TABLES = ['jobs', 'quotes', 'invoices', 'cards'];

  function cfg() { return global.APS_JM || {}; }

  function configured() {
    var url = String(cfg().SUPABASE_URL || '').trim();
    var key = String(cfg().SUPABASE_ANON_KEY || '').trim();
    return url.indexOf('https://') === 0 && key.length > 20;
  }

  function loadLib() {
    if (global.supabase && global.supabase.createClient) return Promise.resolve(global.supabase);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.async = true;
      s.onload = function () {
        if (global.supabase && global.supabase.createClient) resolve(global.supabase);
        else reject(new Error('Sync library loaded but could not start.'));
      };
      s.onerror = function () { reject(new Error('Could not reach the sync service. The phone copy is still safe.')); };
      document.head.appendChild(s);
    });
  }

  function getClient() {
    if (!configured()) return Promise.resolve(null);
    if (client) return Promise.resolve(client);
    return loadLib().then(function (lib) {
      client = lib.createClient(String(cfg().SUPABASE_URL).trim(), String(cfg().SUPABASE_ANON_KEY).trim(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      return client;
    });
  }

  function cleanId(v) { return v ? v : null; }

  function toRemote(table, row) {
    if (table === 'jobs') {
      return {
        id: row.id, no: row.no, status: row.status || 'lead',
        client_name: row.client_name || '', phone: row.phone || '', email: row.email || '',
        address: row.address || '', suburb: row.suburb || '', title: row.title || '',
        scope: row.scope || '', notes: row.notes || '',
        assigned_to: cleanId(row.assigned_to), start_at: row.start_at || null, end_at: row.end_at || null,
        quote_id: cleanId(row.quote_id), invoice_id: cleanId(row.invoice_id),
        wa_log: row.wa_log || [], created_by: cleanId(row.created_by),
        created_at: row.created_at, updated_at: row.updated_at
      };
    }
    if (table === 'quotes') {
      return {
        id: row.id, no: row.no, job_id: row.job_id, status: row.status || 'draft',
        approval_token: row.approval_token || null,
        approved_at: row.approved_at || null, declined_at: row.declined_at || null,
        created_by: cleanId(row.created_by), created_at: row.created_at, updated_at: row.updated_at,
        body: {
          items: row.items || [], ah: !!row.ah, cons: row.cons !== false, tier: row.tier || 'high',
          mat_typed: Number(row.mat_typed) || 0, not_included: row.not_included || '',
          date: row.date || null, valid_days: row.valid_days || 14, public: row.public || null
        }
      };
    }
    if (table === 'invoices') {
      return {
        id: row.id, no: row.no, job_id: row.job_id, quote_id: cleanId(row.quote_id),
        status: row.status || 'draft', pay_link: row.pay_link || '',
        created_by: cleanId(row.created_by), created_at: row.created_at, updated_at: row.updated_at,
        body: {
          date: row.date || null, scope: row.scope || [], totals: row.totals || {},
          deposit_paid: !!row.deposit_paid, client_name: row.client_name || '',
          title: row.title || '', addr: row.addr || ''
        }
      };
    }
    return {
      job_id: row.job_id || row.id,
      notes: row.notes || '', signature: row.signature || '',
      signed_name: row.signed_name || '', signed_at: row.signed_at || null,
      timer: { elapsed_ms: row.elapsed_ms || 0, running_since: row.running_since || null },
      updated_at: row.updated_at
    };
  }

  function fromRemote(table, row) {
    if (table === 'quotes') {
      var b = row.body || {};
      return {
        id: row.id, no: row.no, job_id: row.job_id, status: row.status,
        approval_token: row.approval_token, approved_at: row.approved_at, declined_at: row.declined_at,
        created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at,
        items: b.items || [], ah: !!b.ah, cons: b.cons !== false, tier: b.tier || 'high',
        mat_typed: b.mat_typed || 0, not_included: b.not_included || '',
        date: b.date, valid_days: b.valid_days || 14, public: b.public || null
      };
    }
    if (table === 'invoices') {
      var body = row.body || {};
      return {
        id: row.id, no: row.no, job_id: row.job_id, quote_id: row.quote_id, status: row.status,
        pay_link: row.pay_link || '', created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at,
        date: body.date, scope: body.scope || [], totals: body.totals || {},
        deposit_paid: !!body.deposit_paid, client_name: body.client_name || '',
        title: body.title || '', addr: body.addr || ''
      };
    }
    if (table === 'cards') {
      var timer = row.timer || {};
      return {
        id: row.job_id, job_id: row.job_id, notes: row.notes || '', signature: row.signature || '',
        signed_name: row.signed_name || '', signed_at: row.signed_at || null,
        elapsed_ms: timer.elapsed_ms || 0, running_since: timer.running_since || null,
        updated_at: row.updated_at, created_at: row.updated_at
      };
    }
    return row;
  }

  function remoteTable(table) { return table === 'cards' ? 'job_cards' : table; }

  function newer(a, b) {
  var da = Date.parse(a || '');
  var db = Date.parse(b || '');
  if (isNaN(da)) return false;
  if (isNaN(db)) return true;
  return da > db;
}

  function flush() {
    return getClient().then(function (sb) {
      if (!sb) return;
      return DB.all('outbox').then(function (items) {
        items = (items || []).slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        return items.reduce(function (chain, item) {
          return chain.then(function () { return pushOne(sb, item); });
        }, Promise.resolve());
      });
    });
  }

  function pushOne(sb, item) {
    var table = remoteTable(item.table);
    var op;
    if (item.op === 'delete') {
      var col = item.table === 'cards' ? 'job_id' : 'id';
      op = sb.from(table).delete().eq(col, item.row_id);
    } else {
      op = DB.get(item.table, item.row_id).then(function (row) {
        if (!row) return { error: null };
        return sb.from(table).upsert(toRemote(item.table, row));
      });
    }
    return Promise.resolve(op).then(function (res) {
      if (res && res.error) {
        var err = new Error(res.error.message || 'Sync was refused');
        err.item = item;
        throw err;
      }
      return DB.del('outbox', item.id);
    });
  }

  function pull() {
    return getClient().then(function (sb) {
      if (!sb) return;
      return DB.get('meta', 'last_pull').then(function (meta) {
        var since = (meta && meta.value) || '1970-01-01T00:00:00.000Z';
        return DB.all('outbox').then(function (pending) {
          var dirty = {};
          (pending || []).forEach(function (p) { dirty[p.table + ':' + p.row_id] = 1; });
          var max = since;
          return TABLES.reduce(function (chain, table) {
            return chain.then(function () {
              return sb.from(remoteTable(table)).select('*').gte('updated_at', since).then(function (res) {
                if (res.error) throw new Error(res.error.message || 'Could not fetch ' + table);
                var rows = res.data || [];
                return rows.reduce(function (p, remote) {
                  if (remote.updated_at && remote.updated_at > max) max = remote.updated_at;
                  var localRow = fromRemote(table, remote);
                  var key = table + ':' + localRow.id;
                  if (dirty[key]) return p;
                  return p.then(function () {
                    return DB.get(table, localRow.id).then(function (local) {
                      if (local && !newer(remote.updated_at, local.updated_at)) return;
                      return DB.put(table, localRow);
                    });
                  });
                }, Promise.resolve());
              });
            });
          }, Promise.resolve()).then(function () {
            return pullPhotos(sb).then(function () {
              return DB.put('meta', { id: 'last_pull', value: max });
            });
          });
        });
      });
    });
  }

  function pullPhotos(sb) {
    return sb.from('photos').select('*').then(function (res) {
      if (res.error || !res.data) return;
      return res.data.reduce(function (p, row) {
        return p.then(function () {
          return DB.get('photos', row.id).then(function (local) {
            if (local || !row.storage_path) return;
            return sb.storage.from('job-photos').download(row.storage_path).then(function (file) {
              if (file.error || !file.data) return;
              return DB.put('photos', {
                id: row.id, job_id: row.job_id, blob: file.data,
                caption: row.caption || '', created_at: row.created_at, updated_at: row.created_at
              });
            });
          });
        });
      }, Promise.resolve());
    });
  }

  function uploadPhoto(photo) {
    if (!configured()) return Promise.resolve(false);
    return getClient().then(function (sb) {
      if (!sb) return false;
      return sb.auth.getSession().then(function (sess) {
        var session = sess.data && sess.data.session;
        if (!session) return false;
        var path = session.user.id + '/' + photo.job_id + '/' + photo.id + '.jpg';
        return sb.storage.from('job-photos').upload(path, photo.blob, {
          contentType: photo.blob.type || 'image/jpeg', upsert: true
        }).then(function (up) {
          if (up.error) throw new Error(up.error.message || 'Photo upload failed');
          return sb.from('photos').upsert({
            id: photo.id, job_id: photo.job_id, storage_path: path,
            caption: photo.caption || '', created_at: photo.created_at || new Date().toISOString()
          });
        }).then(function (row) {
          if (row.error) throw new Error(row.error.message || 'Photo record failed');
          return true;
        });
      });
    });
  }

  function uploadPending() {
    if (!configured()) return Promise.resolve();
    return DB.all('photos').then(function (rows) {
      var pending = (rows || []).filter(function (p) { return p.pending && p.blob; });
      return pending.reduce(function (chain, photo) {
        return chain.then(function () {
          return uploadPhoto(photo).then(function (ok) {
            if (!ok) return;
            photo.pending = false;
            return DB.put('photos', photo);
          }).catch(function () {});
        });
      }, Promise.resolve());
    });
  }

  function queueAll(profileIds) {
    var allowed = null;
    if (profileIds) {
      allowed = {};
      profileIds.forEach(function (id) { allowed[id] = 1; });
    }
    return TABLES.reduce(function (chain, table) {
      return chain.then(function () {
        return DB.all(table).then(function (rows) {
          return (rows || []).reduce(function (p, row) {
            return p.then(function () {
              if (table === 'jobs' && allowed && row.assigned_to && !allowed[row.assigned_to]) {
                row.assigned_to = null;
                return DB.put('jobs', row);
              }
              return null;
            }).then(function () {
              return DB.put('outbox', {
                id: DB.uid(), table: table, op: 'upsert', row_id: row.id, at: new Date().toISOString()
              });
            });
          }, Promise.resolve());
        });
      });
    }, Promise.resolve());
  }

  function kick() {
    if (!configured()) return;
    if (kicking) { again = true; return; }
    kicking = true;
    flush().then(function () { return uploadPending(); }).then(function () { return pull(); }).then(function () {
      return DB.del('meta', 'sync_error');
    }).catch(function (err) {
      return DB.put('meta', { id: 'sync_error', message: (err && err.message) || 'Sync failed', at: new Date().toISOString() });
    }).then(function () {
      kicking = false;
      if (again) { again = false; kick(); }
      if (global.APSApp && APSApp.onSync) APSApp.onSync();
    });
  }

  function status() {
    if (!configured()) return Promise.resolve({ mode: 'local', label: 'On this phone' });
    return Promise.all([DB.all('outbox'), DB.get('meta', 'sync_error')]).then(function (pair) {
      var n = (pair[0] || []).length;
      var err = pair[1];
      if (global.navigator && navigator.onLine === false) {
        return { mode: 'cloud', label: n ? ('Waiting to sync (' + n + ')') : 'Offline copy' };
      }
      if (err && err.message) return { mode: 'cloud', label: 'Sync problem', error: err.message };
      return { mode: 'cloud', label: n ? ('Syncing (' + n + ')') : 'Synced' };
    });
  }

  function decide(tokenValue, decision) {
    if (!configured()) return Promise.resolve(null);
    return getClient().then(function (sb) {
      if (!sb) return null;
      return sb.rpc('decide_quote', { tok: tokenValue, decision: decision }).then(function (res) {
        if (res.error) return { ok: false, error: res.error.message };
        return res.data;
      });
    });
  }

  function fetchQuote(tokenValue) {
    if (!configured()) return Promise.resolve(null);
    return getClient().then(function (sb) {
      if (!sb) return null;
      return sb.rpc('quote_for_token', { tok: tokenValue }).then(function (res) {
        if (res.error) return null;
        return res.data;
      });
    });
  }

  global.APSSync = {
    configured: configured,
    client: getClient,
    kick: kick,
    flush: flush,
    pull: pull,
    uploadPhoto: uploadPhoto,
    queueAll: queueAll,
    status: status,
    decide: decide,
    fetchQuote: fetchQuote
  };
})(window);
