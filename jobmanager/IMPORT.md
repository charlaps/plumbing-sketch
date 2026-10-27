# Import a quote into Job Manager

Until Supabase is connected, a quote reaches this phone as a link. Charl opens it. Job Manager shows a short card, for example **Add Derick - quote R 1,170.00?** Tap **Add to Job Manager**. The phone matches or creates the client and the site, then creates one job at **Quoted** with the quote attached.

Open the same link again and the card says **Update**. That tap changes the same quote. It does not add a second job. A job that has already moved past Quoted stays at its stage.

The phone works out the money. It does not trust a total sent in the link. APS is not VAT-registered. Do not put VAT or bank details in the JSON.

## Build a link

From the repo root:

```bash
node jobmanager/tools/make-import-link.js quote.json
```

That prints one URL:

```text
https://charlaps.github.io/plumbing-sketch/jobmanager/#import=<base64url>
```

`quote.json` is the object below. It must include a stable `id`. The tool will not invent one.

```bash
node jobmanager/tools/make-import-link.js --example
node jobmanager/tools/make-import-link.js --gzip quote.json
node jobmanager/tools/make-import-link.js --deflate quote.json
node jobmanager/tools/make-import-link.js --auto quote.json
node jobmanager/tools/make-import-link.js - < quote.json
```

`--example` is a kitchen mixer for Derick: labour R650, call-out R650, total **R 1,300.00**, deposit **R 1,040.00**, no materials, no VAT.

`--auto` leaves the JSON plain, and gzips it when the plain URL is longer than 1500 characters. `--gzip` and `--deflate` always compress. The hash is base64url (no `+`, `/`, or `=`).

`APS_JM_ORIGIN` changes the site. The default is `https://charlaps.github.io/plumbing-sketch/jobmanager/`.

## What the phone does with the hash

`#import=` is read on this phone. The bytes are:

1. JSON text, if they start with `{`
2. gzip, if they start with `1f 8b`
3. zlib deflate, if they start with `0x78`
4. raw deflate otherwise

Nothing is saved until the card is tapped. **Not now** leaves the phone as it was.

## JSON schema

Ignored if present: `totals`, `vat`, and any other extra field. The phone recalculates.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://charlaps.github.io/plumbing-sketch/jobmanager/import-quote.schema.json",
  "title": "APS Job Manager import quote",
  "type": "object",
  "additionalProperties": true,
  "required": ["id", "client"],
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Stable quote id. A UUID is stored as quotes.id. Any other string is stored as import_id and the phone generates a UUID. The same id updates; it does not create a second job."
    },
    "no": {
      "type": "string",
      "description": "Quote number shown to the client, e.g. APS-Q-1042. The job number APS-J- is assigned on the phone."
    },
    "date": {
      "type": "string",
      "description": "Quote date YYYY-MM-DD. Defaults to the day the link is opened."
    },
    "client": { "type": "string", "description": "Matched case-insensitively. Alias: name." },
    "phone": { "type": "string" },
    "email": { "type": "string" },
    "address": { "type": "string", "description": "Alias: addr. Site match is client + address + suburb." },
    "suburb": { "type": "string", "description": "Alias: area." },
    "title": { "type": "string", "description": "Short job title. Alias: type." },
    "description": {
      "type": "string",
      "description": "What the job is. Stored on the quote and as the job scope. Shown on the client paper above the lines. Aliases: desc, scope."
    },
    "ah": {
      "type": "boolean",
      "default": false,
      "description": "Add 50% of the labour lines. Leave false when a line uses co Yes (after-hours), or labour is counted twice."
    },
    "cons": {
      "type": "boolean",
      "default": true,
      "description": "5% consumables on the materials sell total only. false turns that line off."
    },
    "tier": {
      "enum": ["high", "low"],
      "default": "high",
      "description": "Markup when a material line gives cost instead of each. High is 25 / 35 / 45. Low is 20 / 30 / 40."
    },
    "disc": {
      "type": "number",
      "default": 0,
      "description": "Percent off labour and the after-hours labour amount. 0 means no discount."
    },
    "mat_typed": {
      "type": "number",
      "default": 0,
      "description": "Extra materials sell total in rand, when those materials are not listed as lines."
    },
    "callout_lock": {
      "type": ["number", "null"],
      "description": "Omit this. Call-out comes from the line co flags: R650 once for Yes, R1,200 once for Yes (after-hours). Set a number only to force the call-out."
    },
    "not_included": {
      "type": "string",
      "description": "Omit it and the phone uses: Tiling, building, plaster, paint, electrical work, and any client-supplied items. Send an empty string to clear it."
    },
    "valid_days": { "type": "integer", "default": 14 },
    "items": {
      "type": "array",
      "description": "At least one line with qty > 0, or a mat_typed amount.",
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "kind": { "enum": ["labour", "material"], "default": "labour" },
          "name": { "type": "string", "description": "Labour book name, or the material name. Alias: j." },
          "generic": {
            "type": "string",
            "description": "Name the client sees. For labour this defaults to the name with the trailing parenthesis removed. For a material, set a plain name such as 22mm copper elbow."
          },
          "qty": { "type": "number", "default": 1, "description": "Alias: q." },
          "each": {
            "type": "number",
            "description": "Rand each. Labour: the full book price l from Quote Finale (27 Oct 2026). Use that price as printed. Materials: the sell price. Alias: l. If a material omits each and gives cost, the phone applies the markup tier."
          },
          "co": {
            "type": "string",
            "description": "Yes, No, Yes (after-hours), N/A, or No (free). Yes adds the R650 call-out once on the quote. Yes (after-hours) adds R1,200 once. Empty or No adds no call-out."
          },
          "cost": { "type": "number", "description": "Material cost price. Used only when each is omitted." },
          "cls": { "enum": ["e", "p", "f"], "description": "Markup class for cost. e expensive, p pipe, f fitting. Default f." }
        }
      }
    }
  }
}
```

Example file, which `--example` encodes:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "no": "APS-Q-DERICK",
  "date": "2026-10-20",
  "client": "Derick",
  "phone": "0820000000",
  "email": "",
  "address": "9 Test Road",
  "suburb": "Krugersdorp",
  "title": "Kitchen mixer",
  "description": "Replace the kitchen mixer.",
  "items": [
    {
      "kind": "labour",
      "name": "Replace kitchen mixer (standard deck)",
      "generic": "Replace kitchen mixer",
      "qty": 1,
      "each": 650,
      "co": "Yes"
    }
  ]
}
```

A material line:

```json
{
  "kind": "material",
  "name": "COPPERMAN COPCAL ELBOW 22x90 CXC",
  "generic": "22mm copper elbow",
  "qty": 2,
  "each": 145,
  "co": "No"
}
```

`each` here is the sell price. Consumables are 5% of the materials sell total. The deposit is 80% of the quote total. There is no VAT line.

Quote Finale names still work on a labour line: `j` for the name, `l` for the price, `q` for the quantity, `co` for the call-out flag.

Use a new `id` for a new quote. Reuse the id to change the price, the lines, or the description. If that quote was already approved and the money changes, it goes back to draft so the client can approve the new total.

## Labour price book

Price labour from Quote Finale. That file is the source. These are the full rates confirmed 27 Oct 2026. Use the printed price. Do not add VAT.

**Path:** `quote-app/index.html`

In that file:

| Name | What to use |
| --- | --- |
| `JOBS` | Array of `{ c, j, l, m, co }`. `j` is the line name. `l` is the rand price. `co` is `Yes`, `No`, `Yes (after-hours)`, `N/A`, or `No (free)`. `c` is the category. `m` is a note, not a price. |
| `HOURLY` | `{ j: "Repair / fault-finding labour (per hour)", l: 650, co: "Yes" }` |
| `CALLOUT` | `650`. Added once when any labour line has `co` starting with Yes, other than the after-hours flag. Includes the first 30 minutes. |
| `AH_CALLOUT` | `1200`. Added once when any labour line has `co` of `Yes (after-hours)`. Leave `ah` false. |
| `QUICK` | Shortcuts into `JOBS`. Not extra prices. |
| `RATE_BOOK` | `2026-10-27` |

Four lines are on the same rate card but are not inside `JOBS`. They live in `jobmanager/rates.js` as `EXTRAS`:

| Line | `l` | `co` |
| --- | --- | --- |
| Repair / fault-finding labour (per hour) | 650 | Yes |
| Crew day (3-man crew) | 4800 | No |
| Crew part-day (per hour) | 600 | No |
| Bathroom point (strip-out, first fix and second fix) | 2000 | No |

A bathroom point is strip-out R300 + first fix R1,000 + second fix R700. Geyser CoC is R850 (`Geyser plumbing CoC (add-on, if not included in geyser swap)` in `JOBS`). After-hours labour on the card is R975 an hour (×1.5). The after-hours minimum call-out is R1,200. A man-day inside the crew day is R1,600.

`jobmanager/rates.js` `CATALOGUE` is a copy of `JOBS` plus those four extras. If the two files ever disagree, use `quote-app/index.html` for `JOBS` and the table above for the four extras.

Materials are not in the labour book.

| Path | What it is |
| --- | --- |
| `field/items.json` | Plumblink catalogue: code, name, category, cost price |
| `quote-app/aps-data.json` | Generic names and the markup class (`e` expensive, `p` pipe, `f` fitting) |

Sell price = cost × (1 + markup). High tier (default): expensive 25%, pipe 35%, fitting 45%. Low tier: 20 / 30 / 40. Put that sell price in `each`, or send `cost` and `cls` and leave `each` out. Then add 5% consumables on the materials sell total only.
