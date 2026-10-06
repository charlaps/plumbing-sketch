/* APS Quote Helper — offline-first */
(function () {
  "use strict";

  const DEPOSIT_RATE = 0.8;
  const STORAGE_KEY = "aps-quote-saved-v1";
  const MAX_SAVED = 10;

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
  };

  /** @type {{desc:string, qty:number, cost:number}[]} */
  let materials = [];
  let mode = "client";

  const $ = (id) => document.getElementById(id);

  function money(n) {
    const v = Number(n) || 0;
    return "R " + v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
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

  function calc() {
    const materialsSum = materials.reduce((s, m) => {
      const q = Number(m.qty) || 0;
      const c = Number(m.cost) || 0;
      return s + q * c;
    }, 0);
    const labour = Number($("labour").value) || 0;
    const total = materialsSum + labour;
    const deposit = total * DEPOSIT_RATE;
    return { materialsSum, labour, total, deposit };
  }

  function updateTotals() {
    const t = calc();
    $("materialsTotalDisplay").textContent = money(t.materialsSum);
    $("tMaterials").textContent = money(t.materialsSum);
    $("tLabour").textContent = money(t.labour);
    $("tGrand").textContent = money(t.total);
    $("tDeposit").textContent = money(t.deposit);
  }

  function renderMaterials() {
    const tbody = $("materialsBody");
    tbody.innerHTML = "";
    if (!materials.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="color:var(--muted);font-size:0.85rem;padding:0.75rem 0.25rem;">No materials yet — tap + Add line or pick a package.</td>`;
      tbody.appendChild(tr);
      updateTotals();
      return;
    }
    materials.forEach((m, i) => {
      const line = (Number(m.qty) || 0) * (Number(m.cost) || 0);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" data-i="${i}" data-f="desc" value="${escapeAttr(m.desc)}" placeholder="e.g. 22mm ball valve" /></td>
        <td class="col-qty"><input type="number" data-i="${i}" data-f="qty" min="0" step="1" inputmode="decimal" value="${m.qty}" /></td>
        <td class="col-cost internal-col"><input type="number" data-i="${i}" data-f="cost" min="0" step="0.01" inputmode="decimal" value="${m.cost}" /></td>
        <td class="col-line internal-col"><span class="line-total">${money(line)}</span></td>
        <td class="col-act no-print"><button type="button" class="btn-icon" data-del="${i}" aria-label="Remove line">×</button></td>
      `;
      tbody.appendChild(tr);
    });
    updateTotals();
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function addMaterial(row) {
    materials.push({
      desc: row?.desc || "",
      qty: row?.qty != null ? Number(row.qty) : 1,
      cost: row?.cost != null ? Number(row.cost) : 0,
    });
    renderMaterials();
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    $("jobType").value = p.jobType;
    $("scope").value = p.scope;
    $("scope").placeholder = p.scope;
    $("labour").value = "";
    materials = p.materials.map((m) => ({ ...m }));
    if (!$("quoteNumber").value.trim()) {
      $("quoteNumber").value = suggestQuoteNumber();
    }
    renderMaterials();
    toast("Package loaded — fill costs & labour");
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
      materials: materials.map((m) => ({
        desc: m.desc,
        qty: Number(m.qty) || 0,
        cost: Number(m.cost) || 0,
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
    materials = Array.isArray(q.materials)
      ? q.materials.map((m) => ({
          desc: m.desc || "",
          qty: Number(m.qty) || 0,
          cost: Number(m.cost) || 0,
        }))
      : [];
    renderMaterials();
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
    if (q.materials.some((m) => m.desc.trim())) {
      lines.push("MATERIALS (summary)");
      q.materials.forEach((m) => {
        if (!m.desc.trim()) return;
        const qty = Number(m.qty) || 0;
        lines.push(`• ${m.desc}${qty ? ` × ${qty}` : ""}`);
      });
      lines.push("");
    }
    lines.push("PRICING");
    lines.push(`Materials total: ${money(t.materialsSum)}`);
    lines.push(`Labour: ${money(t.labour)}`);
    lines.push(`TOTAL: ${money(t.total)}`);
    lines.push(`Deposit to book (80%): ${money(t.deposit)}`);
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
    toast("New blank quote");
  }

  function bind() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
    });

    $("addMaterial").addEventListener("click", () => addMaterial());

    $("materialsBody").addEventListener("input", (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.i == null) return;
      const i = Number(t.dataset.i);
      const f = t.dataset.f;
      if (!materials[i] || !f) return;
      if (f === "desc") materials[i].desc = t.value;
      else materials[i][f] = t.value === "" ? 0 : Number(t.value);
      if (f === "qty" || f === "cost") {
        const lineEl = t.closest("tr")?.querySelector(".line-total");
        if (lineEl) {
          const line = (Number(materials[i].qty) || 0) * (Number(materials[i].cost) || 0);
          lineEl.textContent = money(line);
        }
        updateTotals();
      }
    });

    $("materialsBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del]");
      if (!btn) return;
      const i = Number(btn.dataset.del);
      materials.splice(i, 1);
      renderMaterials();
    });

    $("labour").addEventListener("input", updateTotals);

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

  function init() {
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
