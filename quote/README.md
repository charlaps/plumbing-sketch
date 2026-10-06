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

1. Open `index.html` on the phone (or host the folder). Tap a **package** (geyser / basin / toilet / filter) or a **tank + booster kit**, fill client details, check costs on **Internal**, set labour, then switch to **Client** — materials show description + qty only; pricing is materials + labour and an 80% deposit. APS is not VAT-registered.
2. **Copy client text** or **Open WhatsApp** to send the short-scope quote; **Print / Save PDF** for a branded one-pager.
3. **Save quote** keeps the last 10 on that device (localStorage); reopen from the list to edit.

## Quote rules baked in

- Generic material names on the client side (e.g. “22mm ball valve”)
- No per-item prices on client quote — materials total, labour and grand total only. No VAT.
- Short scope — no fitting detail for competitors
- 80% deposit to book

## Tank + booster backup kits

**Kits** has nine presets: 1,000 L, 2,500 L and 5,000 L, each as Budget, Typical or Premium. Loading one fills the quote with shelf cost × qty. Lines stay editable.

- Small parts are marked up 30%. Tanks and pumps use 30%, 25% or 20% (default 30%, remembered on this phone). Internal view shows all three materials totals.
- Labour prefills at R9,000. The note “labour not yet confirmed by Charl” is internal only.
- Client WhatsApp text and print/PDF use plain names only (no brand, code or material type) and group the fittings. Prices shown are materials total, labour, total and the 80% deposit. No VAT line.

## Note

Does not replace Sketch, Field Manual, or Field App. Separate folder only.
