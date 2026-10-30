/* APS Quote Finale — Tender mode.
   Bills of quantities for big jobs. No VAT.
   A bundled rate library at data/rate-library.json is loaded when it is there. */
(function () {
  "use strict";
  var HOURLY = 650, MAN_DAY = 1600, CREW_DAY = 4800, CREW_MEN = 3;
  var LIBKEY = "aps_tender_library";
  var JOBKEY = "aps_tenders";
  var CURKEY = "aps_tender_current";
  var view = "job";
  var cat = null;
  var P = null;

  function money(n) {
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    var s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) * 100 + 1e-8) / 100;
  }
  function R(n) {
    var v = money(n), sign = v < 0 ? "-" : "";
    return "R " + sign + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function factorOf(cost, pipe) {
    if ((Number(cost) || 0) >= 750) return 1.25;
    return pipe ? 1.35 : 1.45;
  }
  function toast(m) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = m;
    t.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("on"); }, 1600);
  }

  function seedLibrary() {
    function L(code, catName, desc, unit, labour, notes) {
      return {
        code: code, category: catName, description: desc, unit: unit,
        material_cost: 0, material_sell: 0, labour_hrs: 0, labour_R: labour, unit_rate: labour,
        source_codes: "", notes: notes || "Price book, full rates 27 Oct 2026", status: "ok"
      };
    }
    return {
      meta: {
        labour_R_per_h: HOURLY,
        markup: { expensive_from: 750, expensive: 0.25, pipe: 0.35, fitting: 0.45 },
        consumables: 0.05,
        crew_day_R: CREW_DAY,
        men_per_crew: CREW_MEN,
        man_day_R: MAN_DAY,
        vat: 0
      },
      items: [
        L("FF-PT", "Labour", "First fix per point", "point", 1000, "Price book. Strip-out is separate."),
        L("PT-FULL", "Labour", "Full point (strip, first fix and second fix)", "point", 2000),
        L("GEY-150", "Labour", "150 L geyser swap, labour", "no", 3250),
        L("COC", "Labour", "Geyser certificate of compliance", "no", 850),
        L("P22", "Pipe", "22 mm pipe per metre installed", "m", 0, "Example pipe run. Fittings per metre are P22F."),
        L("P22F", "Pipe", "22 mm fittings per metre", "m", 0, "Added with P22."),
        {
          code: "PR-CON", category: "Prelims", description: "Contingency", unit: "%",
          material_cost: 0, material_sell: 0, labour_hrs: 0, labour_R: 0, unit_rate: 0,
          source_codes: "", notes: "Percent of the subtotal before consumables.", status: "ok"
        }
      ]
    };
  }

  function loadLib() {
    try {
      var j = JSON.parse(localStorage.getItem(LIBKEY) || "null");
      if (j && Array.isArray(j.items) && j.items.length) return j;
    } catch (e) {}
    return seedLibrary();
  }
  function saveLib(lib) {
    try { localStorage.setItem(LIBKEY, JSON.stringify(lib)); } catch (e) { toast("Could not save the rate library on this phone"); }
  }
  var library = loadLib();

  function normaliseImport(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) throw new Error("This file has no items list");
    var meta = data.meta && typeof data.meta === "object" ? data.meta : seedLibrary().meta;
    var items = data.items.map(function (raw) {
      var it = {
        code: String(raw.code || "").trim(),
        category: String(raw.category || ""),
        description: String(raw.description || raw.desc || ""),
        unit: String(raw.unit || "no"),
        material_cost: Number(raw.material_cost) || 0,
        material_sell: Number(raw.material_sell) || 0,
        labour_hrs: Number(raw.labour_hrs) || 0,
        labour_R: Number(raw.labour_R) || 0,
        unit_rate: Number(raw.unit_rate) || 0,
        source_codes: String(raw.source_codes || ""),
        notes: String(raw.notes || ""),
        status: String(raw.status || "ok")
      };
      if (!it.code) it.code = "R" + uid();
      if (it.status === "TBC") it.unit_rate = 0;
      return it;
    });
    return { meta: meta, items: items };
  }

  function mergeLibrary(data, replace) {
    var incoming = normaliseImport(data);
    if (replace) {
      library = incoming;
    } else {
      var by = {};
      library.items.forEach(function (it) { by[it.code] = it; });
      incoming.items.forEach(function (it) { by[it.code] = it; });
      library.meta = incoming.meta || library.meta;
      library.items = Object.keys(by).map(function (k) { return by[k]; });
    }
    saveLib(library);
    return library.items.length;
  }

  function tryBundled() {
    fetch("data/rate-library.json").then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (j) {
      if (!j) return;
      var had = false;
      try { had = !!localStorage.getItem(LIBKEY); } catch (e) {}
      if (had) return;
      mergeLibrary(j, true);
      if (document.getElementById("s-tender") && document.getElementById("s-tender").classList.contains("on")) render();
    }).catch(function () {});
  }

  function blankProject() {
    return {
      id: uid(),
      name: "",
      client: "",
      site: "",
      units: 1,
      ducts: 1,
      pay: "deposit",
      schedule: [{ name: "To start", pct: 40 }, { name: "At mid-point", pct: 40 }, { name: "On completion", pct: 20 }],
      prelims: { scaffold: 0, establish: 0, travel: 0, contingency: 0 },
      excluded: "Scaffolding, tiling, and building work.",
      time: { crews: 1, men: 3, menLock: false, days: 0, months: 0, extraCrewDays: 0 },
      sections: [
        { id: uid(), name: "Ducts", kind: "duct", mult: 1, lines: [] },
        { id: uid(), name: "Each flat", kind: "flat", mult: 1, lines: [] },
        { id: uid(), name: "Common areas", kind: "once", mult: 1, lines: [] }
      ]
    };
  }

  function line(o) {
    return {
      id: uid(),
      code: o.code || "",
      desc: o.desc || "",
      unit: o.unit || "no",
      qty: o.qty == null ? 1 : o.qty,
      cost: o.cost || 0,
      pipe: !!o.pipe,
      sellOverride: o.sellOverride == null ? null : o.sellOverride,
      labour: o.labour || 0,
      hours: o.hours || 0,
      tbc: !!o.tbc,
      note: o.note || ""
    };
  }

  function matLine(code, desc, qty, cost, pipe, unit) {
    return line({ code: code, desc: desc, qty: qty, cost: cost, pipe: !!pipe, unit: unit || "no" });
  }

  function testProject() {
    function sec(name, kind, mult, lines) {
      return { id: uid(), name: name, kind: kind, mult: mult, lines: lines.map(line) };
    }
    var p = blankProject();
    p.name = "30-unit block (Unitwist + HDPE)";
    p.client = "";
    p.site = "";
    p.units = 30;
    p.ducts = 3;
    p.excluded = "Scaffolding, tiling, and building work.";
    p.time = { crews: 2, men: 6, menLock: true, days: 80, months: 4, extraCrewDays: 6 };
    p.sections = [
      sec("Drainage, each duct", "duct", 3, [
        matLine("001875", "110 mm soil pipe, 6 m length", 5, 552.48, true),
        matLine("001820", "110 mm junction", 12, 103.60),
        matLine("001834", "110 × 50 mm reducing junction", 12, 87.66),
        matLine("001791", "110 mm inspection pipe", 6, 97.23),
        matLine("001819", "110 mm access bend", 2, 97.23),
        matLine("009027", "110 mm two-way vent valve", 2, 60.57),
        matLine("001822", "110 mm socket", 6, 43.03),
        matLine("002696", "110 mm holderbat", 18, 26.30),
        matLine("032193", "PVC cement", 1, 189.56, false, "item"),
        matLine("041329", "Pipe lubricant gel, 1 kg", 1, 48.94, false, "item")
      ]),
      sec("HDPE main, 40 mm", "once", 1, [
        matLine("008894", "40 mm HDPE pipe, 100 m coil", 1, 3191.31, true),
        matLine("004443", "40 × 32 mm reducing tee", 3, 179.42),
        matLine("000451", "40 mm elbow", 6, 129.52),
        matLine("000416", "40 mm coupling", 4, 123.13),
        matLine("040026", "40 mm ball valve", 1, 412.91),
        matLine("000422", "40 mm female adaptor, 1½ inch", 2, 84.38)
      ]),
      sec("HDPE risers, 32 mm, each duct", "duct", 3, [
        matLine("035725", "32 mm HDPE pipe, 50 m coil", 1, 1230.93, true),
        matLine("000375", "32 mm tee with ¾ inch female thread", 10, 81.30),
        matLine("000381", "32 mm elbow", 4, 65.20),
        matLine("000351", "32 mm coupling", 2, 65.66),
        matLine("040025", "32 mm ball valve", 2, 272.11),
        matLine("004487", "32 mm end plug", 2, 44.66)
      ]),
      sec("Each flat, Unitwist 15 mm and 22 mm", "flat", 30, [
        matLine("029622", "15 mm Unitwist pipe, 50 m", 1, 450.19, true),
        matLine("029621", "22 mm Unitwist pipe, 6 m", 2, 115.03, true),
        matLine("029643", "15 mm elbow", 10, 21.81),
        matLine("029652", "15 mm tee", 6, 31.30),
        matLine("029634", "15 mm coupler", 4, 20.72),
        matLine("029644", "22 mm elbow", 4, 39.93),
        matLine("029654", "22 × 15 mm reducing tee", 2, 66.04),
        matLine("029638", "22 mm male iron adaptor, ¾ inch", 1, 26.10),
        matLine("029637", "15 mm male iron adaptor, ½ inch", 4, 14.63),
        matLine("029640", "15 mm female iron adaptor, ½ inch", 2, 15.83),
        matLine("029641", "22 mm female iron adaptor, ¾ inch", 2, 23.34),
        matLine("029892", "15 mm angle valve", 4, 74.99),
        matLine("000185", "350 mm flexi connector", 4, 49.00),
        matLine("001816", "Pan connector", 1, 73.32),
        matLine("003658", "15 mm pipe strap", 20, 2.17),
        matLine("003659", "22 mm pipe strap", 8, 2.99),
        matLine("001886", "50 mm waste pipe, 6 m", 1, 161.13, true),
        matLine("001911", "50 mm bend", 4, 11.15),
        matLine("001935", "50 mm junction", 1, 12.10),
        matLine("002695", "50 mm holderbat", 4, 20.49),
        matLine("022958", "PTFE tape", 1, 8.57, false, "item"),
        line({ desc: "22 mm isolating ball valve", unit: "no", qty: 1, tbc: true, note: "Price to be confirmed" })
      ]),
      sec("Meter bank header", "once", 1, [
        matLine("038890", "40 mm HDPE pipe, 6 m", 3, 229.77, true),
        matLine("000417", "40 mm equal tee", 1, 181.18),
        matLine("004488", "40 mm end plug", 1, 76.18),
        matLine("040026", "40 mm ball valve", 1, 412.91),
        matLine("008884", "20 mm HDPE pipe, 100 m coil", 3, 1002.99, true),
        line({ desc: "Meter bank cabinet", unit: "item", qty: 1, tbc: true, note: "Price to be confirmed" })
      ]),
      sec("Meter set, each flat", "flat", 30, [
        matLine("030879", "20 mm water meter", 1, 1042.79),
        matLine("030883", "20 mm meter tailpiece set", 1, 188.60),
        matLine("000434", "40 × ¾ inch saddle", 1, 89.70),
        matLine("040023", "20 mm ball valve", 2, 245.57),
        matLine("003829", "20 mm non-return valve", 1, 220.20),
        matLine("004396", "20 mm female adaptor, ¾ inch", 2, 29.78),
        matLine("004379", "20 mm male adaptor, ¾ inch", 2, 24.67),
        matLine("000266", "20 mm elbow", 1, 43.44)
      ]),
      sec("Geyser, each flat", "flat", 30, [
        matLine("036252", "150 L Kwikot geyser", 1, 4798.99),
        matLine("001346", "22 mm multi pressure-control valve", 1, 798.99),
        matLine("036206", "22 mm vacuum breaker", 2, 75.00),
        matLine("002109", "Geyser drip tray", 1, 185.00),
        line({ desc: "Drain, overflow and lagging", unit: "item", qty: 1, tbc: true, note: "Price to be confirmed" }),
        line({ desc: "Electrical isolator", unit: "item", qty: 1, tbc: true, note: "Price to be confirmed" })
      ]),
      sec("Labour (price book)", "once", 1, [
        line({ code: "PT-FULL", desc: "Full plumbing point", unit: "point", qty: 180, labour: 2000 }),
        line({ code: "GEY-150", desc: "150 L geyser swap, labour", unit: "no", qty: 30, labour: 3250 }),
        line({ code: "COC", desc: "Geyser certificate of compliance", unit: "no", qty: 30, labour: 850 }),
        line({ code: "STACK", desc: "Stack labour, 6 stacks", unit: "no", qty: 6, hours: 8 }),
        line({ code: "MTR-LAB", desc: "Water meter, labour", unit: "no", qty: 30, labour: 750 }),
        line({ code: "HDR-LAB", desc: "Meter bank header, labour", unit: "item", qty: 1, hours: 8 })
      ])
    ];
    return p;
  }

  function syncMult(p) {
    (p.sections || []).forEach(function (s) {
      if (s.kind === "flat") s.mult = Math.max(1, Number(p.units) || 1);
      if (s.kind === "duct") s.mult = Math.max(1, Number(p.ducts) || 1);
      if (s.kind === "once") s.mult = 1;
    });
  }

  function labourEach(ln) {
    if (ln.tbc) return 0;
    if ((Number(ln.hours) || 0) > 0) return (Number(ln.hours) || 0) * HOURLY;
    return Number(ln.labour) || 0;
  }
  function sellEach(ln) {
    if (ln.tbc) return 0;
    if (ln.sellOverride != null && ln.sellOverride !== "") return Number(ln.sellOverride) || 0;
    return (Number(ln.cost) || 0) * factorOf(ln.cost, ln.pipe);
  }
  function isContingency(ln) {
    return String(ln.code || "").toUpperCase() === "PR-CON" || String(ln.unit || "") === "%";
  }

  function priceOf(p) {
    syncMult(p);
    var cost = 0, sell = 0, lab = 0, tbc = [];
    var sections = (p.sections || []).map(function (s) {
      var mult = Number(s.mult) || 1;
      var sc = 0, ss = 0, sl = 0;
      var lines = (s.lines || []).map(function (ln) {
        var qty = Number(ln.qty) || 0;
        if (isContingency(ln)) return { ln: ln, skip: true };
        if (ln.tbc) {
          tbc.push(ln.desc || ln.code || "Item");
          return { ln: ln, qty: qty, mult: mult, cost: 0, sell: 0, lab: 0, each: 0, amount: 0, tbc: true };
        }
        var cExt = qty * mult * (Number(ln.cost) || 0);
        var sExt = qty * mult * sellEach(ln);
        var lExt = qty * mult * labourEach(ln);
        sc += cExt; ss += sExt; sl += lExt;
        var each = sellEach(ln) + labourEach(ln);
        return { ln: ln, qty: qty, mult: mult, cost: cExt, sell: sExt, lab: lExt, each: each, amount: sExt + lExt, tbc: false };
      });
      cost += sc; sell += ss; lab += sl;
      return { section: s, cost: sc, sell: ss, lab: sl, amount: ss + sl, lines: lines };
    });
    var pre = p.prelims || {};
    var fixed = (Number(pre.scaffold) || 0) + (Number(pre.establish) || 0) + (Number(pre.travel) || 0);
    var tm = p.time || {};
    var crews = Number(tm.crews) || 0;
    var days = Number(tm.days) || 0;
    var extra = Number(tm.extraCrewDays) || 0;
    var men = tm.menLock ? (Number(tm.men) || 0) : crews * CREW_MEN;
    var crewPay = (crews * days + extra) * CREW_DAY;
    var menPay = men * days * MAN_DAY;
    var timePay = crews > 0 ? crewPay : menPay;
    var bookLab = lab;
    var gap = money(timePay - bookLab);
    var use = !!p.useHigher && gap > 0;
    var labourUsed = use ? timePay : bookLab;
    var beforeCont = sell + labourUsed + fixed;
    var contPct = Number(pre.contingency) || 0;
    (p.sections || []).forEach(function (s) {
      (s.lines || []).forEach(function (ln) {
        if (!isContingency(ln)) return;
        var pct = String(ln.unit) === "%" ? (Number(ln.qty) || Number(ln.labour) || 0) : (Number(ln.qty) || 0);
        if (pct) contPct = pct;
      });
    });
    var cont = beforeCont * contPct / 100;
    var cons = sell * 0.05;
    var total = beforeCont + cont + cons;
    return {
      sections: sections,
      cost: cost, sell: sell, bookLab: bookLab, cons: cons, cont: cont, contPct: contPct, fixed: fixed,
      crews: crews, days: days, extra: extra, men: men,
      crewPay: crewPay, menPay: menPay, timePay: timePay, gap: gap > 0 ? gap : 0,
      labourUsed: labourUsed, use: use,
      total: total, dep: total * 0.8, tbc: tbc
    };
  }

  function listJobs() {
    try { return JSON.parse(localStorage.getItem(JOBKEY) || "[]"); } catch (e) { return []; }
  }
  function saveAll(list) {
    try { localStorage.setItem(JOBKEY, JSON.stringify(list)); } catch (e) { toast("Could not save this tender on this phone"); }
  }
  function saveCurrent() {
    if (!P) return;
    var list = listJobs().filter(function (x) { return x.id !== P.id; });
    list.unshift(JSON.parse(JSON.stringify(P)));
    if (list.length > 20) list.length = 20;
    saveAll(list);
    try { localStorage.setItem(CURKEY, P.id); } catch (e) {}
  }
  function loadId(id) {
    var hit = listJobs().filter(function (x) { return x.id === id; })[0];
    if (!hit) return;
    P = JSON.parse(JSON.stringify(hit));
    saveCurrent();
    render();
  }

  function byCode(code) {
    code = String(code || "");
    for (var i = 0; i < library.items.length; i++) if (library.items[i].code === code) return library.items[i];
    return null;
  }

  function lineFromRate(it, qty) {
    var tbc = String(it.status || "") === "TBC";
    var hours = Number(it.labour_hrs) || 0;
    var labour = hours > 0 ? 0 : (Number(it.labour_R) || 0);
    var sell = Number(it.material_sell) || 0;
    var cost = Number(it.material_cost) || 0;
    return line({
      code: it.code,
      desc: it.description,
      unit: it.unit || "no",
      qty: qty == null ? 1 : qty,
      cost: cost,
      sellOverride: sell && Math.abs(sell - cost * factorOf(cost, false)) > 0.02 ? sell : (sell && !cost ? sell : null),
      labour: labour,
      hours: hours,
      tbc: tbc,
      note: it.notes || ""
    });
  }

  function addRateToSection(sec, it, qty) {
    sec.lines.push(lineFromRate(it, qty));
    if (!/F$/i.test(it.code)) {
      var fit = byCode(it.code + "F");
      if (fit) {
        sec.lines.push(lineFromRate(fit, qty));
        toast("Also added " + fit.code + " (fittings) at the same quantity");
      }
    }
  }

function useHigher() {
  if (!P) return;
  var stripped = JSON.parse(JSON.stringify(P));
  stripped.sections.forEach(function (s) { s.lines = (s.lines || []).filter(function (ln) { return !ln.time; }); });
  var base = priceOf(stripped);
  var need = money(base.timePay - base.bookLab);
  var sec = null;
  P.sections.forEach(function (s) { if (s.kind === "once" && /labour/i.test(s.name)) sec = s; });
  if (!sec) {
    sec = { id: uid(), name: "Labour (price book)", kind: "once", mult: 1, lines: [] };
    P.sections.push(sec);
  }
  sec.lines = sec.lines.filter(function (ln) { return !ln.time; });
  if (need > 0) {
    var extra = line({ code: "TIME", desc: "Crew time above the price book", unit: "item", qty: 1, labour: need });
    extra.time = 1;
    sec.lines.push(extra);
  }
  P.useHigher = true;
  saveCurrent();
  render();
  toast(need > 0 ? "Labour now matches the crew-day check" : "Price-book labour already covers the crew");
}

  function parseTable(text) {
    var rows = String(text || "").replace(/\r/g, "").split("\n").filter(function (r) { return r.trim(); });
    if (!rows.length) return [];
    var sep = rows[0].indexOf("\t") >= 0 ? "\t" : ",";
    function cells(r) {
      if (sep === "\t") return r.split("\t");
      var out = [], cur = "", q = false, i;
      for (i = 0; i < r.length; i++) {
        var ch = r.charAt(i);
        if (ch === '"') { q = !q; continue; }
        if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.map(function (c) { return c.trim(); });
    }
    var head = cells(rows[0]).map(function (h) { return h.toLowerCase(); });
    var start = 0, map = null;
    function col(names) {
      for (var i = 0; i < head.length; i++) {
        for (var n = 0; n < names.length; n++) if (head[i].indexOf(names[n]) >= 0) return i;
      }
      return -1;
    }
    if (col(["code", "item", "desc", "qty", "unit"]) >= 0) {
      start = 1;
      map = { code: col(["code"]), desc: col(["item", "desc", "description"]), unit: col(["unit"]), qty: col(["qty", "quantity"]), cost: col(["cost", "material"]), labour: col(["labour", "labor"]) };
    }
    var out = [];
    for (var r = start; r < rows.length; r++) {
      var c = cells(rows[r]);
      if (!c.length) continue;
      var o = { desc: "", code: "", unit: "no", qty: 1, cost: 0, labour: 0 };
      if (map) {
        if (map.code >= 0) o.code = c[map.code] || "";
        if (map.desc >= 0) o.desc = c[map.desc] || "";
        if (map.unit >= 0) o.unit = (c[map.unit] || "no").toLowerCase();
        if (map.qty >= 0) o.qty = Number(String(c[map.qty] || "").replace(/[^\d.]/g, "")) || 0;
        if (map.cost >= 0) o.cost = Number(String(c[map.cost] || "").replace(/[^\d.]/g, "")) || 0;
        if (map.labour >= 0) o.labour = Number(String(c[map.labour] || "").replace(/[^\d.]/g, "")) || 0;
      } else if (c.length >= 2) {
        o.desc = c[0];
        o.qty = Number(String(c[1]).replace(/[^\d.]/g, "")) || 1;
        if (c[2]) o.unit = c[2].toLowerCase();
        if (c[3]) o.cost = Number(String(c[3]).replace(/[^\d.]/g, "")) || 0;
      }
      if (/^\d{6}$/.test(o.desc) && !o.code) { o.code = o.desc; o.desc = ""; }
      if (o.code && cat && cat[o.code] && !o.cost) {
        o.cost = cat[o.code].cost;
        if (!o.desc) o.desc = cat[o.code].name;
      }
      if (o.desc || o.code) out.push(line(o));
    }
    return out;
  }

  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function downloadBytes(name, mime, bytes) {
    var blob = new Blob([bytes], { type: mime });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function csvEscape(s) {
    s = String(s == null ? "" : s);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function boqCsv(p, t) {
    var rows = [["Section", "Multiplier", "Code", "Item", "Unit", "Qty each", "Qty total", "Material cost", "Material sell", "Labour", "Installed rate", "Amount", "Flag"]];
    t.sections.forEach(function (s) {
      s.lines.forEach(function (row) {
        if (row.skip) return;
        var ln = row.ln;
        rows.push([
          s.section.name, s.section.mult, ln.code, ln.desc, ln.unit, ln.qty, money((Number(ln.qty) || 0) * (Number(s.section.mult) || 1)),
          ln.tbc ? "" : money(ln.cost), ln.tbc ? "" : money(sellEach(ln)), ln.tbc ? "" : money(labourEach(ln)),
          ln.tbc ? "" : money(row.each), ln.tbc ? "" : money(row.amount), ln.tbc ? "TBC" : ""
        ]);
      });
      rows.push([s.section.name + " subtotal", "", "", "", "", "", "", money(s.cost), money(s.sell), money(s.lab), "", money(s.amount), ""]);
    });
    rows.push([]);
    rows.push(["Materials cost", money(t.cost)]);
    rows.push(["Materials sell", money(t.sell)]);
    rows.push(["Consumables 5%", money(t.cons)]);
    rows.push(["Labour used", money(t.labourUsed)]);
    rows.push(["Prelims", money(t.fixed)]);
    rows.push(["Contingency", money(t.cont)]);
    rows.push(["TOTAL", money(t.total)]);
    rows.push(["80% deposit", money(t.dep)]);
    return rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\n");
  }

  function crc32(bytes) {
    if (!crc32.table) {
      var table = new Uint32Array(256), n, k, c;
      for (n = 0; n < 256; n++) {
        c = n;
        for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      crc32.table = table;
    }
    var crc = 0xFFFFFFFF, i;
    for (i = 0; i < bytes.length; i++) crc = crc32.table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function strBytes(s) { return new TextEncoder().encode(s); }
  function u16(n) { return [n & 255, (n >> 8) & 255]; }
  function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]; }
  function concat(parts) {
    var len = 0, i, o = 0;
    parts.forEach(function (p) { len += p.length; });
    var out = new Uint8Array(len);
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }
  function zipStore(files) {
    var locals = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = strBytes(f.name), data = f.data, crc = crc32(data);
      var local = concat([
        new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        new Uint8Array(u16(20)), new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u32(crc)), new Uint8Array(u32(data.length)), new Uint8Array(u32(data.length)),
        new Uint8Array(u16(name.length)), new Uint8Array(u16(0)),
        name, data
      ]);
      var cen = concat([
        new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
        new Uint8Array(u16(20)), new Uint8Array(u16(20)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u32(crc)), new Uint8Array(u32(data.length)), new Uint8Array(u32(data.length)),
        new Uint8Array(u16(name.length)), new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u32(0)),
        new Uint8Array(u32(offset)),
        name
      ]);
      locals.push(local);
      central.push(cen);
      offset += local.length;
    });
    var cenStart = offset, cenBlob = concat(central);
    var end = concat([
      new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
      new Uint8Array(u16(0)), new Uint8Array(u16(0)),
      new Uint8Array(u16(files.length)), new Uint8Array(u16(files.length)),
      new Uint8Array(u32(cenBlob.length)), new Uint8Array(u32(cenStart)),
      new Uint8Array(u16(0))
    ]);
    return concat(locals.concat([cenBlob, end]));
  }
  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; });
  }
  function boqXlsx(p, t) {
    var rows = [["Section", "Code", "Item", "Unit", "Qty", "Rate", "Amount"]];
    t.sections.forEach(function (s) {
      s.lines.forEach(function (row) {
        if (row.skip) return;
        rows.push([s.section.name, row.ln.code, row.ln.desc, row.ln.unit, row.qty * (s.section.mult || 1), row.tbc ? 0 : money(row.each), row.tbc ? 0 : money(row.amount)]);
      });
      rows.push([s.section.name + " subtotal", "", "", "", "", "", money(s.amount)]);
    });
    rows.push(["TOTAL", "", "", "", "", "", money(t.total)]);
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
      + rows.map(function (r, i) {
        return "<row r=\"" + (i + 1) + "\">" + r.map(function (cell, c) {
          var col = String.fromCharCode(65 + c);
          var ref = col + (i + 1);
          if (typeof cell === "number") return '<c r="' + ref + '"><v>' + cell + "</v></c>";
          return '<c r="' + ref + '" t="inlineStr"><is><t>' + xmlEsc(cell) + "</t></is></c>";
        }).join("") + "</row>";
      }).join("")
      + "</sheetData></worksheet>";
    var files = [
      { name: "[Content_Types].xml", data: strBytes('<?xml version="1.0" encoding="UTF-8"?>' + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
      { name: "_rels/.rels", data: strBytes('<?xml version="1.0" encoding="UTF-8"?>' + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: "xl/workbook.xml", data: strBytes('<?xml version="1.0" encoding="UTF-8"?>' + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BOQ" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name: "xl/_rels/workbook.xml.rels", data: strBytes('<?xml version="1.0" encoding="UTF-8"?>' + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
      { name: "xl/worksheets/sheet1.xml", data: strBytes(sheet) }
    ];
    return zipStore(files);
  }

  function pdfEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
  function makePdf(lines) {
    var pages = [];
    var cur = [];
    lines.forEach(function (ln) {
      if (cur.length >= 46) { pages.push(cur); cur = []; }
      cur.push(ln);
    });
    if (!pages.length || cur.length) pages.push(cur);
    var objects = [];
    function add(body) { objects.push(body); return objects.length; }
    var font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    var fontB = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    var pageIds = [];
    pages.forEach(function (plines) {
      var y = 800, cmds = ["BT", "/F2 16 Tf", "48 " + y + " Td", "(" + pdfEscape(plines[0] || "") + ") Tj"];
      y -= 22;
      for (var i = 1; i < plines.length; i++) {
        var bold = plines[i].charAt(0) === "*";
        var text = bold ? plines[i].slice(1) : plines[i];
        cmds.push("/" + (bold ? "F2" : "F1") + " 10 Tf");
        cmds.push("1 0 0 1 48 " + y + " Tm");
        cmds.push("(" + pdfEscape(text) + ") Tj");
        y -= 14;
      }
      cmds.push("ET");
      var stream = cmds.join("\n");
      var content = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
      var page = add("<< /Type /Page /Parent PAGES /MediaBox [0 0 595 842] /Contents " + content + " 0 R /Resources << /Font << /F1 " + font + " 0 R /F2 " + fontB + " 0 R >> >> >>");
      pageIds.push(page);
    });
    var kids = pageIds.map(function (id) { return id + " 0 R"; }).join(" ");
    var pagesObj = add("<< /Type /Pages /Count " + pageIds.length + " /Kids [" + kids + "] >>");
    objects[pagesObj - 1] = objects[pagesObj - 1];
    objects = objects.map(function (body) { return body.replace("Parent PAGES", "Parent " + pagesObj + " 0 R"); });
    var catalog = add("<< /Type /Catalog /Pages " + pagesObj + " 0 R >>");
    var out = "%PDF-1.4\n", xref = [0];
    objects.forEach(function (body, i) {
      xref.push(out.length);
      out += (i + 1) + " 0 obj\n" + body + "\nendobj\n";
    });
    var start = out.length;
    out += "xref\n0 " + (objects.length + 1) + "\n";
    out += "0000000000 65535 f \n";
    for (var i = 1; i < xref.length; i++) out += String(xref[i]).padStart(10, "0") + " 00000 n \n";
    out += "trailer << /Size " + (objects.length + 1) + " /Root " + catalog + " 0 R >>\nstartxref\n" + start + "\n%%EOF";
    return new TextEncoder().encode(out);
  }

  function summaryLines(p, t) {
    var L = [];
    L.push("APS tender summary");
    L.push(p.name || "Tender");
    L.push(p.client ? "Client: " + p.client : "Client: —");
    L.push(p.site ? "Site: " + p.site : "Site: —");
    L.push(p.units + " flats · " + p.ducts + " ducts");
    L.push("APS is not VAT-registered. No VAT is added.");
    L.push("");
    L.push("*Section totals");
    t.sections.forEach(function (s) {
      L.push(s.section.name + "  ×" + s.section.mult + "    " + R(s.amount));
    });
    L.push("");
    L.push("Materials, Plumblink cost    " + R(t.cost));
    L.push("Materials, APS sell          " + R(t.sell));
    L.push("Consumables, 5% of materials " + R(t.cons));
    L.push("*Materials including consumables  " + R(t.sell + t.cons));
    L.push("Price-book labour            " + R(t.bookLab));
    L.push("Crew check                   " + R(t.timePay));
    L.push("*Labour used                  " + R(t.labourUsed));
    if (t.fixed) L.push("Prelims                      " + R(t.fixed));
    if (t.cont) L.push("Contingency " + t.contPct + "%            " + R(t.cont));
    L.push("");
    L.push("*TOTAL                        " + R(t.total));
    if (p.pay === "schedule") {
      L.push("Payment schedule");
      (p.schedule || []).forEach(function (st) {
        L.push((st.name || "Stage") + "  " + (Number(st.pct) || 0) + "%    " + R(t.total * (Number(st.pct) || 0) / 100));
      });
    } else {
      L.push("80% deposit to book and buy materials    " + R(t.dep));
      L.push("Balance on completion                    " + R(t.total - t.dep));
    }
    L.push("");
    L.push("Not included: " + (p.excluded || "Scaffolding, tiling, and building work."));
    if (t.tbc.length) {
      L.push("");
      L.push("Prices still to confirm:");
      t.tbc.forEach(function (n) { L.push("· " + n); });
    }
    L.push("");
    L.push("Crew: " + t.crews + " crews × " + t.days + " days at " + R(CREW_DAY) + " a crew-day");
    if (t.extra) L.push("Plus " + t.extra + " extra crew-days.");
    return L;
  }

  function field(label, value, attrs) {
    return '<label class="tf">' + esc(label) + '<input ' + (attrs || "") + ' value="' + esc(value == null ? "" : value) + '"></label>';
  }

  function render() {
    var root = document.getElementById("tenderRoot");
    if (!root || !P) return;
    var t = priceOf(P);
    var nav = '<div class="tnav no-print">'
      + ["job", "boq", "time", "sum", "in"].map(function (k, i) {
        var lab = ["Job", "BOQ", "Time", "Summary", "Internal"][i];
        return '<button type="button" data-tv="' + k + '"' + (view === k ? ' class="on"' : "") + ">" + lab + "</button>";
      }).join("") + "</div>";
    var body = view === "boq" ? viewBoq(t) : view === "time" ? viewTime(t) : view === "sum" ? viewSum(t) : view === "in" ? viewInternal(t) : viewJob(t);
    root.innerHTML = '<div class="tender">' + nav + body + "</div>";
    bind(root, t);
  }

  function viewJob() {
    var list = listJobs();
    return '<div class="tcard no-print"><h3>This tender</h3>'
      + field("Tender name", P.name, 'data-k="name"')
      + field("Client", P.client, 'data-k="client"')
      + field("Site", P.site, 'data-k="site"')
      + '<div class="trow">' + field("Number of flats", P.units, 'data-k="units" type="number" min="1"')
      + field("Number of ducts", P.ducts, 'data-k="ducts" type="number" min="1"') + "</div>"
      + '<p class="note">Sections marked “each duct” use the duct count. Sections marked “each flat” use the flat count. Common areas stay at one.</p>'
      + '<div class="tbtns"><button type="button" class="tbtn pri" data-act="test">Load 30-unit block</button>'
      + '<button type="button" class="tbtn" data-act="new">New blank tender</button>'
      + '<button type="button" class="tbtn" data-act="save">Save on this phone</button></div></div>'
      + '<div class="tcard no-print"><h3>Saved on this phone</h3>'
      + (list.length ? list.map(function (j) {
        return '<button type="button" class="tlink" data-open="' + esc(j.id) + '">' + esc(j.name || "Untitled tender") + "</button>";
      }).join("") : '<p class="note">None yet.</p>')
      + "</div>"
      + '<div class="tcard no-print"><h3>Rate library</h3>'
      + '<p class="note">' + library.items.length + ' saved rates. A pipe code such as P22 also adds P22F when that fittings rate exists. TBC rates stay at R0 until you price them. PR-CON is a contingency percent.</p>'
      + '<div class="tbtns"><button type="button" class="tbtn" data-act="lib-export">Export JSON</button>'
      + '<label class="tbtn file">Import rate library<input type="file" id="libFile" accept="application/json,.json"></label></div>'
      + '<ul class="tlib">' + library.items.slice(0, 12).map(function (it) {
        return "<li><b>" + esc(it.code) + "</b> " + esc(it.description) + " · " + (it.status === "TBC" ? "TBC" : R(it.unit_rate || it.labour_R)) + "</li>";
      }).join("") + "</ul></div>";
  }

  function viewBoq(t) {
    var html = '<div class="ttot no-print"><span>Cost ' + R(t.cost) + "</span><span>Sell " + R(t.sell) + "</span><span>Labour " + R(t.labourUsed) + "</span><b>" + R(t.total) + "</b></div>";
    html += t.sections.map(function (s, si) {
      var rows = s.lines.filter(function (r) { return !r.skip; }).map(function (row, li) {
        var ln = row.ln;
        return '<div class="tline' + (ln.tbc ? " tbc" : "") + '">'
          + '<div class="tline-h"><b>' + esc(ln.desc || "Item") + "</b>"
          + (ln.code ? '<span class="code">' + esc(ln.code) + "</span>" : "")
          + (ln.tbc ? '<span class="flag">Price to confirm</span>' : "")
          + "</div>"
          + '<div class="tline-g">'
          + "<span>" + esc(ln.qty) + " " + esc(ln.unit) + " × " + s.section.mult + "</span>"
          + (ln.tbc ? "<span>No price yet</span>" : "<span>Sell " + R(sellEach(ln)) + " · labour " + R(labourEach(ln)) + "</span>")
          + "<b>" + (ln.tbc ? "—" : R(row.amount)) + "</b>"
          + "</div>"
          + '<button type="button" class="tmini" data-edit="' + si + ":" + ln.id + '">Edit</button>'
          + "</div>";
      }).join("");
      return '<details class="tsec" ' + (si < 2 ? "open" : "") + "><summary>" + esc(s.section.name)
        + " <em>×" + s.section.mult + "</em> <b>" + R(s.amount) + "</b></summary>" + rows
        + '<div class="tbtns"><button type="button" class="tbtn" data-add="' + si + '">Add a line</button></div></details>';
    }).join("");
    html += '<div class="tcard no-print"><h3>Paste a bill from Excel</h3>'
      + '<p class="note">Paste a table with a header row. Columns can be code, description, unit, qty, cost, labour. Tab or comma separated.</p>'
      + '<textarea id="tpaste" rows="5" placeholder="code, description, unit, qty, cost"></textarea>'
      + '<div class="tbtns"><button type="button" class="tbtn" data-act="paste">Add pasted lines to common areas</button>'
      + '<label class="tbtn file">Import CSV<input type="file" id="csvFile" accept=".csv,text/csv,text/plain"></label></div></div>';
    if (t.tbc.length) html += '<p class="twarn">Still to price: ' + esc(t.tbc.join(", ")) + ".</p>";
    return html;
  }

  function viewTime(t) {
    var tm = P.time;
    var warn = t.gap > 0
      ? '<div class="twarn"><b>Labour is ' + R(t.gap) + " below what " + t.crews + " crews for " + t.days + " days costs at R4,800 a crew-day"
        + (t.extra ? ", including " + t.extra + " extra crew-days" : "") + ".</b>"
        + '<button type="button" class="tbtn pri" id="useHigher">Use higher figure</button></div>'
      : '<p class="note">Price-book labour covers the crew-day check.</p>';
    return '<div class="tcard"><h3>Time on site</h3>'
      + '<div class="trow">' + field("Crews of 3", tm.crews, 'data-time="crews" type="number" min="0"')
      + field("Men", tm.men, 'data-time="men" type="number" min="0"') + "</div>"
      + '<div class="trow">' + field("Working days", tm.days, 'data-time="days" type="number" min="0"')
      + field("Months (about)", tm.months, 'data-time="months" type="number" min="0" step="0.5"') + "</div>"
      + field("Extra crew-days", tm.extraCrewDays, 'data-time="extraCrewDays" type="number" min="0"')
      + '<p class="note">A crew-day is R4,800, which is 3 men at R1,600 each. ' + t.crews + " crews × " + t.days + " days"
      + (t.extra ? " plus " + t.extra + " extra crew-days" : "") + " = " + R(t.crewPay) + ".</p>"
      + "<p class=\"note\">" + t.men + " men × " + t.days + " days × R1,600 = " + R(t.menPay) + ".</p>"
      + "<p class=\"note\">Price-book labour on this bill is " + R(t.bookLab) + ".</p>"
      + warn + "</div>";
  }

  function paper(t) {
    var rows = t.sections.map(function (s) {
      return "<tr><td>" + esc(s.section.name) + " ×" + s.section.mult + "</td><td>" + R(s.amount) + "</td></tr>";
    }).join("");
    var pay = P.pay === "schedule"
      ? (P.schedule || []).map(function (st) {
        return "<tr><td>" + esc(st.name || "Stage") + " " + (Number(st.pct) || 0) + "%</td><td>" + R(t.total * (Number(st.pct) || 0) / 100) + "</td></tr>";
      }).join("")
      : "<tr><td>80% deposit</td><td>" + R(t.dep) + "</td></tr><tr><td>Balance on completion</td><td>" + R(money(t.total - t.dep)) + "</td></tr>";
    var flags = t.tbc.length ? "<p><b>Still to confirm:</b> " + esc(t.tbc.join("; ")) + ".</p>" : "";
    return '<article id="tenderPaper"><h2>APS tender summary</h2><p class="who">APS – Architectural Plumbing Services<br>Not VAT-registered. No VAT is charged.</p>'
      + "<h3>" + esc(P.name || "Tender") + "</h3>"
      + "<p>" + esc(P.client || "Client") + (P.site ? " · " + esc(P.site) : "") + "<br>" + P.units + " flats · " + P.ducts + " ducts</p>"
      + '<table class="pr"><tr><td>Section</td><td>Amount</td></tr>' + rows
      + "<tr><td>Consumables (5% of materials)</td><td>" + R(t.cons) + "</td></tr>"
      + (t.fixed ? "<tr><td>Prelims</td><td>" + R(t.fixed) + "</td></tr>" : "")
      + (t.cont ? "<tr><td>Contingency " + t.contPct + "%</td><td>" + R(t.cont) + "</td></tr>" : "")
      + '<tr class="t"><td>TOTAL</td><td>' + R(t.total) + "</td></tr>" + pay + "</table>"
      + "<p>Not included: " + esc(P.excluded || "Scaffolding, tiling, and building work.") + "</p>" + flags + "</article>";
  }

  function viewSum(t) {
    return '<div class="no-print tbtns"><button type="button" data-pay="deposit" class="tbtn' + (P.pay !== "schedule" ? " on" : "") + '">80% deposit</button>'
      + '<button type="button" data-pay="schedule" class="tbtn' + (P.pay === "schedule" ? " on" : "") + '">Payment schedule</button></div>'
      + (P.pay === "schedule" ? '<div class="tcard no-print">' + (P.schedule || []).map(function (st, i) {
        return field(st.name || "Stage", st.pct, 'data-sched="' + i + '" type="number"');
      }).join("") + "</div>" : "")
      + paper(t)
      + '<div class="tbtns no-print"><button type="button" class="tbtn pri" data-act="pdf">Download PDF</button>'
      + '<button type="button" class="tbtn" data-act="print">Print / save as PDF</button>'
      + '<button type="button" class="tbtn" data-act="csv">Download CSV</button>'
      + '<button type="button" class="tbtn" data-act="xlsx">Download Excel</button></div>'
      + '<div class="tcard no-print"><h3>Prelims</h3>'
      + field("Scaffolding and access (R)", P.prelims.scaffold, 'data-pre="scaffold" type="number"')
      + field("Site establishment (R)", P.prelims.establish, 'data-pre="establish" type="number"')
      + field("Travel (R)", P.prelims.travel, 'data-pre="travel" type="number"')
      + field("Contingency %", P.prelims.contingency, 'data-pre="contingency" type="number"')
      + "<p class=\"note\">Consumables stay at 5% of material sell only. Contingency is a percent of materials, labour and prelims, before consumables.</p></div>";
  }

  function viewInternal(t) {
    var rows = t.sections.map(function (s) {
      var margin = s.sell - s.cost;
      return "<tr><td>" + esc(s.section.name) + "</td><td>" + R(s.cost) + "</td><td>" + R(s.sell) + "</td><td>" + R(s.lab) + "</td><td>" + R(margin) + "</td></tr>";
    }).join("");
    var matMargin = t.sell - t.cost;
    return '<div class="tcard"><h3>Cost against sell</h3><p class="note">This page stays in the office. The client summary does not show cost or margin.</p>'
      + '<table class="pr"><tr><td>Section</td><td>Cost</td><td>Sell</td><td>Labour</td><td>Material margin</td></tr>' + rows
      + "<tr class=\"t\"><td>Materials</td><td>" + R(t.cost) + "</td><td>" + R(t.sell) + "</td><td></td><td>" + R(matMargin) + "</td></tr></table>"
      + "<p>Material margin is " + (t.sell ? money(matMargin / t.sell * 100) : 0) + "% of sell.</p>"
      + "<p>Price-book labour " + R(t.bookLab) + ". Crew-day check " + R(t.timePay) + ". Labour in the total is " + R(t.labourUsed) + ".</p>"
      + "<p>Grand total " + R(t.total) + ".</p></div>";
  }

  function bind(root) {
    root.querySelectorAll("[data-tv]").forEach(function (b) {
      b.onclick = function () { view = b.dataset.tv; render(); };
    });
    root.querySelectorAll("[data-k]").forEach(function (el) {
      el.addEventListener("change", function () {
        var k = el.dataset.k;
        if (k === "units" || k === "ducts") P[k] = Math.max(1, Number(el.value) || 1);
        else P[k] = el.value;
        syncMult(P);
        saveCurrent();
      });
    });
    root.querySelectorAll("[data-time]").forEach(function (el) {
      el.addEventListener("change", function () {
        var k = el.dataset.time;
        P.time[k] = Number(el.value) || 0;
        if (k === "crews" && !P.time.menLock) P.time.men = P.time.crews * CREW_MEN;
        if (k === "men") P.time.menLock = true;
        if (k === "months") P.time.days = Math.round((Number(el.value) || 0) * 20);
        saveCurrent();
        render();
      });
    });
    root.querySelectorAll("[data-pre]").forEach(function (el) {
      el.addEventListener("change", function () {
        P.prelims[el.dataset.pre] = Number(el.value) || 0;
        saveCurrent();
        render();
      });
    });
    root.querySelectorAll("[data-pay]").forEach(function (b) {
      b.onclick = function () { P.pay = b.dataset.pay; saveCurrent(); render(); };
    });
    root.querySelectorAll("[data-sched]").forEach(function (el) {
      el.addEventListener("change", function () {
        P.schedule[Number(el.dataset.sched)].pct = Number(el.value) || 0;
        saveCurrent();
        render();
      });
    });
    root.querySelectorAll("[data-open]").forEach(function (b) {
      b.onclick = function () { loadId(b.dataset.open); view = "boq"; render(); };
    });
    root.querySelectorAll("[data-act]").forEach(function (b) {
      b.onclick = function () { act(b.dataset.act); };
    });
    var uh = document.getElementById("useHigher");
    if (uh) uh.onclick = useHigher;
    var lib = document.getElementById("libFile");
    if (lib) lib.onchange = function () {
      var f = lib.files && lib.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var n = mergeLibrary(JSON.parse(String(rd.result)), true);
          toast("Rate library loaded, " + n + " items");
          render();
        } catch (e) { toast(e.message || "That file could not be read"); }
      };
      rd.readAsText(f);
    };
    var csv = document.getElementById("csvFile");
    if (csv) csv.onchange = function () {
      var f = csv.files && csv.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { addPasted(String(rd.result)); };
      rd.readAsText(f);
    };
    root.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () { editLine(b.dataset.edit); };
    });
    root.querySelectorAll("[data-add]").forEach(function (b) {
      b.onclick = function () { addBlank(Number(b.dataset.add)); };
    });
  }

  function addPasted(text) {
    var lines = parseTable(text);
    if (!lines.length) { toast("No rows found"); return; }
    var sec = null;
    P.sections.forEach(function (s) { if (s.kind === "once") sec = s; });
    if (!sec) { sec = { id: uid(), name: "Common areas", kind: "once", mult: 1, lines: [] }; P.sections.push(sec); }
    lines.forEach(function (ln) { sec.lines.push(ln); });
    saveCurrent();
    view = "boq";
    render();
    toast(lines.length + " lines added");
  }

  function addBlank(si) {
    P.sections[si].lines.push(line({ desc: "New item", qty: 1, unit: "no" }));
    saveCurrent();
    editLine(si + ":" + P.sections[si].lines[P.sections[si].lines.length - 1].id);
  }

  function findLine(key) {
    var parts = String(key).split(":");
    var sec = P.sections[Number(parts[0])];
    if (!sec) return null;
    for (var i = 0; i < sec.lines.length; i++) if (sec.lines[i].id === parts[1]) return { sec: sec, ln: sec.lines[i], si: Number(parts[0]) };
    return null;
  }

  function editLine(key) {
    var hit = findLine(key);
    if (!hit) return;
    var ln = hit.ln;
    var root = document.getElementById("tenderRoot");
    var box = document.createElement("div");
    box.className = "tcard tedit";
    box.innerHTML = "<h3>Edit line</h3>"
      + field("Item", ln.desc, 'id="e-desc"')
      + field("Code", ln.code, 'id="e-code"')
      + '<div class="trow">' + field("Unit", ln.unit, 'id="e-unit"') + field("Qty", ln.qty, 'id="e-qty" type="number"') + "</div>"
      + '<div class="trow">' + field("Material cost each", ln.cost, 'id="e-cost" type="number" step="0.01"')
      + field("My sell each (blank = markup)", ln.sellOverride == null ? "" : ln.sellOverride, 'id="e-sell" type="number" step="0.01"') + "</div>"
      + '<label class="tf check"><input type="checkbox" id="e-pipe"' + (ln.pipe ? " checked" : "") + "> Pipe (35% until R750, then 25%)</label>"
      + '<div class="trow">' + field("Labour rand each", ln.labour, 'id="e-lab" type="number" step="0.01"')
      + field("Or labour hours (× R650)", ln.hours || "", 'id="e-hrs" type="number" step="0.25"') + "</div>"
      + '<label class="tf check"><input type="checkbox" id="e-tbc"' + (ln.tbc ? " checked" : "") + "> Price still to confirm</label>"
      + '<div class="tbtns"><button type="button" class="tbtn pri" id="e-ok">Save line</button>'
      + '<button type="button" class="tbtn" id="e-lib">Save into rate library</button>'
      + '<button type="button" class="tbtn" id="e-del">Remove</button></div>'
      + '<p class="note">High markup: 25% from R750, 35% on pipe below that, 45% on fittings. Installed rate is sell plus labour.</p>';
    root.prepend(box);
    document.getElementById("e-ok").onclick = function () {
      ln.desc = document.getElementById("e-desc").value;
      ln.code = document.getElementById("e-code").value.trim();
      ln.unit = document.getElementById("e-unit").value || "no";
      ln.qty = Number(document.getElementById("e-qty").value) || 0;
      ln.cost = Number(document.getElementById("e-cost").value) || 0;
      var sell = document.getElementById("e-sell").value;
      ln.sellOverride = sell === "" ? null : Number(sell);
      ln.pipe = document.getElementById("e-pipe").checked;
      ln.labour = Number(document.getElementById("e-lab").value) || 0;
      ln.hours = Number(document.getElementById("e-hrs").value) || 0;
      ln.tbc = document.getElementById("e-tbc").checked;
      saveCurrent();
      render();
    };
    document.getElementById("e-del").onclick = function () {
      hit.sec.lines = hit.sec.lines.filter(function (x) { return x !== ln; });
      saveCurrent();
      render();
    };
    document.getElementById("e-lib").onclick = function () {
      var code = document.getElementById("e-code").value.trim() || ("R" + uid());
      var item = {
        code: code,
        category: hit.sec.name,
        description: document.getElementById("e-desc").value,
        unit: document.getElementById("e-unit").value || "no",
        material_cost: Number(document.getElementById("e-cost").value) || 0,
        material_sell: document.getElementById("e-sell").value === "" ? money((Number(document.getElementById("e-cost").value) || 0) * factorOf(document.getElementById("e-cost").value, document.getElementById("e-pipe").checked)) : Number(document.getElementById("e-sell").value),
        labour_hrs: Number(document.getElementById("e-hrs").value) || 0,
        labour_R: Number(document.getElementById("e-lab").value) || 0,
        unit_rate: 0,
        source_codes: /^\d{6}$/.test(code) ? code : "",
        notes: "",
        status: document.getElementById("e-tbc").checked ? "TBC" : "ok"
      };
      item.unit_rate = item.status === "TBC" ? 0 : money(item.material_sell + (item.labour_hrs > 0 ? item.labour_hrs * HOURLY : item.labour_R));
      mergeLibrary({ meta: library.meta, items: [item] }, false);
      toast("Saved " + code + " in the rate library");
    };
  }

  function act(name) {
    if (name === "test") {
      P = testProject();
      P.useHigher = false;
      saveCurrent();
      view = "boq";
      render();
      toast("30-unit block loaded");
    } else if (name === "new") {
      P = blankProject();
      saveCurrent();
      view = "job";
      render();
    } else if (name === "save") {
      saveCurrent();
      toast("Saved on this phone");
    } else if (name === "paste") {
      addPasted((document.getElementById("tpaste") || {}).value || "");
    } else if (name === "lib-export") {
      download("aps-rate-library.json", "application/json", JSON.stringify(library, null, 2));
    } else if (name === "csv") {
      download(fileBase() + "-boq.csv", "text/csv", boqCsv(P, priceOf(P)));
    } else if (name === "xlsx") {
      downloadBytes(fileBase() + "-boq.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", boqXlsx(P, priceOf(P)));
    } else if (name === "pdf") {
      downloadBytes(fileBase() + "-summary.pdf", "application/pdf", makePdf(summaryLines(P, priceOf(P))));
    } else if (name === "print") {
      document.body.classList.add("tender-print");
      window.print();
      document.body.classList.remove("tender-print");
    }
  }
  function fileBase() {
    return (P.name || "tender").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tender";
  }

  function loadCatalogue() {
    fetch("../field/items.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.rows) return;
      cat = {};
      j.rows.forEach(function (row) { cat[row[0]] = { name: row[1], cost: Number(row[3]) || 0 }; });
    }).catch(function () {});
  }

  function ensure() {
    if (P) return;
    var id = null;
    try { id = localStorage.getItem(CURKEY); } catch (e) {}
    var hit = id && listJobs().filter(function (x) { return x.id === id; })[0];
    P = hit ? JSON.parse(JSON.stringify(hit)) : blankProject();
  }

  function open() {
    ensure();
    var q = new URLSearchParams(location.search);
    if (q.get("tender") === "block" && !open._did) {
      open._did = true;
      P = testProject();
      saveCurrent();
      view = "boq";
    }
    render();
  }

  function injectCss() {
    if (document.getElementById("tenderCss")) return;
    var s = document.createElement("style");
    s.id = "tenderCss";
    s.textContent = ""
      + ".tender{display:flex;flex-direction:column;gap:10px}"
      + ".tnav{display:flex;gap:6px;overflow:auto;padding-bottom:2px}"
      + ".tnav button{flex:none;height:36px;padding:0 12px;border-radius:18px;border:0;background:#e7eef8;font-weight:800;color:#004AAD}"
      + ".tnav button.on{background:#004AAD;color:#fff}"
      + ".tcard,.tsec{background:#fff;border:1px solid #d5dde7;border-radius:16px;padding:12px;margin:0 0 10px}"
      + ".tsec summary{font-weight:800;cursor:pointer;display:flex;gap:8px;align-items:baseline}"
      + ".tsec summary em{font-style:normal;color:#5c6b7a;font-weight:700}"
      + ".tsec summary b{margin-left:auto}"
      + ".tf{display:block;font-size:13px;font-weight:700;color:#5c6b7a;margin:0 0 8px}"
      + ".tf input{display:block;width:100%;height:44px;margin-top:4px;border:1px solid #d5dde7;border-radius:12px;padding:0 10px;font:inherit;color:#12263a;background:#fff}"
      + ".tf.check{display:flex;align-items:center;gap:8px;color:#12263a}"
      + ".tf.check input{width:auto;height:auto}"
      + ".trow{display:grid;grid-template-columns:1fr 1fr;gap:8px}"
      + ".tbtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}"
      + ".tbtn{height:44px;padding:0 12px;border-radius:12px;border:1px solid #004AAD;background:#fff;color:#004AAD;font-weight:800}"
      + ".tbtn.pri,.tbtn.on{background:#004AAD;color:#fff}"
      + ".tbtn.file{display:inline-flex;align-items:center;position:relative;overflow:hidden}"
      + ".tbtn.file input{position:absolute;inset:0;opacity:0}"
      + ".tlink{display:block;width:100%;text-align:left;background:#f4f7fb;border:0;border-radius:12px;padding:12px;margin:0 0 6px;font-weight:700}"
      + ".tlib{margin:8px 0 0;padding-left:18px}"
      + ".tlib li{margin:0 0 4px}"
      + ".ttot{display:flex;flex-wrap:wrap;gap:8px 14px;background:#004AAD;color:#fff;border-radius:14px;padding:10px 12px;font-weight:700;position:sticky;top:0;z-index:5}"
      + ".tline{border-top:1px solid #e6edf5;padding:8px 0}"
      + ".tline-h{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}"
      + ".tline .code{color:#5c6b7a;font-size:12px}"
      + ".tline-g{display:flex;gap:8px;justify-content:space-between;color:#24384c;font-size:13px}"
      + ".tmini{border:0;background:none;color:#004AAD;font-weight:800;padding:4px 0}"
      + ".flag{background:#fff3d6;color:#8a5a00;border-radius:8px;padding:1px 6px;font-size:12px}"
      + ".tline.tbc{background:#fff8ea}"
      + ".twarn{background:#fff6e8;border:1px solid #e8c48a;border-radius:12px;padding:12px;color:#5c3b00}"
      + ".twarn b{display:block;margin-bottom:8px}"
      + "#tenderPaper{background:#fff;color:#12263a;padding:16px;border-radius:12px}"
      + "#tenderPaper h2{margin:0 0 4px}"
      + "#tenderPaper h3{margin:8px 0}"
      + "#tenderPaper .pr{width:100%;border-collapse:collapse}"
      + "#tenderPaper .pr td{padding:4px 0;border-bottom:1px solid #e6edf5}"
      + "#tenderPaper .pr td:last-child{text-align:right;white-space:nowrap}"
      + "#tenderPaper .pr tr.t td{font-weight:800;font-size:18px}"
      + "#tpaste{width:100%;border:1px solid #d5dde7;border-radius:12px;padding:8px;font:inherit}"
      + "@media(min-width:900px){#s-tender{max-width:980px;margin:0 auto}.tline-g{font-size:14px}}";
    document.head.appendChild(s);
  }

  injectCss();
  tryBundled();
  loadCatalogue();
  ensure();

  window.APSTender = {
    open: open,
    priceOf: priceOf,
    project: function () { return P; },
    loadTest: function () { P = testProject(); saveCurrent(); view = "sum"; render(); },
    library: function () { return library; },
    mergeLibrary: mergeLibrary
  };
})();
