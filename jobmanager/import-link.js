/* Open #import=<base64url JSON> on this phone. Confirm, then create or update one Quoted job.
   Plain JSON, gzip, zlib deflate, or raw deflate. The phone recalculates the money. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.APSImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var NOT_INCL = 'Tiling, building, plaster, paint, electrical work, and any client-supplied items.';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var MAX = 500000;

  function rates() {
    if (typeof APSRates !== 'undefined') return APSRates;
    return require('./rates.js');
  }

  function b64urlToBytes(s) {
    s = String(s || '').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!s) throw new Error('This import link is empty');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) throw new Error('This import link is not valid');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
    return out;
  }

  function looksLikeJson(bytes) {
    var i = 0;
    while (i < bytes.length && (bytes[i] === 32 || bytes[i] === 9 || bytes[i] === 10 || bytes[i] === 13)) i++;
    return bytes[i] === 0x7b;
  }

  function inflate(bytes, format) {
    if (typeof DecompressionStream !== 'function') {
      return Promise.reject(new Error('This phone cannot open a compressed quote link'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  function textOf(bytes) {
    if (bytes.length > MAX) throw new Error('This import link is too large');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function decode(payload) {
    var bytes;
    try { bytes = b64urlToBytes(payload); }
    catch (err) { return Promise.reject(err.message ? err : new Error('This import link is not valid')); }
    if (bytes.length > MAX) return Promise.reject(new Error('This import link is too large'));
    var step;
    if (looksLikeJson(bytes)) step = Promise.resolve(bytes);
    else if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) step = inflate(bytes, 'gzip');
    else if (bytes[0] === 0x78) step = inflate(bytes, 'deflate');
    else step = inflate(bytes, 'deflate-raw');
    return step.then(function (out) {
      var data;
      try { data = JSON.parse(textOf(out)); }
      catch (err) { throw new Error('This import link could not be read'); }
      return normalize(data);
    }).catch(function (err) {
      if (err && /import link|quote has|quote items|labour or materials/i.test(err.message || '')) throw err;
      throw new Error('This import link could not be read');
    });
  }

  function num(v, fallback) {
    if (v == null || v === '') return fallback;
    var n = +v;
    return isFinite(n) ? n : fallback;
  }

  function mapItem(raw, tier) {
    if (!raw || typeof raw !== 'object') return null;
    var kind = raw.kind === 'material' || raw.kind === 'labour' ? raw.kind : 'labour';
    var name = String(raw.name || raw.j || '').trim();
    if (!name) return null;
    var R = rates();
    var qty = num(raw.qty != null ? raw.qty : raw.q, 1);
    var each;
    if (raw.each != null && raw.each !== '') each = num(raw.each, 0);
    else if (raw.l != null && raw.l !== '') each = num(raw.l, 0);
    else if (kind === 'material' && raw.cost != null && raw.cost !== '') each = R.sell(num(raw.cost, 0), raw.cls || 'f', tier);
    else each = 0;
    var generic = raw.generic != null && String(raw.generic).trim()
      ? String(raw.generic).trim()
      : (kind === 'material' ? materialGeneric(R, name) : R.labourGeneric(name));
    var item = {
      kind: kind,
      name: name,
      generic: generic || name,
      qty: qty,
      each: each,
      co: raw.co == null ? '' : String(raw.co)
    };
    if (kind === 'material' && raw.cost != null && raw.cost !== '') item.cost = num(raw.cost, 0);
    if (kind === 'material' && raw.cls) item.cls = String(raw.cls);
    if (raw.id) item.id = String(raw.id);
    return item;
  }

  function materialGeneric(R, name) {
    var g = R.genericName(name);
    if (!g || g === 'Plumbing fitting') return name;
    return g;
  }

  function hasWork(env) {
    var items = env.items || [];
    for (var i = 0; i < items.length; i++) {
      if ((+items[i].qty || 0) > 0) return true;
    }
    return num(env.mat_typed, 0) > 0;
  }

  function normalize(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This quote could not be read');
    var id = String(data.id || data.import_id || '').trim();
    if (!id) throw new Error('This quote has no id');
    if (!Array.isArray(data.items) && data.items != null) throw new Error('Quote items must be a list');
    var tier = data.tier === 'low' ? 'low' : 'high';
    var items = [];
    (data.items || []).forEach(function (raw) {
      var line = mapItem(raw, tier);
      if (line) items.push(line);
    });
    var notInc;
    if (Object.prototype.hasOwnProperty.call(data, 'not_included')) notInc = data.not_included == null ? '' : String(data.not_included);
    else if (Object.prototype.hasOwnProperty.call(data, 'notinc')) notInc = data.notinc == null ? '' : String(data.notinc);
    else notInc = NOT_INCL;
    var lock = data.callout_lock;
    var env = {
      quote_id: UUID.test(id) ? id : '',
      import_id: UUID.test(id) ? '' : id,
      no: String(data.no || '').trim(),
      date: String(data.date || '').trim(),
      client: String(data.client || data.name || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      address: String(data.address || data.addr || '').trim(),
      suburb: String(data.suburb || data.area || '').trim(),
      title: String(data.title || data.type || '').trim(),
      description: String(data.description != null ? data.description : (data.desc != null ? data.desc : (data.scope || ''))).trim(),
      items: items,
      ah: !!data.ah,
      cons: data.cons !== false,
      tier: tier,
      mat_typed: num(data.mat_typed, 0),
      disc: num(data.disc, 0),
      callout_lock: (lock == null || lock === '') ? null : num(lock, 0),
      not_included: notInc,
      valid_days: num(data.valid_days, 14) || 14,
      days: num(data.days, 0),
      men: (data.men == null || data.men === '') ? 3 : (num(data.men, 3) || 3)
    };
    if (!hasWork(env)) throw new Error('This quote has no labour or materials');
    return env;
  }

  function peek(env) {
    var existing = (typeof APSBridge !== 'undefined' && APSBridge.findImport) ? APSBridge.findImport(env) : null;
    var t = rates().totals(env);
    return { updating: !!existing, total: t.total, dep: t.dep, totals: t };
  }

  function apply(env) {
    if (typeof APSBridge === 'undefined' || !APSBridge.importPayload) {
      return Promise.reject(new Error('Job Manager is not ready'));
    }
    return APSBridge.importPayload(env);
  }

  return { decode: decode, normalize: normalize, peek: peek, apply: apply, NOT_INCL: NOT_INCL };
});
