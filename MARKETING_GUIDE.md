# California Handyman — Google Ads Launch Sheet

**Status:** Pre-launch. Do not enable paid traffic until a real Google Ads conversion action is configured and the verification checklist below passes.

## Truthful advertising boundary

California Handyman is **not a licensed contractor**. Marketing must describe only qualifying casual, minor work that:

- totals under **$1,000 including labor and materials**;
- needs **no building permit**;
- needs **no licensed trade**;
- is not split into smaller jobs to bypass the limit.

Do not claim or imply licensure, insurance, bonded status, emergency availability, 24/7 service, same-day service, guaranteed arrival, a guaranteed price, ratings/reviews, or a service area broader than the one verified below.

## Service area

Target only the currently served Santa Clarita Valley locations:

- Santa Clarita
- Valencia
- Stevenson Ranch
- Castaic

Google Ads location option must be **Presence: people in or regularly in the targeted locations** — not interest.

## Allowed service positioning

Use only claims that match the live site and operational policy:

- minor home repairs
- doors, hardware, shelving, trim
- drywall patching and interior touch-up painting
- furniture assembly
- minor, non-permitted fixture work
- minor plumbing maintenance only when no licensed trade is required

Every landing page and ad must retain the legal scope disclosure. The owner confirms scope, pricing, availability, and any appointment.

## Prohibited copy and keyword themes

Never add these claims or terms unless the business scope, licenses, proof, and live website have been deliberately updated first:

```text
licensed / licensed handyman / licensed contractor
insured / bonded
emergency / 24 hour / 24-7 / same day
free estimate / guaranteed / best rated / five-star / reviews
all California / Los Angeles-wide
electrician / electrical repair / panel / wiring
gas / water heater / sewer / major plumbing
roofing / remodeling / renovation / permit / general contractor
```

## Initial campaign — controlled Search-only pilot

```text
Campaign name: Minor Handyman Repairs | Santa Clarita Valley | Search
Campaign type: Search only
Networks: Google Search only; Search Partners off; Display off
Locations: Santa Clarita, Valencia, Stevenson Ranch, Castaic
Location option: Presence
Match types: Exact and Phrase only; no Broad at launch
Bid strategy: Maximize conversions only after verified conversions exist;
              otherwise Maximize clicks with a strict CPC cap for the short validation period
Budget: $10–20/day maximum during the first 3–5 days
Ad schedule: only hours when owner/approved follow-up can handle leads
```

### Launch keyword seed

Use each only as exact (`[ ]`) or phrase (`" "`) match, with geographic intent where possible:

```text
"handyman santa clarita"
"handyman valencia ca"
"handyman stevenson ranch"
"handyman castaic"
"minor home repair santa clarita"
"drywall patch santa clarita"
"furniture assembly santa clarita"
"door repair santa clarita"
"shelf installation santa clarita"
```

### Campaign-level negative keywords

```text
job
jobs
career
careers
salary
salaries
employment
hiring
resume
apprentice
apprenticeship
training
course
courses
class
classes
school
certification
diy
"do it yourself"
tutorial
tutorials
youtube
"how to"
"handyman business"
"start a handyman business"
"handyman insurance"
"handyman software"
"handyman app"
"handyman franchise"
"handyman license"
"handyman tools"
"handyman supplies"
"handyman wages"
```

## Ad copy constraints

Write ads that accurately say:

- local minor home repair requests in the Santa Clarita Valley;
- scope review before scheduling;
- request an estimate / call to discuss a qualifying project.

Do **not** use price, response-time, availability, review, license, contractor, or emergency claims unless proven and live on the landing page.

## Conversion setup — required before traffic

The site intentionally counts a **confirmed form lead** only after:

```text
form validation → API success → Telegram delivery receipt → success response
```

Configure a Google Ads primary conversion action named something like:

```text
Confirmed estimate request
```

Then put the real value in `tracking.config.js`:

```js
googleAdsConversion: 'AW-123456789/AbCdEfGhIjKlMnOp'
```

The tracking loader derives and configures the base `AW-123456789` tag automatically. Do not insert a fake value. Phone clicks and Retell browser-call starts are analytics events only; they are not claimed as confirmed leads.

Create call measurement separately through Google Ads call reporting or a dedicated call-tracking provider. Do not make click-to-call a primary lead conversion unless it is reconciled to answered/qualified calls.

## Mandatory pre-launch checklist

- [ ] Google Ads conversion action created and real `AW-…/label` saved in the production config
- [ ] Live browser verifies Google tag loads with both GA4 and Google Ads config calls
- [ ] Controlled form request returns a real Telegram receipt and one Ads conversion
- [ ] Controlled PSTN inbound call reaches the published Handyman agent
- [ ] Voice agent does not promise price, availability, appointment, or licensed-trade work
- [ ] Owner receives and can act on lead delivery promptly during ad schedule
- [ ] Campaign remains paused until each checkbox is proven
- [ ] No broad keywords, Display network, Search Partners, or auto-applied recommendations enabled
- [ ] Daily budget is capped at $10–20 for the first validation period
- [ ] Search terms reviewed daily; irrelevant terms added as negatives

## Optimization cadence

For days 1–5, do not scale. Review each day:

```text
Spend
Search terms
Qualified calls
Confirmed Telegram-backed form leads
Cost per confirmed lead
Missed/abandoned calls
Out-of-area or out-of-scope requests
```

Pause any keyword that produces irrelevant, out-of-scope, or unqualified traffic. Scale only after the team can consistently follow up on qualified leads and conversion records are correct.
