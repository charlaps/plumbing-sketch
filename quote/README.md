# APS Quote Helper

Offline-first, phone-first web app for APS Plumbing quotes. Client view hides per-item prices; internal view keeps unit costs. Static files only — no build step, no npm.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell, form, materials table, totals, actions |
| `styles.css` | Brand UI (#004AAD) + print/PDF layout |
| `app.js` | Calcs, presets, localStorage, copy / WhatsApp / print |
| `site.webmanifest` | Add-to-home-screen metadata |
| `README.md` | This file |

## How Charl uses it

1. Open `index.html` on the phone (or host the folder). Tap a **package** (geyser / basin / toilet / filter), fill client details, add unit costs on **Internal**, set labour, then switch to **Client** — materials show description + qty only; pricing is totals + 15% VAT + 80% deposit.
2. **Copy client text** or **Open WhatsApp** to send the short-scope quote; **Print / Save PDF** for a branded one-pager.
3. **Save quote** keeps the last 10 on that device (localStorage); reopen from the list to edit.

## Quote rules baked in

- Generic material names on the client side (e.g. “22mm ball valve”)
- No per-item prices on client quote — materials total, labour, VAT, grand total only
- Short scope — no fitting detail for competitors
- 80% deposit to book

## Note

Does not replace Sketch, Field Manual, or Field App. Separate folder only.
