/* On-phone store. Every screen reads and writes through here. */
(function (global) {
  'use strict';
  var NAME = 'aps-job-manager';
  var VERSION = 1;
  var dbp = null;
  var SYNC = { jobs: 1, quotes: 1, invoices: 1, cards: 1 };

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('This phone cannot store jobs offline.'));
        return;
      }
      var req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        ['users', 'jobs', 'quotes', 'invoices', 'cards', 'photos', 'outbox', 'meta'].forEach(function (name) {
          if (db.objectStoreNames.contains(name)) return;
          var os = db.createObjectStore(name, { keyPath: 'id' });
          if (name === 'jobs') os.createIndex('by_status', 'status', { unique: false });
          if (name === 'photos' || name === 'quotes' || name === 'invoices') {
            os.createIndex('by_job', 'job_id', { unique: false });
          }
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbp = null; reject(req.error || new Error('Could not open the job store')); };
    });
    return dbp;
  }

  function run(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, mode);
      var req;
      var settled = false;
      function ok(v) { if (settled) return; settled = true; resolve(v); }
      function bad(err) { if (settled) return; settled = true; reject(err || new Error('The phone store failed')); }
      try { req = fn(tx.objectStore(store)); }
      catch (err) { bad(err); return; }
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { bad(req.error || new Error('The phone store rejected a save')); };
      tx.onabort = function () { bad(tx.error || new Error('The phone store aborted a save')); };
      });
    });
  }

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function token() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  var DB = {
    open: open,
    uid: uid,
    token: token,
    all: function (store) { return run(store, 'readonly', function (os) { return os.getAll(); }); },
    get: function (store, id) { return run(store, 'readonly', function (os) { return os.get(id); }); },
    put: function (store, row) { return run(store, 'readwrite', function (os) { return os.put(row); }).then(function () { return row; }); },
    del: function (store, id) { return run(store, 'readwrite', function (os) { return os.delete(id); }); },
    save: function (store, row) {
      var now = new Date().toISOString();
      row.updated_at = now;
      if (!row.created_at) row.created_at = now;
      return DB.put(store, row).then(function () {
        if (!SYNC[store] || !global.APSSync || !APSSync.configured()) return row;
        return DB.put('outbox', {
          id: uid(), table: store, op: 'upsert', row_id: row.id, at: now
        }).then(function () {
          APSSync.kick();
          return row;
        });
      });
    },
    remove: function (store, id) {
      return DB.del(store, id).then(function () {
        if (!SYNC[store] || !global.APSSync || !APSSync.configured()) return;
        return DB.put('outbox', {
          id: uid(), table: store, op: 'delete', row_id: id, at: new Date().toISOString()
        }).then(function () { APSSync.kick(); });
      });
    },
    clearBusiness: function () {
      var stores = ['jobs', 'quotes', 'invoices', 'cards', 'photos', 'outbox'];
      return stores.reduce(function (p, store) {
        return p.then(function () {
          return DB.all(store).then(function (rows) {
            return (rows || []).reduce(function (q, row) {
              return q.then(function () { return DB.del(store, row.id); });
            }, Promise.resolve());
          });
        });
      }, Promise.resolve());
    }
  };

  global.DB = DB;
})(window);
