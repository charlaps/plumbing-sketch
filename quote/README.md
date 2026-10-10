# APS Quote Helper

Offline-first, phone-first web app for APS Plumbing quotes. Client view hides per-item prices; internal view keeps unit costs. Static files only — no build step, no npm.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell, form, materials table, totals, actions |
| `styles.css` | Brand UI (#004AAD) + print/PDF layout |
| `app.js` | Calcs, presets, kits, localStorage, copy / WhatsApp / print |
| `kits/tank-booster.json` | Plumblink Krugersdorp tank + booster shelf prices, checked 6 Oct 2026 |
| `kits/tank-booster.js` | Same kit data, loaded with the page so it works offline |
| `site.webmanifest` | Add-to-home-screen metadata |
| `README.md` | This file |

## How Charl uses it

1. Open `index.html` on the phone (or host the folder). Tap a **package** (geyser / basin / toilet / filter) or a **tank + booster kit**, fill client details, check costs on **Internal**, set labour, then switch to **Client** — materials show description + qty only; pricing is materials, consumables (5% of materials), labour, and an 80% deposit. APS is not VAT-registered.
2. **Copy client text** or **Open WhatsApp** to send the short-scope quote; **Print / Save PDF** for a branded one-pager.
3. **Save quote** keeps the last 10 on that device (localStorage); reopen from the list to edit.

## Quote rules baked in

- Generic material names on the client side (e.g. “22mm ball valve”)
- No per-item prices on client quote — materials total, consumables (5%), labour and grand total only. No VAT.
- Short scope — no fitting detail for competitors
- 80% deposit to book

## Tank + booster backup kits

**Kits** has nine presets: 1,000 L, 2,500 L and 5,000 L, each as Budget, Typical or Premium. Loading one fills the quote with shelf cost × qty. Lines stay editable.

- Markup follows Charl's tiered rule (10 Oct 2026, see below): tanks and pumps 20/25%, pipe 30/35%, fittings 40/45%, set with the **Markup: Low / High** switch. Internal view shows both materials totals and each line's class and %.
- Labour prefills at R9,000. The note “labour not yet confirmed by Charl” is internal only.
- Client WhatsApp text and print/PDF use plain names only (no brand, code or material type) and group the fittings. Prices shown are materials total, consumables (5%), labour, total and the 80% deposit. No VAT line.

## Note

Does not replace Sketch, Field Manual, or Field App. Separate folder only.

## Auto-pull prices (Plumblink + APS labour)

Added files (nothing removed):

| File | Purpose |
|------|---------|
| `autoprice.js` | Plumblink type-ahead (Internal view), markup selectors, job-book labour picker, typical-materials kits, package auto-pricing |
| `autoprice.css` | Styles for the above |
| `aps-data.json` | APS Job Book labour (97 jobs, `u:1` = yellow/unconfirmed), live price checks 5–6 Oct (override the snapshot), typical kits, package→job map, markup class per Plumblink code (`cls`) |

- Plumblink catalogue is **reused** from `../field/items.json` (Field App, snapshot 4 Oct 2026, 5,232 items) and only fetched when you first search (≈129 KB gzipped).
- Sell = Plumblink cost incl VAT × markup for the item's class (tiered rule, 10 Oct 2026, below).
- Client text / print show generic names + qty, materials total, labour, total and 80% deposit only. Codes, brands, Plumblink names, per-item prices and "unconfirmed" badges are Internal-only. No VAT anywhere.
- A hand-typed unit price wins over Plumblink for that line. Typing labour by hand clears the job-book link.
- To refresh data: regenerate `aps-data.json` (box script `/workspace/aps-quote-v2/build/build_data.py`) and/or the Field App's `items.json`.

## 8 Oct 2026 update (geyser inspection repairs, basin rates, live check)

Changed files: `index.html`, `app.js`, `autoprice.js`, `autoprice.css`, `aps-data.json`, `README.md`. Nothing removed. `field/items.json` is not touched.

- **After geyser inspection** card: 150 L geyser swap, valve refresh, and drip tray + drain line, each as Budget / Typical / Premium. One tap loads Plumblink-priced lines (Sourcing kits 5 Oct, re-checked 8 Oct) plus job-book labour (R5,000 swap; R975 / R1,300 valves; R1,300 tray). The geyser follows the shared 30/25/20% big-ticket selector. No call-out is added (the free inspection counts as the call-out, Charl to confirm). An internal note shows Quoting's 8 Oct price bands. "Itemise" lists every Plumblink item.
- **Basin / vanity** package: labour defaults to R2,275 (straight swap). Tap "New supply pipework" for R2,500 (approx 4 hrs, confirmed: quoted to Charles Shopfitters). Both are also in the job-book search.
- **Prices**: `aps-data.json` checks now cover 126 codes live-checked up to 8 Oct 2026 (no price or stock changes). Six Kwikot valve pages were renamed on Plumblink (001346, 001343, 040402, 001347, 007706, 001518). `aps-data.json` `urls` / `names` override them. Internal meta rows link each Plumblink code to its product page.
- The 30/25/20% compare boxes now also reflect Plumblink-priced geysers (they were flat before).
- Asset URLs carry `?v=20261008` so phones pick up the update without a hard refresh.
- Client output is unchanged: generic names, no per-item prices, totals + 80% deposit, "APS is not VAT-registered."

## 10 Oct 2026 update (tiered markup)

Changed files: `index.html`, `app.js`, `autoprice.js`, `autoprice.css`, `aps-data.json`, `kits/tank-booster.json`, `kits/tank-booster.js`, `README.md`. Nothing removed. `field/items.json` is not touched.

Charl's rule (10 Oct 2026) replaces the flat 30% and the 30/25/20% big-ticket selector:

| Class | Low | High | What |
|---|---:|---:|---|
| Expensive | 20% | 25% | geysers, water heaters, heat pumps, solar geysers, tanks, pumps, and any other single item at R750 or more |
| Pipe | 30% | 35% | lengths of copper tube, PVC / HDPE / PEX / multilayer / galv pipe, suction hose (any price) |
| Fitting | 40% | 45% | fittings, valves, traps, wastes, flexis, mixers, consumables, covers, filters and everything else |

- **Markup: Low / High** switch (Internal view). Default **High**; the choice is remembered on this phone (`aps-quote-markup-tier`). A saved quote reopens at the setting it was saved with. Both boxes show the materials total at that setting.
- Every Internal line shows its class and % (tank-kit lines, Plumblink lines, itemised kits, search results; package lines list each item's class).
- How items are classed (`aps-data.json` `cls`, all 5,232 items in `field/items.json`): 1) Sourcing's classification for the 115 kit codes in `tiered-markup-20261010.json`; 2) **pipe**: Plumblink pipe categories, or a pipe/tube/hose name with a length, any price; 3) **expensive**: geyser / water heater / heat pump / solar geyser / tank / pump main units (not spares), or any other item at R750+ (Sourcing's threshold); 4) **fitting**: everything else. The rule agrees with Sourcing on all 115 of its codes.
- Counts: **1,335 expensive**, **357 pipe**, **3,540 fitting** (expensive: 1,230 by the R750 threshold, 88 geyser/tank/pump units, rest from Sourcing).
- Tank kits: markup per class on shelf cost, total rounded once (Sourcing's rounding), so all nine kits match Sourcing to the cent at Low and High. Geyser repairs and the geyser/basin packages match within a few cents.
- **Consumables (5%)** is 5% of the materials total after markup, not of labour. It is its own line in the Internal view and in the client output (listed next to the materials total). It is included in the grand total and the 80% deposit. Saved quotes pick it up when they are reopened and recalculated. Kit material totals are unchanged.
- Client output otherwise stays: generic names, no per-item prices, no class or markup %, "APS is not VAT-registered."
- Asset URLs carry `?v=20261010b`.
