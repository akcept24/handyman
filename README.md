# California Handymen

Production-oriented landing page for handyman estimate requests in California.

## What is included

- Responsive landing page with accessible navigation, forms, modal, FAQ, and legal pages
- Consistent SEO URLs for `https://california-handymen.com`
- Node.js server with no runtime dependencies
- Shared Agent Core for the website chat and a future voice adapter
- Lead validation and Telegram delivery
- Honest form state: success is shown only after Telegram accepts the message
- Honeypot field, request size limit, output escaping, CSP, and security headers
- Automated backend and static-site regression tests

## Local development

```bash
npm test
npm start
```

Open `http://localhost:3000`.

Without Telegram environment variables the site still renders, but estimate submissions return a clear temporary-unavailable error. To test real delivery locally:

```bash
export TELEGRAM_BOT_TOKEN='your-bot-token'
export TELEGRAM_CHAT_ID='your-chat-id'
npm start
```

Never commit real tokens to the repository.

## Voice intake adapter

The provider-neutral voice tool API uses `Content-Type: application/json` and
`Authorization: Bearer <VOICE_TOOL_SECRET>` on every request. The secret is compared in constant
time, and both routes fail closed when it is missing, shorter than 32 characters, or contains
whitespace. `GET /ready/voice` is ready only when the
voice secret and both Telegram settings are configured.

- `POST /api/voice/service-area` accepts exactly `{ "zip": "91355" }` (ZIP+4 is also accepted).
  It returns only `{ "eligible": true, "zip": "91355" }`; the server-owned allowlist is never
  returned.
- `POST /api/voice/lead` validates and delivers a full lead only when
  `recording_consent` is exactly `accepted` and explicit callback/text consent is true. Declined
  or unknown recording consent must use the website or a separately approved minimal workflow;
  this endpoint will reject it. A successful response is
  `{ "success": true, "delivered": true, "call_id": "..." }`. Delivery is acknowledged only
  after Telegram returns an integer `message_id`.

The lead's `location.service_area_eligible` must equal the result computed by the server-owned ZIP
allowlist. A correct `false` value does **not** reject the lead: the request is delivered with a
prominent **OUT OF AREA — HUMAN REVIEW REQUIRED; DO NOT PROMISE SERVICE** warning. Service must
never be promised based on submission or delivery.

Successful `call_id` values and a SHA-256 fingerprint of the canonical, validated lead are kept in
a bounded, 24-hour in-memory idempotency store. Exact concurrent or later retries coalesce and do
not consume another lead-delivery limit unit. Reusing a live `call_id` with different validated
lead details returns `409 Conflict`, including while the first delivery is in flight. In-flight
entries are never evicted; when every bounded slot is in flight, a new unique call fails with
`503 IDEMPOTENCY_CAPACITY`, while an exact retry still coalesces. Known Telegram rejections can be
retried. Network/timeouts or an accepted-looking response without a receipt are indeterminate and
cached for the call/payload TTL as `DELIVERY_INDETERMINATE`; exact retries fail closed without
resending. This is duplicate-safe fail-closed behavior, not guaranteed delivery. The store is
per-process and resets on restart.

Authenticated voice limits are practical **tenant-wide safety caps**, not caller identification:
1,000 total authenticated requests per five minutes before body parsing/validation, plus
100 validated, non-idempotent lead attempts per five minutes and 300 valid service-area checks per
minute by default. Voice providers commonly share source IPs, so neither IP nor these caps should
be described as identifying individual callers. Enforce distributed provider/CDN safeguards when
running multiple replicas.

Voice lead JSON has this strict shape (unlisted properties are rejected):

```json
{
  "call_id": "provider-call-id",
  "caller": {
    "name": "Alex Smith",
    "callback_phone": "(661) 259-0199",
    "preferred_contact": "phone"
  },
  "location": { "zip": "91355", "service_area_eligible": true },
  "project": {
    "category": "general-repairs",
    "reported_problem": "Interior door sticks.",
    "location_on_property": "Hallway",
    "trigger": "When closing",
    "severity": "moderate",
    "onset": "this week",
    "damage": "No visible damage",
    "previous_attempts": "None",
    "photos_available": true,
    "materials_available": false,
    "materials": "Unknown",
    "dimensions": "Unknown",
    "access_notes": "Call on arrival",
    "model_brand": "Unknown"
  },
  "safety": {
    "flags": ["none"],
    "scope_review_flags": [],
    "immediate_danger": false,
    "licensed_trade_review": false
  },
  "preferences": {
    "urgent": false,
    "preferred_callback_window": "Weekday afternoon"
  },
  "assessment": {
    "uncertainty": ["Exact hinge condition"],
    "missing_info": ["Door material"]
  },
  "detected_language": "en",
  "recording_consent": "accepted",
  "callback_consent": true,
  "commitments": {
    "price_promised": false,
    "appointment_confirmed": false,
    "job_accepted": false
  }
}
```

Enums: `preferred_contact` is `phone`, `text`, or `either`; language is `en`, `es`, or `ru`;
the full endpoint accepts only `recording_consent: "accepted"`; project categories include
`tv-mounting`. Optional project diagnostic properties may be omitted, but if present must have the
declared string/boolean type and cannot be `null`. The callback window
may be `null`. Strings and arrays have server-side bounds, callback consent must be `true`, all
three commitments must be `false`, and location eligibility must match the server result.

Safety booleans are not model judgments. The backend rejects any contradiction with this explicit
flag mapping; multiple flags combine with logical OR. `preferences.urgent` is an independent caller
preference and is not derived from hazard flags:

| Flag | `immediate_danger` | `licensed_trade_review` |
|---|---:|---:|
| `none` | false | false |
| `gas-odor` | true | true |
| `fire-or-smoke` | true | true |
| `sparks-or-hot-electrical` | true | true |
| `active-flooding-near-electricity` | true | true |
| `sewage-exposure` | true | true |
| `structural-instability` | true | true |
| `immediate-danger` | true | false |
| `other` | false | false |

Generate a random `VOICE_TOOL_SECRET` of 32–4096 characters with an appropriate password manager
or OS CSPRNG. It must contain no whitespace. Store it only as a runtime secret and configure the
same value in the voice provider's tool authentication. Do not place it in prompts, browser code,
logs, or this repository.

## Required production environment

| Variable | Required | Purpose |
|---|---:|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Token for the bot that delivers estimate requests |
| `TELEGRAM_CHAT_ID` | Yes | User, group, or channel ID that receives leads |
| `OPENROUTER_API_KEY` | Yes for chat | Server-side key used by the AI assistant; never exposed to the browser |
| `VOICE_TOOL_SECRET` | Yes for voice | Random 32–4096 character Bearer secret without whitespace; voice routes fail closed when missing or invalid |
| `OPENROUTER_MODEL` | No | Chat model; defaults to `deepseek/deepseek-v4-flash` |
| `CHAT_DAILY_LIMIT` | No | Per-process daily provider-call circuit breaker; defaults to `200`; invalid values fail closed |
| `TRUST_PROXY_HOPS` | No | Explicit trusted reverse-proxy hop count for rate-limit identity; defaults to `0` |
| `PORT` | No | HTTP port; defaults to `3000` |

The bot must be able to send messages to the configured chat. For a group, add the bot to that group before testing. `CHAT_DAILY_LIMIT` is a last-resort single-replica safety net; enforce the primary distributed rate/spend cap at the CDN/provider because restarts or multiple replicas reset/multiply the in-process counter.

## Coolify deployment

1. Create or update the application from this GitHub repository.
2. Choose **Dockerfile** as the build pack.
3. Set container port to `3000`.
4. Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `OPENROUTER_API_KEY` as runtime secrets.
5. Deploy and verify:
   - `/` returns the landing page
   - `/privacy.html` and `/terms.html` return `200`
   - a controlled test request arrives in the expected Telegram chat
   - the form shows success only after delivery

## Tests

```bash
npm test
```

The suite checks:

- lead validation, Telegram escaping, failure and success behavior
- canonical domain, robots, sitemap, and JSON-LD
- absence of demo phone numbers, fake ratings, and tracking placeholders
- working local links and assets
- accessible form labels
- real network submission instead of simulated success
- content visibility without JavaScript and reduced-motion support

## Before advertising

The site intentionally does **not** invent a phone number, address, license, insurance, rating, reviews, pricing, or business hours. Add those only after they are verified. Before running ads, also configure analytics and conversion tracking with real account IDs, and test the entire lead path on production.
