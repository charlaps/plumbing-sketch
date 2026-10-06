/* APS Quote Helper — auto-pull add-on: Plumblink prices + APS labour rates.
 * Loaded after app.js. Talks to it through window.APSQuote (see app.js).
 * Data:
 *   ../field/items.json  — Plumblink catalogue shipped with the Field App (reused, not duplicated)
 *   aps-data.json        — APS job book labour rates, live price checks (override snapshot), typical kits
 * Client output never shows codes, brands, Plumblink names or per-item prices.
 */
(function () {
  "use strict";
  var Q = window.APSQuote;
  if (!Q) return;

  var ITEMS_URL = "../field/items.json";
  var DATA_URL = "aps-data.json";
  var MK_SMALL_KEY = "aps-quote-mk-small";
  var MK_BIG_KEY = "aps-quote-mk-big";
  var CALLOUT = 550;

  var D = { items: null, byCode: null, snap: "", data: null, loading: null, dataLoading: null };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100 + 1e-9) / 100; };
  var money = function (n) { return Q.money(n); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) { var p = String(iso || "").split("-"); if (p.length < 3) return iso || ""; return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0]; }

  /* ---------- markup ---------- */
  function mkSmall() { var v = Number(localStorage.getItem(MK_SMALL_KEY)); return [30, 35, 40].indexOf(v) >= 0 ? v : 30; }
  function mkBig() {
    if (typeof Q.getBigMarkup === "function") { var t = Number(Q.getBigMarkup()); if (t) return t; }
    var v = Number(localStorage.getItem(MK_BIG_KEY)); return [30, 25, 20].indexOf(v) >= 0 ? v : 30;
  }
  function factor(big) { return 1 + (big ? mkBig() : mkSmall()) / 100; }

  /* ---------- big-ticket rule: tanks, pumps, geysers ---------- */
  var BIG_CAT = /TANKS - |PUMPS|DOMESTIC GEYSERS|HEAT PUMPS|SOLAR CYLINDERS|GAS GEYSERS|GAS PRODUCTS|INSTANTANEOUS|COMPACT|STIEBEL/;
  var BIG_NAME = /TANK|PUMP|GEYSER|WATER HEATER/;
  function isBig(name, cat, cost) {
    return cost >= 1500 && BIG_CAT.test(cat) && BIG_NAME.test(name) && !/SPARES|HAND TOOLS|CONTROLLER/.test(cat + " " + name);
  }

  /* ---------- generic client names (no brand, code or material type) ---------- */
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

  /* ---------- data loading (lazy) ---------- */
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
    D.loading = Promise.all([fetch(ITEMS_URL).then(function (r) { if (!r.ok) throw new Error("items " + r.status); return r.json(); }), loadData()])
      .then(function (res) {
        var j = res[0], data = res[1], checks = data.checks || {};
        D.snap = j.snap || data.snap || "";
        D.byCode = {};
        D.items = j.rows.map(function (r) {
          var cat = (j.cats[r[2]] || "").toUpperCase();
          var code = r[0], name = r[1], cost = Number(r[3]) || 0, chk = checks[code];
          var it = { code: code, name: name, cat: cat, cost: cost, low: r[4] === 1, checked: "" };
          if (chk) { it.cost = Number(chk[0]); it.checked = chk[1]; it.low = chk[2] === "L"; it.out = chk[2] === "O"; }
          it.big = isBig(name.toUpperCase(), cat, it.cost);
          it.gen = genericName(name);
          it.hay = (name + " " + it.gen + " " + cat.split(" > ").slice(-1)[0] + " " + code).toLowerCase().replace(/(\d)\s+mm\b/g, "$1mm");
          D.byCode[code] = it;
          return it;
        });
        updatePriceDate();
        return D.items;
      })
      .catch(function (e) { D.loading = null; throw e; });
    return D.loading;
  }

  function updatePriceDate() {
    var el = $("plPriceDate");
    if (!el) return;
    if (!D.snap) { el.textContent = "Plumblink prices load when you search."; return; }
    var n = D.data && D.data.checks ? Object.keys(D.data.checks).length : 0;
    el.textContent = "Plumblink prices as at " + fmtDate(D.snap) + (n ? " · " + n + " items live-checked up to " + fmtDate(D.data.checked) : "") + " · incl VAT cost × APS markup";
  }

  /* ---------- search ---------- */
  var SYN = { valve: "valve", tap: "tap", loo: "toilet", wc: "toilet", jojo: "tank", geyser: "geyser", pipe: "pipe tube" };
  function norm(q) { return String(q || "").toLowerCase().replace(/(\d)\s+mm\b/g, "$1mm").replace(/(\d)\s*l\b/g, "$1l").trim(); }
  function search(q, limit) {
    q = norm(q);
    if (!q || !D.items) return [];
    var toks = q.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < D.items.length; i++) {
      var it = D.items[i], h = it.hay, score = 0, ok = true;
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k], alt = SYN[t];
        var p = h.indexOf(t);
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
    return out.slice(0, limit || 25).map(function (x) { return x[1]; });
  }

  /* ---------- material lines ---------- */
  function lineFromItem(it, qty) {
    return { src: "pl", desc: it.gen, qty: qty || 1, cost: r2(it.cost * factor(it.big)), code: it.code, pl: it.name, plc: it.cost, big: it.big ? 1 : 0, chk: it.checked || "" };
  }
  function bundleLine(desc, pairs) { // several Plumblink items priced into one generic line
    var parts = [], sum = 0, big = 0;
    pairs.forEach(function (p) {
      var it = D.byCode[p[1]]; if (!it) return;
      parts.push([p[0], it.code]); sum += p[0] * it.cost * factor(it.big); if (it.big) big = 1;
    });
    return { src: "pl", desc: desc, qty: 1, cost: r2(sum), bundle: parts, big: big };
  }
  function repriceLine(m) {
    if (m.manual || m.src !== "pl") return m; // only lines this add-on priced
    if (m.bundle && m.bundle.length) { var b = bundleLine(m.desc, m.bundle); m.cost = b.cost; return m; }
    if (m.code && D.byCode && D.byCode[m.code]) { var it = D.byCode[m.code]; m.plc = it.cost; m.big = it.big ? 1 : 0; m.cost = r2(it.cost * factor(it.big)); }
    else if (m.code && m.plc != null) m.cost = r2(m.plc * factor(m.big));
    return m;
  }
  function repriceAll() {
    var mats = Q.getMaterials();
    mats.forEach(repriceLine);
    Q.render();
  }

  /* ---------- kits ---------- */
  var PRESET_MAP = { // existing package lines → Plumblink codes ("*" = rest of the kit)
    geyser: [["036252"], ["002109", "003952"], ["001346", "001347"], ["*"]],
    basin: [[], ["040258"], ["032231", "032439"], ["*"]],
    toilet: [["040989", "039045"], ["042197"], ["034245"], ["039840", "041697"]],
    filter: [[], [], ["035809", "001668", "001043", "001679", "039837"], ["*"]],
  };
  function kitTotal(key) {
    var kit = D.data.kits[key]; var s = 0, c = 0;
    kit.l.forEach(function (p) { var it = D.byCode[p[1]]; if (it) { s += p[0] * r2(it.cost * factor(it.big)); c += p[0] * it.cost; } });
    return { sell: s, cost: c, n: kit.l.length };
  }
  function kitLines(key) {
    return D.data.kits[key].l.map(function (p) { var it = D.byCode[p[1]]; return it ? lineFromItem(it, p[0]) : null; }).filter(Boolean);
  }
  function fillPresetLines(preset) {
    var map = PRESET_MAP[preset]; if (!map || !D.data.kits[preset]) return 0;
    var kit = D.data.kits[preset].l, used = {}, mats = Q.getMaterials(), filled = 0;
    map.forEach(function (codes) { codes.forEach(function (c) { if (c !== "*") used[c] = 1; }); });
    map.forEach(function (codes, i) {
      var m = mats[i]; if (!m || m.cost) return;
      var pairs = [];
      if (codes[0] === "*") pairs = kit.filter(function (p) { return !used[p[1]]; });
      else pairs = kit.filter(function (p) { return codes.indexOf(p[1]) >= 0; });
      if (!pairs.length) { m.nopl = 1; return; }
      var b = bundleLine(m.desc, pairs);
      m.cost = b.cost; m.bundle = b.bundle; m.big = b.big; m.src = "pl"; filled++;
    });
    Q.render();
    return filled;
  }

  /* ---------- labour ---------- */
  var picked = []; // {j, r, u, co}
  function labourSum() { return picked.reduce(function (s, p) { return s + (Number(p.r) || 0); }, 0); }
  function syncLabour() {
    Q.setLabour(picked.length ? labourSum() : Q.getLabour());
    renderChips();
  }
  function renderChips() {
    var wrap = $("labourChips"); if (!wrap) return;
    if (!picked.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = picked.map(function (p, i) {
      return '<span class="lab-chip"><span class="lab-chip-name">' + esc(p.j) + '</span> <b>' + money(p.r) + '</b>' +
        (p.u ? ' <em class="badge-unconf internal-only" title="Yellow in the job book: not yet confirmed by Charl">unconfirmed</em>' : "") +
        ' <button type="button" class="lab-chip-x" data-unpick="' + i + '" aria-label="Remove">×</button></span>';
    }).join("") + (picked.length > 1 ? '<span class="lab-sum">Labour = ' + money(labourSum()) + "</span>" : "");
  }
  function pickJob(job, opts) {
    opts = opts || {};
    picked.push({ j: job.j, r: Number(job.r) || 0, u: job.u ? 1 : 0 });
    syncLabour();
    Q.saveExtra && Q.saveExtra({ labourJobs: picked });
    var maint = job.co === "Yes";
    var offer = $("plOffer");
    var html = "";
    if (maint && !opts.quiet) html += '<div class="offer-row"><span>Job book: call-out R' + CALLOUT + ' (Zone A weekday) applies.</span> <button type="button" class="btn-sm" data-callout="1">+ Call-out</button></div>';
    if (job.k && D.data.kits[job.k] && !opts.noKit) {
      var go = function () {
        var t = kitTotal(job.k);
        offer.innerHTML = html + '<div class="offer-row"><span>Typical materials for this job: <b>' + t.n + ' items</b>, APS ' + money(t.sell) +
          '<span class="internal-only"> (Plumblink ' + money(t.cost) + ")</span>.</span>" +
          ' <button type="button" class="btn-sm" data-kit="' + job.k + '" data-kmode="add">Add</button>' +
          ' <button type="button" class="btn-sm" data-kit="' + job.k + '" data-kmode="replace">Replace lines</button>' +
          ' <button type="button" class="btn-sm ghost" data-offer-close="1">No thanks</button></div>';
        offer.hidden = false;
      };
      loadItems().then(go, function () { offer.innerHTML = html; offer.hidden = !html; });
    } else { offer.innerHTML = html; offer.hidden = !html; }
    if (!opts.quiet) Q.toast("Labour from job book: " + money(job.r));
  }
  function labourSearch(q) {
    q = norm(q); var jobs = (D.data && D.data.jobs) || [];
    if (!q) return jobs.slice(0, 0);
    var toks = q.split(/\s+/);
    return jobs.map(function (j) {
      var h = (j.j + " " + j.c).toLowerCase(), s = 0;
      for (var i = 0; i < toks.length; i++) { var p = h.indexOf(toks[i]); if (p < 0) return null; s += p === 0 || h.charAt(p - 1) === " " ? 2 : 1; }
      return [s - j.j.length / 200, j];
    }).filter(Boolean).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 12).map(function (x) { return x[1]; });
  }

  /* ---------- UI ---------- */
  function injectUI() {
    // Materials: Plumblink search (internal view) + markup + price date
    var table = document.querySelector(".materials-table-wrap");
    var box = document.createElement("div");
    box.className = "pl-box no-print";
    box.innerHTML =
      '<div class="internal-only">' +
      '<label class="field pl-search-field"><span>Add from Plumblink</span>' +
      '<input type="search" id="plSearch" autocomplete="off" placeholder="Search e.g. 22mm ball valve, 150L geyser, code" enterkeyhint="search" /></label>' +
      '<ul class="pl-results" id="plResults" hidden></ul>' +
      '<div class="mk-row"><span>Markup</span>' +
      '<label>Small items <select id="mkSmall"><option>30</option><option>35</option><option>40</option></select>%</label>' +
      '<label id="mkBigWrap">Tanks, pumps &amp; geysers <select id="mkBig"><option>30</option><option>25</option><option>20</option></select>%</label></div>' +
      '<p class="hint pl-date" id="plPriceDate">Plumblink prices load when you search.</p>' +
      "</div>" +
      '<p class="hint client-only">Switch to <b>Internal</b> to add materials from Plumblink with prices filled in.</p>';
    table.parentNode.insertBefore(box, table);

    // Labour: job-book picker
    var lf = document.querySelector(".labour-field");
    var lb = document.createElement("div");
    lb.className = "lab-box no-print";
    lb.innerHTML =
      '<label class="field"><span>Labour from APS job book</span>' +
      '<input type="search" id="labSearch" autocomplete="off" placeholder="Search e.g. basin, geyser, toilet, tank" enterkeyhint="search" /></label>' +
      '<ul class="pl-results" id="labResults" hidden></ul>' +
      '<div class="lab-chips" id="labourChips"></div>' +
      '<div class="pl-offer" id="plOffer" hidden></div>';
    lf.parentNode.insertBefore(lb, lf);

    $("mkSmall").value = String(mkSmall());
    $("mkBig").value = String(mkBig());
    // If the tank-kit build already has a big-ticket selector, use that one and hide ours.
    if (typeof Q.getBigMarkup === "function") $("mkBigWrap").hidden = true;
  }

  function renderPlResults(list) {
    var ul = $("plResults");
    if (!list.length) { ul.innerHTML = '<li class="pl-empty">No Plumblink match. Try fewer words (e.g. "ball valve 22").</li>'; ul.hidden = false; return; }
    ul.innerHTML = list.map(function (it) {
      var sell = r2(it.cost * factor(it.big));
      return '<li><button type="button" class="pl-hit" data-code="' + esc(it.code) + '">' +
        '<span class="pl-gen">' + esc(it.gen) + (it.big ? ' <em class="badge-big">big ticket ' + mkBig() + '%</em>' : "") + "</span>" +
        '<span class="pl-name">' + esc(it.name) + " · " + esc(it.code) + "</span>" +
        '<span class="pl-price">Cost ' + money(it.cost) + " → APS <b>" + money(sell) + "</b>" +
        (it.checked ? ' <em class="badge-live">live ' + esc(fmtDate(it.checked).replace(/ \d{4}$/, "")) + "</em>" : "") +
        (it.low ? ' <em class="badge-low">low stock</em>' : "") + (it.out ? ' <em class="badge-low">out of stock</em>' : "") +
        "</span></button></li>";
    }).join("");
    ul.hidden = false;
  }
  function renderLabResults(list) {
    var ul = $("labResults");
    if (!list.length) { ul.innerHTML = '<li class="pl-empty">No job-book match.</li>'; ul.hidden = false; return; }
    ul.innerHTML = list.map(function (j, i) {
      return '<li><button type="button" class="pl-hit" data-job="' + esc(j.j) + '">' +
        '<span class="pl-gen">' + esc(j.j) + "</span>" +
        '<span class="pl-name">' + esc(j.c) + " · " + esc(j.t) + (j.p && j.p !== "1" ? " · " + esc(j.p) + " people" : "") + (j.k ? " · typical materials" : "") + "</span>" +
        '<span class="pl-price">APS labour <b>' + money(j.r) + "</b>" + (j.u ? ' <em class="badge-unconf internal-only">unconfirmed</em>' : "") +
        (j.co === "Yes" ? ' <em class="badge-live">+ call-out</em>' : "") + "</span></button></li>";
    }).join("");
    ul.hidden = false;
  }

  function bind() {
    var t1, t2;
    $("plSearch").addEventListener("focus", function () { loadItems().catch(function () { $("plPriceDate").textContent = "Couldn't load Plumblink prices (offline?). Type prices in by hand."; }); });
    $("plSearch").addEventListener("input", function (e) {
      clearTimeout(t1); var v = e.target.value;
      if (!v.trim()) { $("plResults").hidden = true; return; }
      t1 = setTimeout(function () { loadItems().then(function () { renderPlResults(search(v, 25)); }); }, 120);
    });
    $("plResults").addEventListener("click", function (e) {
      var b = e.target.closest("[data-code]"); if (!b) return;
      var it = D.byCode[b.dataset.code]; if (!it) return;
      Q.addMaterial(lineFromItem(it, 1));
      Q.toast(it.gen + " added · APS " + money(r2(it.cost * factor(it.big))));
      $("plSearch").value = ""; $("plResults").hidden = true;
    });
    $("mkSmall").addEventListener("change", function (e) { localStorage.setItem(MK_SMALL_KEY, e.target.value); repriceAll(); });
    $("mkBig").addEventListener("change", function (e) { localStorage.setItem(MK_BIG_KEY, e.target.value); repriceAll(); });
    if (typeof Q.onBigMarkupChange === "function") Q.onBigMarkupChange(function () { if (D.items) repriceAll(); });

    $("labSearch").addEventListener("focus", function () { loadData().catch(function () {}); });
    $("labSearch").addEventListener("input", function (e) {
      clearTimeout(t2); var v = e.target.value;
      if (!v.trim()) { $("labResults").hidden = true; return; }
      t2 = setTimeout(function () { loadData().then(function () { renderLabResults(labourSearch(v)); }); }, 80);
    });
    $("labResults").addEventListener("click", function (e) {
      var b = e.target.closest("[data-job]"); if (!b) return;
      var job = D.data.jobs.filter(function (j) { return j.j === b.dataset.job; })[0]; if (!job) return;
      $("labSearch").value = ""; $("labResults").hidden = true;
      pickJob(job);
    });
    $("labourChips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-unpick]"); if (!b) return;
      picked.splice(Number(b.dataset.unpick), 1);
      if (!picked.length) Q.setLabour("");
      syncLabour();
    });
    $("plOffer").addEventListener("click", function (e) {
      var k = e.target.closest("[data-kit]"), c = e.target.closest("[data-callout]"), x = e.target.closest("[data-offer-close]");
      if (k) {
        var lines = kitLines(k.dataset.kit);
        if (k.dataset.kmode === "replace") Q.setMaterials(lines); else lines.forEach(function (l) { Q.getMaterials().push(l); });
        Q.render();
        Q.toast(lines.length + " Plumblink items added");
        k.closest(".offer-row").remove();
      }
      if (c) { picked.push({ j: "Call-out (Zone A weekday)", r: CALLOUT, u: 0 }); syncLabour(); c.closest(".offer-row").remove(); }
      if (x) x.closest(".offer-row").remove();
      if (!$("plOffer").children.length) $("plOffer").hidden = true;
    });
    // A hand-typed unit price wins over Plumblink for that line.
    $("materialsBody").addEventListener("input", function (e) {
      var t = e.target; if (!t.dataset || t.dataset.f !== "cost") return;
      var m = Q.getMaterials()[Number(t.dataset.i)]; if (m && m.src === "pl") m.manual = 1;
    }, true);
    // Typing labour by hand clears the job-book link so totals follow what you typed.
    $("labour").addEventListener("input", function () { if (picked.length) { picked = []; renderChips(); } });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".pl-box")) $("plResults").hidden = true;
      if (!e.target.closest(".lab-box")) $("labResults").hidden = true;
    });
  }

  /* ---------- hooks from app.js ---------- */
  Q.hooks.afterRender = function (tbody, mats) {
    var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
    mats.forEach(function (m, i) {
      var tr = rows[i]; if (!tr) return;
      var meta = "";
      if (m.src !== "pl" && !m.nopl) return;
      if (m.code) meta = esc(m.pl || "") + " · " + esc(m.code) + " · cost " + money(m.plc) + " × " + (m.big ? mkBig() + "% big ticket" : mkSmall() + "%") + (m.chk ? " · live " + esc(fmtDate(m.chk).replace(/ \d{4}$/, "")) : "");
      else if (m.bundle) meta = "Plumblink: " + m.bundle.map(function (p) { var it = D.byCode && D.byCode[p[1]]; return p[0] + "× " + (it ? esc(it.gen) : p[1]) + " (" + p[1] + ")"; }).join(", ");
      else if (m.nopl) meta = "Not in the Plumblink kit — search above or type the price.";
      if (m.manual && (m.code || m.bundle)) meta += " · <b>price typed by hand</b>";
      if (meta) { tr.classList.add("has-meta"); tr.insertAdjacentHTML("afterend", '<tr class="pl-meta-row internal-only no-print"><td colspan="5"><div class="pl-meta">' + meta + "</div></td></tr>"); }
    });
  };
  Q.hooks.afterPreset = function (key) {
    picked = [];
    loadData().then(function (data) {
      var jn = data.preset && data.preset[key];
      var job = jn && data.jobs.filter(function (j) { return j.j === jn; })[0];
      if (job) pickJob(job, { noKit: true, quiet: true });
      return loadItems().then(function () {
        var n = fillPresetLines(key);
        var t = D.data.kits[key] ? kitTotal(key) : null;
        var offer = $("plOffer");
        if (t) {
          offer.insertAdjacentHTML("beforeend", '<div class="offer-row"><span>Package priced from Plumblink' + (job ? " + job-book labour " + money(job.r) : "") + '. Want every item listed instead (' + t.n + ' lines)?</span> <button type="button" class="btn-sm" data-kit="' + key + '" data-kmode="replace">Itemise</button> <button type="button" class="btn-sm ghost" data-offer-close="1">Keep short</button></div>');
          offer.hidden = false;
        }
        Q.toast("Package loaded — prices & labour filled from Plumblink / job book");
      });
    }).catch(function () { Q.toast("Package loaded — fill costs & labour"); });
  };
  Q.hooks.afterLoad = function (q) { picked = Array.isArray(q && q.labourJobs) ? q.labourJobs.slice() : []; renderChips(); };
  Q.hooks.extraForm = function () { return { labourJobs: picked.slice() }; };
  Q.hooks.afterNew = function () { picked = []; renderChips(); var o = $("plOffer"); o.innerHTML = ""; o.hidden = true; };

  // Expose for tests / other add-ons
  window.APSAutoPrice = { genericName: genericName, isBig: isBig, loadItems: loadItems, loadData: loadData, search: search, kitTotal: kitTotal, factor: factor, D: D };

  injectUI();
  bind();
  Q.render();
})();
