/* APS Quote Finale — Plumblink materials picker.
   Catalogue: ../field/items.json (Field App snapshot, not copied).
   Class list: aps-data.json. Tank kits: tank-booster.js.
   Client names stay generic. Per-item prices stay on this screen. */
(function () {
  "use strict";
  var ITEMS_URL = "../field/items.json";
  var DATA_URL = "aps-data.json?v=11";
  var TIERS = { low: { e: 20, p: 30, f: 40 }, high: { e: 25, p: 35, f: 45 } };
  var CLS_NAME = { e: "Expensive", p: "Pipe", f: "Fitting" };
  var GROUP_ORDER = ["tank", "pump", "filter", "bypass", "float", "overflow", "supply", "cover"];
  var CLIENT_BY_CODE = {
    "036583": ["tank", "950 L water tank"],
    "039425": ["tank", "1,000 L water tank"],
    "040047": ["tank", "2,750 L water tank"],
    "005542": ["tank", "2,500 L water tank"],
    "040048": ["tank", "5,050 L water tank"],
    "005543": ["tank", "5,000 L water tank"],
    "040536": ["pump", "0.37 kW booster pump"],
    "040537": ["pump", "0.75 kW booster pump"],
    "042467": ["pump", "0.75 kW booster pump"],
    "041561": ["pump", "1.1 kW booster pump"],
    "041562": ["pump", "1.5 kW booster pump"],
    "041277": ["filter", "Inline water filter"],
    "041281": ["filter", "Inline water filter"],
    "041289": ["filter", "Inline water filter"],
    "041278": ["filter", "Inline water filter"],
    "041284": ["filter", "Inline water filter"],
    "041292": ["filter", "Inline water filter"],
    "029864": ["bypass", "Mains bypass with non-return valve"],
    "029897": ["bypass", "Mains bypass with non-return valve"],
    "040024": ["bypass", "Mains bypass with non-return valve"],
    "035809": ["bypass", "Mains bypass with non-return valve"],
    "040381": ["bypass", "Mains bypass with non-return valve"],
    "041202": ["float", "Tank float valve"],
    "042133": ["float", "Tank float valve"],
    "041589": ["overflow", "Overflow pipe"],
    "000441": ["overflow", "Overflow pipe"],
    "002929": ["overflow", "Overflow pipe"],
    "041275": ["cover", "Pump cover"]
  };
  var KIT_META = {
    "1000-low": ["1,000 L", "Budget"], "1000-typ": ["1,000 L", "Typical"], "1000-high": ["1,000 L", "Premium"],
    "2500-low": ["2,500 L", "Budget"], "2500-typ": ["2,500 L", "Typical"], "2500-high": ["2,500 L", "Premium"],
    "5000-low": ["5,000 L", "Budget"], "5000-typ": ["5,000 L", "Typical"], "5000-high": ["5,000 L", "Premium"]
  };
  var KIT_ORDER = ["1000-low", "1000-typ", "1000-high", "2500-low", "2500-typ", "2500-high", "5000-low", "5000-typ", "5000-high"];
  var SYN = { valve: "valve", tap: "tap", loo: "toilet", wc: "toilet", jojo: "tank", geyser: "geyser", pipe: "pipe tube" };
  var BIG_CAT = /TANKS - |PUMPS|DOMESTIC GEYSERS|HEAT PUMPS|SOLAR CYLINDERS|GAS GEYSERS|GAS PRODUCTS|INSTANTANEOUS|COMPACT|STIEBEL/;
  var BIG_NAME = /TANK|PUMP|GEYSER|WATER HEATER/;

  var D = { items: null, byCode: null, snap: "", data: null, loading: null, dataLoading: null };
  var api = { getS: function () { return { mats: [], tier: "high" }; }, changed: function () {}, toast: function () {}, esc: function (s) { return String(s == null ? "" : s); }, R: function (n) { return "R " + n; } };
  var $ = function (id) { return document.getElementById(id); };

  var TYPES = [
    [/EARTH(ING)?\b.*BOND|BONDING KIT/, "earth bonding kit"],
    [/\bFLUE\b/, "flue kit"],
    [/TUBE STRAP|HOLDERBAT|SADDLE|PIPE CLIP|\bCLIP\b/, "pipe clip"],
    [/FLUX/, "soldering flux"],
    [/LAGGING|INSULATION/, "pipe lagging"],
    [/TOWEL RAIL|TOWEL RING|ROLL HOLDER|ROBE HOOK|SOAP (DISH|HOLDER)|TOWEL BAR/, "bathroom accessory"],
    [/WATER METER/, "water meter"],
    [/GRATE|GULLY|MANHOLE|RODDING/, "drain fitting"],
    [/SUCTION HOSE/, "pump suction hose kit"],
    [/PUMP COVER|PUMP HOUSING/, "pump cover"],
    [/PRESSURE (SWITCH|CONTROL(LER)?\b(?!.*VALVE))|FLOW CONTROL/, "pump pressure controller"],
    [/HEAT PUMP/, "heat pump"],
    [/SOLAR/, null, function (n) { return /GEYSER|CYLINDER/.test(n) ? "solar geyser" : null; }],
    [/GAS GEYSER|GAS WATER HEATER/, "gas water heater"],
    [/INSTANT WATER HEATER|INSTANTANEOUS/, "instant water heater"],
    [/DRIP TRAY OUTLET|TRAY OUTLET|DRT-FITT/, "drip tray outlet"],
    [/TRAY/, "geyser drip tray"],
    [/VACUUM (BREAKER|RELIEF)/, "vacuum breaker"],
    [/PCV|PRESSURE CONTROL|MULTI ?VALVE/, "pressure control valve"],
    [/PRESSURE REDUC|\bPRV\b/, "pressure reducing valve"],
    [/SAFETY VALVE|T ?& ?P VALVE|\bTP VALVE/, "safety valve"],
    [/DRAIN ?COCK/, "drain cock"],
    [/THERMOSTAT/, "geyser thermostat"],
    [/ELEMENT/, "geyser element"],
    [/ANODE/, "anode"],
    [/BLANKET/, "geyser blanket"],
    [/GEYSER/, null, function (n) { return /\d\s*L(T|ITRE)?\b/.test(n) && !/VALVE|KIT|TIMER/.test(n) ? "geyser" : null; }],
    [/SEPTIC/, "septic tank"],
    [/TANK/, null, function (n) { return /\d\s*L/.test(n) ? "water tank" : null; }],
    [/SUMP PUMP|DEWATERING/, "sump pump"],
    [/BOOSTER PUMP|CENTRIFUGAL PUMP/, "booster pump"],
    [/MACERATOR|GREY WATER PUMP|BLACK WATER PUMP/, "macerator pump"],
    [/CIRCULATING PUMP/, "circulating pump"],
    [/PUMP/, "pump"],
    [/FLOAT/, "float valve"],
    [/FILTER BRACKET/, "filter bracket"],
    [/BALL ?VALVE|BALL ?STOP|LEVER VALVE/, "ball valve"],
    [/GATE VALVE/, "gate valve"],
    [/NON[- ]?RETURN|CHECK VALVE/, "non-return valve"],
    [/ANGLE (REGULATING )?VALVE|ANGLE STOP/, "angle valve"],
    [/STOP ?COCK|STOP TAP/, "stopcock"],
    [/BIB ?COCK|BIB ?TAP|GARDEN TAP/, "garden tap"],
    [/BASIN MIXER/, "basin mixer"],
    [/SINK MIXER|KITCHEN MIXER/, "sink mixer"],
    [/BATH.*MIXER|SHOWER MIXER|BATH ?\/ ?SHOWER/, "bath / shower mixer"],
    [/MIXER/, "mixer"],
    [/\b[PS][- ]?TRAP\b/, "trap"],
    [/FLEXI|BRAIDED/, "flexible connector"],
    [/PAN CONNECTOR/, "pan connector"],
    [/CC SUITE|CLOSE[- ]COUPLE[D]? SUITE|TOILET SUITE|PAN & CIST/, "toilet suite"],
    [/TOILET SEAT|\bSEAT\b/, "toilet seat"],
    [/MECHANISM/, "cistern mechanism"],
    [/FILL VALVE|INLET VALVE/, "cistern fill valve"],
    [/CISTERN/, "cistern"],
    [/BASIN WASTE|CLICK.*WASTE|POP[- ]?UP/, "basin waste"],
    [/BOTTLE TRAP/, "bottle trap"],
    [/TRAP/, "trap"],
    [/WASTE/, "waste fitting"],
    [/VANITY/, "vanity unit"],
    [/BASIN/, "basin"],
    [/SINK/, "sink"],
    [/SHOWER (HEAD|ROSE|ARM)/, "shower head"],
    [/FILTER.*CARTRIDGE|CARTRIDGE.*(FILTER|MICRON)/, "filter cartridge"],
    [/CARTRIDGE/, "tap cartridge"],
    [/FILTER/, "filter housing"],
    [/WALL ?PLATE ELBOW/, "wall plate elbow"],
    [/REDUCING (COUPLER|SOCKET)/, "reducing coupler"],
    [/REDUCING BUSH|\bBUSH\b/, "reducing bush"],
    [/REDUC/, "reducer"],
    [/ELBOW/, "elbow"],
    [/BEND/, "bend"],
    [/\bTEE\b/, "tee"],
    [/JUNCTION/, "junction"],
    [/UNION/, "union"],
    [/NIPPLE/, "nipple"],
    [/COUPLER|COUPLING|SOCKET/, "coupler"],
    [/COLLAR|SLEEVE/, "rubber collar"],
    [/HOSE CLAMP|CLAMP/, "hose clamp"],
    [/TUBE STRAP|HOLDERBAT|SADDLE|CLIP|BRACKET/, "pipe clip"],
    [/ADAPTOR|ADAPTER|CONNECTOR/, "adaptor"],
    [/END CAP|STOP END|\bCAP\b|\bPLUG\b/, "end cap"],
    [/HOSE/, "hose"],
    [/THREAD.*TAPE|PTFE/, "thread seal tape"],
    [/SILICONE/, "silicone sealant"],
    [/SOLDER/, "solder"],
    [/CEMENT|SOLVENT/, "pipe cement"],
    [/FLUSH (PLATE|BUTTON|ACTUATOR)|ACTUATOR/, "flush plate"],
    [/\bBATH\b/, "bath"],
    [/SHOWER (DOOR|ENCLOSURE|SCREEN|TRAY)/, "shower enclosure"],
    [/VALVE/, "valve"],
    [/TAP\b/, "tap"],
    [/TUBE|PIPE/, "pipe"],
  ];
  function fmtNum(s) { var n = Number(s); return n >= 1000 ? n.toLocaleString("en-ZA").replace(/\u00a0/g, " ").replace(/ /g, ",") : String(n); }
  var NOSIZE = /drip tray|silicone|cement|solder|flux|thread seal tape|earth bonding|pan connector|toilet suite|toilet seat|cistern|^basin$|bath$|accessory|flue kit|lagging|^tap cartridge$/;
  function sizeOf(n, type) {
    var m;
    if (NOSIZE.test(type)) return "";
    if (/(^|\s)(geyser|water tank|septic tank|water heater|heat pump)$/.test(type) && (m = /(\d{2,5})\s*L(T|ITRE|TR)?\b/.exec(n))) return fmtNum(m[1]) + " L";
    if (/pump/.test(type) && (m = /(\d+(?:\.\d+)?)\s*KW/.exec(n))) return m[1] + " kW";
    if ((m = /(?<![\d.])(\d{2,3})\s*[xX]\s*(\d{1,3})(?![\d.\/])/.exec(n))) {
      if (/reduc|bush/.test(type) && m[1] !== m[2]) return m[1] + " x " + m[2] + "mm";
      return m[1] + "mm";
    }
    if ((m = /(?<![\d.])(\d{2,3})\s*[xX]\s*[\d.\/]+/.exec(n))) return m[1] + "mm";
    if ((m = /(?<![\d.])(\d{1,3})\s*MM\b/.exec(n))) return m[1] + "mm";
    if ((m = /(?<![\d.\/])(\d\/\d|\d \d\/\d)"/.exec(n))) return m[1] + '"';
    return "";
  }
  function genericName(name) {
    var n = String(name || "").toUpperCase();
    var type = "";
    for (var i = 0; i < TYPES.length; i++) {
      var t = TYPES[i];
      if (t[0].test(n)) { type = t[2] ? t[2](n) : t[1]; if (type) break; }
    }
    if (!type) return "Plumbing fitting";
    var size = sizeOf(n, type);
    var out = (size ? size + " " : "") + type;
    if (type === "pipe" && /X\s*(\d+(?:\.\d+)?)\s*M\b/.test(n)) out += " (" + /X\s*(\d+(?:\.\d+)?)\s*M\b/.exec(n)[1] + " m length)";
    return out.charAt(0).toUpperCase() + out.slice(1);
  }



  function normCls(c) { return c === "e" || c === "p" || c === "f" ? c : "f"; }
  function tierOf() { var t = api.getS().tier; return t === "low" ? "low" : "high"; }
  function rateFor(cls, t) { return TIERS[t === "low" ? "low" : "high"][normCls(cls)]; }
  function factor(cls, t) { return 1 + rateFor(cls, t) / 100; }
  function r2(n) { return Math.round((Number(n) || 0) * 100 + 1e-9) / 100; }
  function clsLabel(cls, t) { var c = normCls(cls); return CLS_NAME[c] + " +" + rateFor(c, t) + "%"; }
  function clientMeta(code) {
    var hit = CLIENT_BY_CODE[code];
    return hit ? { group: hit[0], clientLabel: hit[1] } : { group: "supply", clientLabel: "Supply pipe and fittings" };
  }
  function isBig(name, cat, cost) {
    return cost >= 1500 && BIG_CAT.test(cat) && BIG_NAME.test(name) && !/SPARES|HAND TOOLS|CONTROLLER/.test(cat + " " + name);
  }
  var CLS_MAP = null;
  function clsOf(code) {
    if (!CLS_MAP && D.data && D.data.cls) {
      CLS_MAP = {};
      ["e", "p"].forEach(function (k) { (D.data.cls[k] || []).forEach(function (c) { CLS_MAP[c] = k; }); });
    }
    return (CLS_MAP && CLS_MAP[code]) || "f";
  }
  function loadData() {
    if (D.data) return Promise.resolve(D.data);
    if (D.dataLoading) return D.dataLoading;
    D.dataLoading = fetch(DATA_URL).then(function (r) { if (!r.ok) throw new Error("aps-data " + r.status); return r.json(); })
      .then(function (j) { D.data = j; return j; })
      .catch(function (e) { D.dataLoading = null; throw e; });
    return D.dataLoading;
  }
  function loadItems() {
    if (D.items) return Promise.resolve(D.items);
    if (D.loading) return D.loading;
    D.loading = Promise.all([
      fetch(ITEMS_URL).then(function (r) { if (!r.ok) throw new Error("items " + r.status); return r.json(); }),
      loadData()
    ]).then(function (res) {
      var j = res[0], data = res[1], checks = data.checks || {}, names = data.names || {};
      D.snap = j.snap || data.snap || "";
      D.byCode = {};
      D.items = j.rows.map(function (r) {
        var cat = (j.cats[r[2]] || "").toUpperCase();
        var code = r[0], snapName = r[1], name = names[code] || snapName, cost = Number(r[3]) || 0, chk = checks[code];
        var it = { code: code, name: name, cat: cat, cost: cost, low: r[4] === 1, checked: "", out: false };
        if (chk) { it.cost = Number(chk[0]); it.checked = chk[1]; it.low = chk[2] === "L"; it.out = chk[2] === "O"; }
        it.big = isBig(name.toUpperCase(), cat, it.cost);
        it.cls = clsOf(code);
        it.gen = genericName(name);
        it.hay = (name + " " + (snapName !== name ? snapName + " " : "") + it.gen + " " + cat.split(" > ").slice(-1)[0] + " " + code).toLowerCase().replace(/(\d)\s+mm\b/g, "$1mm");
        D.byCode[code] = it;
        return it;
      });
      paintPriceDate();
      return D.items;
    }).catch(function (e) { D.loading = null; throw e; });
    return D.loading;
  }
  function paintPriceDate() {
    var el = $("plPriceDate");
    if (!el) return;
    if (!D.snap) { el.textContent = "Plumblink prices load when you search. High is the default: R750+ items 25%, pipe 35%, fittings 45%."; return; }
    var n = D.data && D.data.checks ? Object.keys(D.data.checks).length : 0;
    var tier = tierOf();
    el.textContent = "Plumblink prices as at " + D.snap + (n ? " · " + n + " items live-checked" : "") + " · " + (tier === "low" ? "Low 20/30/40%" : "High 25/35/45%") + ". Client quote shows generic names only.";
  }
  function normQ(q) { return String(q || "").toLowerCase().replace(/(\d)\s+mm\b/g, "$1mm").replace(/(\d)\s*l\b/g, "$1l").trim(); }
  function search(q, limit) {
    q = normQ(q);
    if (!q || !D.items) return [];
    var toks = q.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < D.items.length; i++) {
      var it = D.items[i], h = it.hay, score = 0, ok = true;
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k], alt = SYN[t], p = h.indexOf(t);
        if (p < 0 && alt) { var a = alt.split(" "); for (var z = 0; z < a.length && p < 0; z++) p = h.indexOf(a[z]); }
        if (p < 0) { ok = false; break; }
        score += (p === 0 || /[\s(\/-]/.test(h.charAt(p - 1))) ? 3 : 1;
        if (it.gen.toLowerCase().indexOf(t) >= 0) score += 2;
      }
      if (!ok) continue;
      if (it.code === q) score += 50;
      if (it.checked) score += 1.5;
      if (it.out) score -= 3;
      score -= it.name.length / 120;
      out.push([score, it]);
    }
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.slice(0, limit || 8).map(function (x) { return x[1]; });
  }
  function extCents(qty, cost) { return Math.round((Number(qty) || 0) * Math.round((Number(cost) || 0) * 100)); }
  function roundRatio(num, den) {
    var sign = num < 0 ? -1 : 1;
    var a = Math.abs(Math.round(num));
    return sign * Math.floor((a + Math.floor(den / 2)) / den);
  }
  function plainUnitCents(m) { return Math.round(r2((Number(m.cost) || 0) * factor(m.cls, tierOf())) * 100); }
  function matsCents() {
    var S = api.getS();
    var mats = S.mats || [];
    var kitNum = 0, plain = 0;
    mats.forEach(function (m) {
      if (!(Number(m.qty) > 0)) return;
      if (m.fromKit) kitNum += extCents(m.qty, m.cost) * (100 + rateFor(m.cls, tierOf()));
      else plain += plainUnitCents(m) * (Number(m.qty) || 0);
    });
    return roundRatio(kitNum, 100) + plain;
  }
  function lineCents() {
    var S = api.getS();
    var mats = S.mats || [];
    var total = matsCents();
    var parts = mats.map(function (m, i) {
      if (!(Number(m.qty) > 0)) return { i: i, base: 0, frac: 0 };
      if (!m.fromKit) return { i: i, base: plainUnitCents(m) * (Number(m.qty) || 0), frac: 0 };
      var num = extCents(m.qty, m.cost) * (100 + rateFor(m.cls, tierOf()));
      return { i: i, base: Math.floor(num / 100), frac: num % 100 };
    });
    var remain = total - parts.reduce(function (s, p) { return s + p.base; }, 0);
    if (remain > 0) {
      var order = parts.slice().sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });
      for (var k = 0; remain > 0 && k < order.length; k++) { order[k].base += 1; remain -= 1; }
    }
    return parts.map(function (p) { return p.base; });
  }
  function sum() { return matsCents() / 100; }
  function clientLines() {
    var mats = api.getS().mats || [];
    var kit = mats.filter(function (m) { return m.fromKit && Number(m.qty) > 0; });
    var out = [];
    if (kit.length) {
      var labelByGroup = {};
      kit.forEach(function (m) { if (labelByGroup[m.group] == null) labelByGroup[m.group] = m.clientLabel; });
      GROUP_ORDER.forEach(function (g) { if (labelByGroup[g]) out.push({ text: labelByGroup[g], showQty: false }); });
    }
    mats.forEach(function (m) {
      if (m.fromKit || !(Number(m.qty) > 0)) return;
      var text = String(m.gen || "").trim();
      if (!text) return;
      out.push({ text: text, qty: Number(m.qty), showQty: true });
    });
    return out;
  }
  function ensureMats() {
    var S = api.getS();
    if (!Array.isArray(S.mats)) S.mats = [];
    if (S.tier !== "low" && S.tier !== "high") S.tier = "high";
  }
  function addItem(it, qty) {
    ensureMats();
    var S = api.getS();
    var q = Math.max(0.01, Number(qty) || 1);
    var ex = S.mats.find(function (m) { return !m.fromKit && m.code === it.code; });
    if (ex) ex.qty = r2((Number(ex.qty) || 0) + q);
    else S.mats.push({ code: it.code, qty: q, cost: it.cost, cls: it.cls, gen: it.gen, pl: it.name, fromKit: false });
    api.changed();
    render();
    api.toast("Added: " + it.gen);
  }
  function applyKit(key) {
    var data = window.APS_TANK_KITS;
    var spec = data && data.kits ? data.kits[key] : null;
    if (!spec) { api.toast("Kit list is missing on this phone"); return; }
    var byCode = {};
    (data.items || []).forEach(function (it) { byCode[it.code] = it; });
    if (spec.some(function (line) { return !byCode[line.code]; })) { api.toast("Kit list is incomplete"); return; }
    ensureMats();
    var S = api.getS();
    S.mats = S.mats.filter(function (m) { return !m.fromKit; });
    spec.forEach(function (line) {
      var item = byCode[line.code];
      var meta = clientMeta(line.code);
      S.mats.push({
        code: line.code, qty: line.qty, cost: item.cost, cls: normCls(item.cls),
        gen: meta.clientLabel, pl: item.name, fromKit: true, group: meta.group, clientLabel: meta.clientLabel
      });
    });
    S.kitId = key;
    var tank = S.mats.find(function (m) { return m.fromKit && m.group === "tank"; });
    var pump = S.mats.find(function (m) { return m.fromKit && m.group === "pump"; });
    if (tank && pump && !String(S.desc || "").trim()) {
      S.desc = "Supply and install a " + tank.clientLabel + " and a " + pump.clientLabel + " as a backup water supply. Includes an inline water filter, tank float valve, overflow pipe, mains bypass with non-return valve, pump cover, and connection to the existing supply.";
      var d = $("f-desc"); if (d) d.value = S.desc;
    }
    if (!String(S.title || "").trim()) {
      S.title = "Tank + booster backup";
      var ti = $("f-title"); if (ti) ti.value = S.title;
    }
    api.changed();
    render();
    var meta = KIT_META[key];
    api.toast(meta ? meta[0] + " " + meta[1] + " kit loaded" : "Kit loaded");
  }
  function renderTier() {
    var tier = tierOf();
    document.querySelectorAll("#segTier button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.v === tier);
    });
    paintPriceDate();
  }
  function renderKits() {
    var host = $("kitGrid");
    if (!host) return;
    var cur = api.getS().kitId || "";
    host.innerHTML = KIT_ORDER.map(function (key) {
      var m = KIT_META[key];
      return '<button type="button" data-kit="' + key + '"' + (cur === key ? ' class="on"' : "") + ">" + api.esc(m[0]) + "<small>" + api.esc(m[1]) + "</small></button>";
    }).join("");
    host.querySelectorAll("[data-kit]").forEach(function (b) { b.onclick = function () { applyKit(b.dataset.kit); }; });
  }
  function renderLines() {
    var host = $("matLines");
    var note = $("matAuto");
    var n = $("nMats");
    if (!host) return;
    var mats = api.getS().mats || [];
    var cents = lineCents();
    if (n) n.textContent = String(mats.filter(function (m) { return Number(m.qty) > 0; }).length);
    if (!mats.length) host.innerHTML = '<div class="empty">No Plumblink items yet. Search above or add a tank kit. You can still type a materials total below.</div>';
    else host.innerHTML = mats.map(function (m, k) {
      var unit = m.fromKit ? "" : api.R(plainUnitCents(m) / 100) + " each";
      return '<div class="item"><div class="top"><div class="n">' + api.esc(m.gen || "Item") +
        '<div class="pl">' + api.esc(m.pl || "") + " · " + api.esc(clsLabel(m.cls, tierOf())) + (m.code ? " · " + api.esc(m.code) : "") + "</div></div>" +
        '<button class="x" type="button" data-k="' + k + '" aria-label="Remove">✕</button></div>' +
        '<div class="bot"><div class="qty"><button type="button" data-k="' + k + '" data-d="-1">−</button>' +
        '<input data-k="' + k + '" type="number" inputmode="decimal" min="0" step="any" value="' + api.esc(m.qty) + '">' +
        '<button type="button" data-k="' + k + '" data-d="1">+</button></div>' +
        '<div class="each">' + unit + "</div><div class=\"line\">" + api.R(cents[k] / 100) + "</div></div></div>";
    }).join("");
    host.querySelectorAll(".qty button").forEach(function (b) {
      b.onclick = function () {
        var m = api.getS().mats[b.dataset.k];
        m.qty = Math.max(0, r2((Number(m.qty) || 0) + Number(b.dataset.d)));
        if (m.qty === 0) api.getS().mats.splice(b.dataset.k, 1);
        api.changed(); render();
      };
    });
    host.querySelectorAll(".qty input").forEach(function (el) {
      el.onchange = function () {
        var m = api.getS().mats[el.dataset.k];
        m.qty = Math.max(0, Number(el.value) || 0);
        if (m.qty === 0) api.getS().mats.splice(el.dataset.k, 1);
        api.changed(); render();
      };
    });
    host.querySelectorAll(".x").forEach(function (b) {
      b.onclick = function () { api.getS().mats.splice(b.dataset.k, 1); api.changed(); render(); };
    });
    if (note) {
      var tier = tierOf() === "low" ? "Low" : "High";
      note.textContent = "List total after " + tier + " markup: " + api.R(sum()) + ". A typed total below is added on top. The client quote shows names and qty only.";
    }
  }
  function renderSearch(list, msg) {
    var host = $("plResults");
    if (!host) return;
    if (msg) { host.innerHTML = '<div class="empty">' + api.esc(msg) + "</div>"; return; }
    if (!list) { host.innerHTML = ""; return; }
    if (!list.length) { host.innerHTML = '<div class="empty">No Plumblink items match. Try another word, or type a materials total below.</div>'; return; }
    var t = tierOf();
    host.innerHTML = list.map(function (it) {
      var sell = r2(it.cost * factor(it.cls, t));
      return '<div class="job"><div class="n">' + api.esc(it.gen) +
        '<div class="meta">' + api.esc(it.name) + " · " + api.esc(clsLabel(it.cls, t)) + " · shelf " + api.R(it.cost) + (it.out ? " · out of stock" : "") + "</div></div>" +
        '<div class="p">' + api.R(sell) + '</div><div class="qty"><input type="number" min="1" step="1" value="1" aria-label="Qty"></div>' +
        '<button class="add" type="button" data-code="' + api.esc(it.code) + '" aria-label="Add">+</button></div>';
    }).join("");
    host.querySelectorAll(".add").forEach(function (b) {
      b.onclick = function () {
        var it = D.byCode[b.dataset.code];
        var qty = b.parentElement.querySelector("input");
        if (it) addItem(it, qty ? qty.value : 1);
      };
    });
  }
  var searchTimer = null;
  function runSearch() {
    var q = ($("plq") && $("plq").value || "").trim();
    if (q.length < 2) { renderSearch(null); return; }
    renderSearch(null, "Loading Plumblink prices…");
    loadItems().then(function () { renderSearch(search(($("plq") && $("plq").value) || "", 8)); })
      .catch(function () { renderSearch(null, "Plumblink list could not load. Type a materials total below."); });
  }
  function render() { ensureMats(); renderTier(); renderKits(); renderLines(); }
  function start(opts) {
    api = Object.assign(api, opts || {});
    ensureMats();
    document.querySelectorAll("#segTier button").forEach(function (b) {
      b.onclick = function () {
        var S = api.getS();
        S.tier = b.dataset.v === "low" ? "low" : "high";
        try { localStorage.setItem("aps-quote-markup-tier", S.tier); } catch (e) {}
        api.changed();
        render();
      };
    });
    var q = $("plq");
    if (q && !q.dataset.bound) {
      q.dataset.bound = "1";
      q.addEventListener("input", function () { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 160); });
      q.addEventListener("focus", function () { if (q.value.trim().length >= 2) runSearch(); });
    }
    render();
  }
  window.APSMat = { start: start, sum: sum, clientLines: clientLines, lineCents: lineCents, render: render, loadItems: loadItems, search: search };
})();
