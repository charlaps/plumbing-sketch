/* APS Quote Helper — offline-first */
(function () {
  "use strict";

  const DEPOSIT_RATE = 0.8;
  const STORAGE_KEY = "aps-quote-saved-v1";
  const MARKUP_KEY = "aps-quote-bigticket-markup";
  const MAX_SAVED = 10;
  const MARKUP_CHOICES = [30, 25, 20];
  const GROUP_ORDER = ["tank", "pump", "filter", "bypass", "float", "overflow", "supply", "cover"];

  const CLIENT_BY_CODE = {
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
    "041275": ["cover", "Pump cover"],
  };

  const KIT_META = {
    "1000-low": { size: "1,000 L", tier: "Budget" },
    "1000-typ": { size: "1,000 L", tier: "Typical" },
    "1000-high": { size: "1,000 L", tier: "Premium" },
    "2500-low": { size: "2,500 L", tier: "Budget" },
    "2500-typ": { size: "2,500 L", tier: "Typical" },
    "2500-high": { size: "2,500 L", tier: "Premium" },
    "5000-low": { size: "5,000 L", tier: "Budget" },
    "5000-typ": { size: "5,000 L", tier: "Typical" },
    "5000-high": { size: "5,000 L", tier: "Premium" },
  };

  const PRESETS = {
    geyser: {
      jobType: "Geyser",
      scope:
        "Supply and install replacement geyser as discussed on site. Includes isolation, drain-down, fitment, recommission and basic pressure/leak check. Existing fittings reused where suitable. Electrical certificate / COC by others unless agreed separately.",
      materials: [
        { desc: "Electric geyser (as specified)", qty: 1, cost: 0 },
        { desc: "Geyser drip tray", qty: 1, cost: 0 },
        { desc: "Vacuum breaker / safety valves set", qty: 1, cost: 0 },
        { desc: "Pipework & fittings allowance", qty: 1, cost: 0 },
      ],
    },
    basin: {
      jobType: "Basin / vanity",
      scope:
        "Remove existing basin / vanity as agreed. Supply and install new basin unit, reconnect hot & cold supply and waste. Includes silicone finish and leak check. Tiling / making good by others unless quoted separately.",
      materials: [
        { desc: "Basin / vanity unit", qty: 1, cost: 0 },
        { desc: "Basin mixer / taps", qty: 1, cost: 0 },
        { desc: "Waste & trap set", qty: 1, cost: 0 },
        { desc: "Flexible connectors & fittings", qty: 1, cost: 0 },
      ],
    },
    toilet: {
      jobType: "Toilet",
      scope:
        "Remove existing toilet suite. Supply and install new close-coupled toilet, connect water supply and soil, silicone and leak check. Floor / wall making good by others unless quoted separately.",
      materials: [
        { desc: "Close-coupled toilet suite", qty: 1, cost: 0 },
        { desc: "Toilet seat (if not included)", qty: 1, cost: 0 },
        { desc: "Wax ring / pan connector", qty: 1, cost: 0 },
        { desc: "Flexible connector & isolation valve", qty: 1, cost: 0 },
      ],
    },
    filter: {
      jobType: "Filter",
      scope:
        "Supply and install whole-house filtration as discussed. Includes isolation, bypass where practical, pipe tie-in and flush. Filter cartridges / media as specified. Ongoing cartridge changes billed separately unless on a service plan.",
      materials: [
        { desc: "Whole-house filter housing / system", qty: 1, cost: 0 },
        { desc: "Filter cartridge / media set", qty: 1, cost: 0 },
        { desc: "Isolation valves & fittings", qty: 1, cost: 0 },
        { desc: "Pipework allowance", qty: 1, cost: 0 },
      ],
    },
  };

  const SCOPE_PLACEHOLDERS = {
    Geyser: PRESETS.geyser.scope,
    "Basin / vanity": PRESETS.basin.scope,
    Toilet: PRESETS.toilet.scope,
    Filter: PRESETS.filter.scope,
    "Tank + booster backup":
      "Supply and install a backup water tank and booster pump. Includes an inline water filter, tank float valve, overflow pipe, mains bypass with non-return valve, pump cover, and connection to the existing supply.",
  };

  const HINT_CLIENT =
    "Client view: descriptions & qty only — no per-item prices. Totals below.";
  const HINT_CLIENT_KIT =
    "Client view: plain descriptions only — no brands, codes or per-item prices.";
  const HINT_INTERNAL = "Internal: unit cost and line totals visible for you.";
  const HINT_INTERNAL_KIT =
    "Supplier code and Plumblink name. Unit R is shelf cost. Line R includes markup.";

  /** @type {ReturnType<typeof blankLine>[]} */
  let materials = [];
  let mode = "client";
  let activeKit = "";
  let bigMarkup = 30;
  const bigMarkupListeners = [];

  const $ = (id) => document.getElementById(id);

  /* Hooks + small API for add-ons (autoprice.js: Plumblink prices + job-book labour) */
  const HOOKS = {};
  window.APSQuote = {
    hooks: HOOKS,
    getMaterials: () => materials,
    setMaterials: (arr) => {
      materials = Array.isArray(arr) ? arr : [];
      renderMaterials();
    },
    addMaterial: (row) => addMaterial(row),
    render: () => renderMaterials(),
    getLabour: () => $("labour").value,
    setLabour: (v) => {
      $("labour").value = v === "" || v == null ? "" : Number(v);
      updateTotals();
    },
    getMode: () => mode,
    money: (n) => money(n),
    toast: (m) => toast(m),
    getBigMarkup: () => bigMarkup,
    onBigMarkupChange: (cb) => {
      if (typeof cb === "function") bigMarkupListeners.push(cb);
    },
  };

  function notifyBigMarkup() {
    bigMarkupListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        /* add-on */
      }
    });
  }

  function moneyParts() {
    const parts = new Intl.NumberFormat("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(1000.1);
    return {
      group: (parts.find((p) => p.type === "group") || {}).value || ",",
      decimal: (parts.find((p) => p.type === "decimal") || {}).value || ".",
    };
  }

  function moneyFromCents(cents) {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const a = Math.abs(n);
    const rands = Math.trunc(a / 100);
    const rem = String(a % 100).padStart(2, "0");
    const sep = moneyParts();
    const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, sep.group);
    return "R " + (neg ? "-" : "") + grouped + sep.decimal + rem;
  }

  function money(n) {
    return moneyFromCents(randsToCents(n));
  }

  function randsToCents(n) {
    return Math.round((Number(n) || 0) * 100);
  }

  function extCents(qty, cost) {
    return Math.round((Number(qty) || 0) * randsToCents(cost));
  }

  function roundRatio(num, den) {
    const sign = num < 0 ? -1 : 1;
    const a = Math.abs(Math.round(num));
    return sign * Math.floor((a + Math.floor(den / 2)) / den);
  }

  function todayStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function suggestQuoteNumber() {
    return `APS-${todayStamp()}-01`;
  }

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast no-print";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function clientMeta(code) {
    const hit = CLIENT_BY_CODE[code];
    if (hit) return { group: hit[0], clientLabel: hit[1] };
    return { group: "supply", clientLabel: "Supply pipe and fittings" };
  }

  function blankLine(partial) {
    const code = partial?.code || "";
    const meta = code ? clientMeta(code) : { group: "", clientLabel: "" };
    return {
      desc: partial?.desc || "",
      qty: partial?.qty != null && partial.qty !== "" ? Number(partial.qty) : 1,
      cost: partial?.cost != null && partial.cost !== "" ? Number(partial.cost) : 0,
      code,
      fromKit: !!partial?.fromKit,
      bigticket: !!partial?.bigticket,
      group: partial?.group || (partial?.fromKit ? meta.group : ""),
      clientLabel: partial?.clientLabel || (partial?.fromKit ? meta.clientLabel : ""),
    };
  }

  function kitOn() {
    return materials.some((m) => m.fromKit);
  }

  function setMode(next) {
    mode = next === "internal" ? "internal" : "client";
    document.body.classList.toggle("mode-client", mode === "client");
    document.body.classList.toggle("mode-internal", mode === "internal");
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderMaterials();
  }

  function splitCents() {
    let big = 0;
    let small = 0;
    let plain = 0;
    materials.forEach((m) => {
      const ext = extCents(m.qty, m.cost);
      if (m.fromKit && m.bigticket) big += ext;
      else if (m.fromKit) small += ext;
      else plain += ext;
    });
    return { big, small, plain };
  }

  function materialsCentsAt(percent) {
    const { big, small, plain } = splitCents();
    const bigRate = 100 + percent;
    return roundRatio(big * bigRate + small * 130, 100) + plain;
  }

  function lineSellMap(percent) {
    const total = materialsCentsAt(percent);
    const parts = materials.map((m, i) => {
      const ext = extCents(m.qty, m.cost);
      const rate = m.fromKit ? (m.bigticket ? 100 + percent : 130) : 100;
      const num = ext * rate;
      return { i, base: Math.floor(num / 100), frac: num % 100 };
    });
    let remain = total - parts.reduce((s, p) => s + p.base, 0);
    if (remain > 0) {
      const order = parts.slice().sort((a, b) => b.frac - a.frac || a.i - b.i);
      for (let k = 0; remain > 0 && k < order.length; k++) {
        order[k].base += 1;
        remain -= 1;
      }
    }
    const map = new Map();
    parts.forEach((p) => map.set(p.i, p.base));
    return map;
  }

  function calc() {
    const materialsSumCents = materialsCentsAt(bigMarkup);
    const labourCents = randsToCents($("labour").value);
    const totalCents = materialsSumCents + labourCents;
    const depositCents = roundRatio(totalCents * 80, 100);
    return { materialsSumCents, labourCents, totalCents, depositCents };
  }

  function updateTotals() {
    const t = calc();
    $("materialsTotalDisplay").textContent = moneyFromCents(t.materialsSumCents);
    $("tMaterials").textContent = moneyFromCents(t.materialsSumCents);
    $("tLabour").textContent = moneyFromCents(t.labourCents);
    $("tGrand").textContent = moneyFromCents(t.totalCents);
    $("tDeposit").textContent = moneyFromCents(t.depositCents);
    MARKUP_CHOICES.forEach((pct) => {
      const el = $("mk" + pct);
      if (!el) return;
      const cents = materialsCentsAt(pct);
      el.textContent = moneyFromCents(cents);
      el.dataset.cents = String(cents);
    });
    document.querySelectorAll(".markup-opt").forEach((btn) => {
      const on = Number(btn.dataset.markup) === bigMarkup;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function syncKitChrome() {
    const on = kitOn();
    $("labourKitNote").hidden = !on;
    $("kitExclusions").hidden = !on;
    $("markupBox").hidden = false;
    const showEditor = mode === "internal" && on;
    $("kitEditor").hidden = !showEditor;
    $("materialsWrap").hidden = showEditor;
    $("materialsHintClient").textContent = on ? HINT_CLIENT_KIT : HINT_CLIENT;
    $("materialsHintInternal").textContent = on ? HINT_INTERNAL_KIT : HINT_INTERNAL;
    $("materialsTable").classList.toggle("kit-summary", mode === "client" && on);
    syncPrintJob();
    document.querySelectorAll(".kit-btn").forEach((btn) => {
      const selected = btn.dataset.kit === activeKit;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function syncPrintJob() {
    const name = $("clientName").value.trim();
    const phone = $("clientPhone").value.trim();
    const suburb = $("suburb").value.trim();
    const quote = $("quoteNumber").value.trim();
    const job = $("jobType").value;
    const scope = $("scope").value.trim();
    const meta = [phone, suburb, quote, job].filter(Boolean).join(" · ");
    const bits = [];
    if (name) bits.push(`<div><strong>${escapeHtml(name)}</strong></div>`);
    if (meta) bits.push(`<div class="print-meta">${escapeHtml(meta)}</div>`);
    if (scope) bits.push(`<p class="print-scope">${escapeHtml(scope)}</p>`);
    $("printJob").innerHTML = bits.join("");
  }

  function clientLines() {
    const kitLines = materials.filter((m) => m.fromKit && (Number(m.qty) || 0) > 0);
    if (!kitLines.length) {
      return materials
        .filter((m) => (m.desc || "").trim())
        .map((m) => ({ text: m.desc.trim(), qty: Number(m.qty) || 0, showQty: true }));
    }
    const labelByGroup = new Map();
    kitLines.forEach((m) => {
      if (!labelByGroup.has(m.group)) labelByGroup.set(m.group, m.clientLabel);
    });
    const out = [];
    GROUP_ORDER.forEach((g) => {
      if (labelByGroup.has(g)) out.push({ text: labelByGroup.get(g), showQty: false });
    });
    materials.forEach((m) => {
      if (m.fromKit || !(m.desc || "").trim()) return;
      out.push({ text: m.desc.trim(), qty: Number(m.qty) || 0, showQty: true });
    });
    return out;
  }

  function renderMaterials() {
    const tbody = $("materialsBody");
    const editor = $("kitEditor");
    tbody.innerHTML = "";
    editor.innerHTML = "";
    const on = kitOn();
    if (!materials.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" style="color:var(--muted);font-size:0.85rem;padding:0.75rem 0.25rem;">No materials yet — tap + Add line, a package, or a kit.</td>`;
      tbody.appendChild(tr);
      updateTotals();
      syncKitChrome();
      return;
    }
    if (mode === "client" && on) {
      clientLines().forEach((line) => {
        const tr = document.createElement("tr");
        const qty = line.showQty && line.qty ? String(line.qty) : "—";
        tr.innerHTML = `
          <td class="internal-col"></td>
          <td class="client-desc">${escapeHtml(line.text)}</td>
          <td class="col-qty">${escapeHtml(qty)}</td>
          <td class="internal-col"></td>
          <td class="internal-col"></td>
          <td class="col-act no-print"></td>`;
        tbody.appendChild(tr);
      });
    } else if (!(mode === "internal" && on)) {
      const sells = lineSellMap(bigMarkup);
      materials.forEach((m, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="col-code internal-col"><span class="code">${escapeHtml(m.code || "")}</span></td>
          <td><input type="text" data-i="${i}" data-f="desc" value="${escapeAttr(m.desc)}" placeholder="e.g. 22mm ball valve" /></td>
          <td class="col-qty"><input type="number" data-i="${i}" data-f="qty" min="0" step="1" inputmode="decimal" value="${m.qty}" /></td>
          <td class="col-cost internal-col"><input type="number" data-i="${i}" data-f="cost" min="0" step="0.01" inputmode="decimal" value="${m.cost}" /></td>
          <td class="col-line internal-col"><span class="line-total">${moneyFromCents(sells.get(i) || 0)}</span></td>
          <td class="col-act no-print"><button type="button" class="btn-icon" data-del="${i}" aria-label="Remove line">×</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    if (mode === "internal" && on) {
      const sells = lineSellMap(bigMarkup);
      materials.forEach((m, i) => {
        const row = document.createElement("div");
        row.className = "kit-line" + (m.bigticket ? " is-big" : "");
        row.innerHTML = `
          <div class="kit-line-top">
            <span class="code">${escapeHtml(m.code || "—")}</span>
            ${m.bigticket ? '<span class="big-tag">Tank / pump</span>' : ""}
            <button type="button" class="btn-icon" data-del="${i}" aria-label="Remove line">×</button>
          </div>
          <textarea data-i="${i}" data-f="desc" rows="2">${escapeHtml(m.desc)}</textarea>
          <div class="kit-line-nums">
            <label>Qty<input type="number" data-i="${i}" data-f="qty" min="0" step="1" inputmode="decimal" value="${m.qty}" /></label>
            <label>Cost<input type="number" data-i="${i}" data-f="cost" min="0" step="0.01" inputmode="decimal" value="${m.cost}" /></label>
            <span class="line-total">${moneyFromCents(sells.get(i) || 0)}</span>
          </div>
        `;
        editor.appendChild(row);
      });
    }
    if (HOOKS.afterRender) HOOKS.afterRender(tbody, materials);
    updateTotals();
    syncKitChrome();
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function addMaterial(row) {
    const src = row || {};
    materials.push({
      ...src,
      ...blankLine(src),
      ...src,
      desc: src.desc || "",
      qty: src.qty != null ? Number(src.qty) : 1,
      cost: src.cost != null ? Number(src.cost) : 0,
    });
    renderMaterials();
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    activeKit = "";
    $("jobType").value = p.jobType;
    $("scope").value = p.scope;
    $("scope").placeholder = p.scope;
    $("labour").value = "";
    materials = p.materials.map((m) => blankLine(m));
    if (!$("quoteNumber").value.trim()) {
      $("quoteNumber").value = suggestQuoteNumber();
    }
    renderMaterials();
    toast("Package loaded — fill costs & labour");
    if (HOOKS.afterPreset) HOOKS.afterPreset(key);
  }

  function applyKit(key) {
    const data = window.APS_TANK_KITS;
    const spec = data && data.kits ? data.kits[key] : null;
    if (!spec) {
      toast("Kit list is missing on this phone");
      return;
    }
    const byCode = new Map((data.items || []).map((item) => [item.code, item]));
    const big = new Set(data.bigticket || []);
    const missing = spec.find((line) => !byCode.get(line.code));
    if (missing) {
      toast("Kit list is incomplete");
      return;
    }
    activeKit = key;
    materials = spec.map((line) => {
      const item = byCode.get(line.code);
      const meta = clientMeta(line.code);
      return blankLine({
        desc: item.name,
        qty: line.qty,
        cost: item.cost,
        code: line.code,
        fromKit: true,
        bigticket: big.has(line.code),
        group: meta.group,
        clientLabel: meta.clientLabel,
      });
    });
    const tank = materials.find((m) => m.group === "tank");
    const pump = materials.find((m) => m.group === "pump");
    $("jobType").value = "Tank + booster backup";
    $("scope").value = `Supply and install a ${tank.clientLabel} and a ${pump.clientLabel} as a backup water supply. Includes an inline water filter, tank float valve, overflow pipe, mains bypass with non-return valve, pump cover, and connection to the existing supply.`;
    $("scope").placeholder = SCOPE_PLACEHOLDERS["Tank + booster backup"];
    $("labour").value = "9000";
    $("labour").dispatchEvent(new Event("input", { bubbles: true }));
    if (!$("quoteNumber").value.trim()) {
      $("quoteNumber").value = suggestQuoteNumber();
    }
    renderMaterials();
    const meta = KIT_META[key];
    toast(meta ? `${meta.size} ${meta.tier} loaded` : "Kit loaded");
  }

  function setBigMarkup(pct) {
    const n = Number(pct);
    bigMarkup = MARKUP_CHOICES.indexOf(n) === -1 ? 30 : n;
    try {
      localStorage.setItem(MARKUP_KEY, String(bigMarkup));
    } catch {
      /* private mode */
    }
    notifyBigMarkup();
    renderMaterials();
  }

  function readForm() {
    return {
      id: Date.now(),
      savedAt: new Date().toISOString(),
      clientName: $("clientName").value.trim(),
      clientPhone: $("clientPhone").value.trim(),
      suburb: $("suburb").value.trim(),
      quoteNumber: $("quoteNumber").value.trim() || suggestQuoteNumber(),
      jobType: $("jobType").value,
      scope: $("scope").value.trim(),
      labour: Number($("labour").value) || 0,
      ...(HOOKS.extraForm ? HOOKS.extraForm() : {}),
      kitId: activeKit,
      bigticketMarkup: bigMarkup,
      materials: materials.map((m) => ({
        ...m,
        desc: m.desc,
        qty: Number(m.qty) || 0,
        cost: Number(m.cost) || 0,
        code: m.code || "",
        fromKit: !!m.fromKit,
        bigticket: !!m.bigticket,
        group: m.group || "",
        clientLabel: m.clientLabel || "",
      })),
    };
  }

  function loadForm(q) {
    $("clientName").value = q.clientName || "";
    $("clientPhone").value = q.clientPhone || "";
    $("suburb").value = q.suburb || "";
    $("quoteNumber").value = q.quoteNumber || suggestQuoteNumber();
    $("jobType").value = q.jobType || "";
    $("scope").value = q.scope || "";
    $("labour").value = q.labour != null && q.labour !== "" ? q.labour : "";
    activeKit = q.kitId || "";
    if (MARKUP_CHOICES.indexOf(Number(q.bigticketMarkup)) !== -1) {
      bigMarkup = Number(q.bigticketMarkup);
      try {
        localStorage.setItem(MARKUP_KEY, String(bigMarkup));
      } catch {
        /* private mode */
      }
    }
    materials = Array.isArray(q.materials)
      ? q.materials.map((m) => ({
          ...m,
          ...blankLine(m),
          ...m,
          desc: m.desc || "",
          qty: Number(m.qty) || 0,
          cost: Number(m.cost) || 0,
        }))
      : [];
    if (!materials.some((m) => m.fromKit)) activeKit = "";
    renderMaterials();
    if (HOOKS.afterLoad) HOOKS.afterLoad(q);
  }

  function buildClientText() {
    const q = readForm();
    const t = calc();
    const lines = [];
    lines.push("APS PLUMBING — QUOTE");
    lines.push("────────────────────");
    if (q.quoteNumber) lines.push(`Quote: ${q.quoteNumber}`);
    if (q.clientName) lines.push(`Client: ${q.clientName}`);
    if (q.clientPhone) lines.push(`Phone: ${q.clientPhone}`);
    if (q.suburb) lines.push(`Suburb: ${q.suburb}`);
    if (q.jobType) lines.push(`Job: ${q.jobType}`);
    lines.push("");
    lines.push("SCOPE OF WORK");
    lines.push(q.scope || "(To be confirmed on site)");
    lines.push("");
    const summary = clientLines();
    if (summary.length) {
      lines.push("MATERIALS (summary)");
      summary.forEach((m) => {
        lines.push(m.showQty ? `• ${m.text}${m.qty ? ` × ${m.qty}` : ""}` : `• ${m.text}`);
      });
      lines.push("");
    }
    lines.push("PRICING");
    lines.push(`Materials total: ${moneyFromCents(t.materialsSumCents)}`);
    lines.push(`Labour: ${moneyFromCents(t.labourCents)}`);
    lines.push(`TOTAL: ${moneyFromCents(t.totalCents)}`);
    lines.push(`Deposit to book (80%): ${moneyFromCents(t.depositCents)}`);
    lines.push("");
    lines.push("80% deposit required to book. Balance on completion.");
    lines.push("APS is not VAT-registered.");
    lines.push("Thank you — APS Plumbing");
    return lines.join("\n");
  }

  function digitsPhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.startsWith("0") && d.length === 10) d = "27" + d.slice(1);
    return d;
  }

  function getSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function setSaved(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  }

  function saveQuote() {
    const q = readForm();
    if (!q.clientName && !q.scope && !q.materials.length) {
      toast("Add a client or materials first");
      return;
    }
    let list = getSaved().filter((x) => x.quoteNumber !== q.quoteNumber);
    list.unshift(q);
    setSaved(list);
    renderSaved();
    toast("Quote saved on this phone");
  }

  function renderSaved() {
    const list = getSaved();
    const ul = $("savedList");
    ul.innerHTML = "";
    if (!list.length) {
      ul.innerHTML = `<li class="saved-empty">No saved quotes yet.</li>`;
      return;
    }
    list.forEach((q) => {
      const li = document.createElement("li");
      const when = q.savedAt
        ? new Date(q.savedAt).toLocaleString("en-ZA", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      const label = q.clientName || "Untitled";
      const meta = [q.quoteNumber, q.jobType, when].filter(Boolean).join(" · ");
      li.innerHTML = `
        <button type="button" class="saved-item" data-load="${q.id}">
          <strong>${escapeAttr(label)}</strong>
          <span>${escapeAttr(meta)}</span>
        </button>
        <button type="button" class="saved-del" data-remove="${q.id}" aria-label="Delete">×</button>
      `;
      ul.appendChild(li);
    });
  }

  function newQuote() {
    activeKit = "";
    $("clientName").value = "";
    $("clientPhone").value = "";
    $("suburb").value = "";
    $("quoteNumber").value = suggestQuoteNumber();
    $("jobType").value = "";
    $("scope").value = "";
    $("scope").placeholder =
      "Keep it short — no fitting brands or sizes that help competitors shop the quote.";
    $("labour").value = "";
    materials = [];
    renderMaterials();
    if (HOOKS.afterNew) HOOKS.afterNew();
    toast("New blank quote");
  }

  function onMaterialInput(e) {
    const t = e.target;
    if (!t.dataset || t.dataset.i == null) return;
    const i = Number(t.dataset.i);
    const f = t.dataset.f;
    if (!materials[i] || !f) return;
    if (f === "desc") materials[i].desc = t.value;
    else materials[i][f] = t.value === "" ? 0 : Number(t.value);
    if (f === "qty" || f === "cost") {
      const sells = lineSellMap(bigMarkup);
      document.querySelectorAll(".line-total").forEach((el, idx) => {
        if (sells.has(idx)) el.textContent = moneyFromCents(sells.get(idx) || 0);
      });
      updateTotals();
    }
  }

  function onMaterialClick(e) {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const i = Number(btn.dataset.del);
    materials.splice(i, 1);
    if (!kitOn()) activeKit = "";
    renderMaterials();
  }

  function bind() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
    });

    document.querySelectorAll(".kit-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyKit(btn.dataset.kit));
    });

    document.querySelectorAll(".markup-opt").forEach((btn) => {
      btn.addEventListener("click", () => setBigMarkup(btn.dataset.markup));
    });

    $("addMaterial").addEventListener("click", () => addMaterial());

    $("materialsBody").addEventListener("input", onMaterialInput);
    $("kitEditor").addEventListener("input", onMaterialInput);
    $("materialsBody").addEventListener("click", onMaterialClick);
    $("kitEditor").addEventListener("click", onMaterialClick);

    $("labour").addEventListener("input", updateTotals);

    ["clientName", "clientPhone", "suburb", "quoteNumber", "scope"].forEach((id) => {
      $(id).addEventListener("input", syncPrintJob);
    });
    $("jobType").addEventListener("change", syncPrintJob);

    $("jobType").addEventListener("change", () => {
      const jt = $("jobType").value;
      if (SCOPE_PLACEHOLDERS[jt] && !$("scope").value.trim()) {
        $("scope").placeholder = SCOPE_PLACEHOLDERS[jt];
      }
    });

    $("btnCopy").addEventListener("click", async () => {
      const text = buildClientText();
      try {
        await navigator.clipboard.writeText(text);
        toast("Client quote copied");
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Client quote copied");
      }
    });

    $("btnWhatsApp").addEventListener("click", () => {
      const text = buildClientText();
      const phone = digitsPhone($("clientPhone").value);
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    });

    $("btnPrint").addEventListener("click", () => {
      setMode("client");
      window.print();
    });

    window.addEventListener("beforeprint", () => {
      syncPrintJob();
      if (mode !== "client") setMode("client");
    });

    $("btnSave").addEventListener("click", saveQuote);
    $("btnNew").addEventListener("click", newQuote);

    $("savedList").addEventListener("click", (e) => {
      const loadBtn = e.target.closest("[data-load]");
      const delBtn = e.target.closest("[data-remove]");
      if (loadBtn) {
        const id = Number(loadBtn.dataset.load);
        const q = getSaved().find((x) => x.id === id);
        if (q) {
          loadForm(q);
          toast("Quote reopened");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
      if (delBtn) {
        const id = Number(delBtn.dataset.remove);
        setSaved(getSaved().filter((x) => x.id !== id));
        renderSaved();
        toast("Removed");
      }
    });
  }

  function loadMarkupPref() {
    try {
      const v = localStorage.getItem(MARKUP_KEY);
      if (v === "25" || v === "20" || v === "30") bigMarkup = Number(v);
    } catch {
      bigMarkup = 30;
    }
  }

  function init() {
    loadMarkupPref();
    setMode("client");
    $("quoteNumber").value = suggestQuoteNumber();
    materials = [];
    renderMaterials();
    renderSaved();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
