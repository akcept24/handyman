# Furniture Assembly Landing Page — Build Report

Date: 2026-11-27. Status: **built and verified locally; NOT committed, NOT pushed, NOT deployed** (coordinator ships).

## What was built

New page `furniture-assembly.html`, modeled section-for-section on `workstation-setup.html` (structure, classes, forms) with the residential tone of `home-office-setup.html`:

- SEO head mirroring siblings: title, meta description, canonical, OG/Twitter cards, Schema.org `Service` JSON-LD (validated by the site test suite).
- Hero: furniture assembly in the Santa Clarita Valley, IKEA/Wayfair/Amazon, same-week appointments (Mon–Sat 8–6), "we bring the tools", packaging broken down. Phone CTA +1 (661) 485-3595 throughout (nav, hero, footer, mobile bar).
- What's-included services grid (6 cards, all `data-service="furniture-assembly"`), published-price table, 4-step process, service-area panel (Santa Clarita, Valencia, Newhall, Canyon Country, Stevenson Ranch, Saugus, Castaic), estimate section, 6-question FAQ (price by item type, duration, tools, packaging disposal, booking lead time, brands/missing parts).
- Upsell strip "While we're in the room": TV mounting (from $149 → `index.html#pricing`) and home office setup (from $299 → `home-office-setup.html`), plus a same-visit to-do-list card (`data-service="general-repairs"`).
- "Not a licensed contractor" disclosure in the scope note (minor-work scope, jobs under $1,000), price note, and footer — same placement/wording pattern as siblings.
- All three standard forms (hero quick form, contact estimate form, modal) copied exactly: same field names, honeypot `fax_number`, hidden `consent_version` = `2026-08-20`, consent checkbox text. `script.js` assigns `form_type` by form id (`hero-form`/`contact-form`/`modal-form`) with no page-specific code. Service slug is the pre-existing **`furniture-assembly`** from `ALLOWED_SERVICES` (server.js line 18), preselected in all three selects. `ALLOWED_SERVICES` and the chat widget were NOT touched.
- Hero image: existing asset `/images/generated/project-assembly.webp` (1200×800, declared at true size).

## Files changed (4)

| File | Change |
|---|---|
| `furniture-assembly.html` | NEW (~33 KB) |
| `server.js` | +1 line: `['/furniture-assembly.html', 'furniture-assembly.html']` in `STATIC_FILES` |
| `Dockerfile` | `furniture-assembly.html` added to the HTML COPY list |
| `sitemap.xml` | +1 URL entry (`lastmod 2026-11-27`, priority 0.8) → **17 URLs total** |

## ⚠️ Price discrepancy the coordinator must resolve

The task brief specified "assembly from $99". The live site catalog says otherwise in three places: homepage service card "Furniture assembly — From $89 per item", homepage price table "Furniture assembly — From $89 per item" / "Wardrobes & large furniture assembly — From $199", and `home-office-setup.html` "Desk assembly from $89". The standing pricing decision on record (2026-11-25) was also "don't raise prices until reviews and flow exist". The page was therefore built with the **catalog's real anchors: from $89 per item, wardrobes from $199, $95 visit & estimate fee (credited toward approved work)** — a landing page quoting $99 against a homepage quoting $89 would contradict itself in front of ad traffic. If $99 is an intended price change, it is a one-line edit on this page plus the homepage card/table, and should ship together.

## Verification (all run 2026-11-27 in this clone)

- `npm test` — exit 0. Node: `tests/server.test.js` **43/43 pass**. Python: `tests/test_site.py` **20/20 pass** (includes JSON-LD validity, canonical/domain, honeypot + consent on every form, local-asset existence, unlicensed-status disclosure, Docker runtime-module coverage).
- HTML structure: parser pass — no unclosed/stray tags.
- Live boot (`PORT=3219 node server.js`): `GET /furniture-assembly.html` → **200** with correct `<title>`; `GET /furniture-assembly` → 301 (same as siblings).
- Lead-path probe: `POST /api/submit-quote` with `service=furniture-assembly`, `form_type=hero_form`, current `consent_version`, and a deliberately invalid phone returned **only** the phone error — slug, form type, and consent version all validated. No lead was delivered (validation stops before delivery).
- Grep checks: 3 forms present (`hero-form`, `contact-form`, `modal-form`), `furniture-assembly` preselected in 3/3 selects, 3 honeypots, 3 consent-version fields; sitemap `<loc>` count = 17.

## Not verified / notes

- Not deployed — no production check possible or attempted. After deploy, re-check the live URL and submit one real test lead end-to-end (Telegram + Beckloop intake), as was done for prior pages.
- Copy judgment calls for coordinator review: packaging copy promises boxes are "broken down and stacked by your recycling bin at no extra charge" (matches the brief's FAQ requirement; adjust if haul-away policy differs). Wall anchoring is presented as "included with wardrobes" — no separate catalog price exists for it.
- Homepage furniture-assembly card still links via modal (`data-service`) rather than to the new page; pointing it (and the home-office cross-references) at `furniture-assembly.html` is a separate small edit, out of this task's scope.
