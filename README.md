# California Handyman

Production-oriented landing page for handyman estimate requests in California.

## What is included

- Responsive landing page with accessible navigation, forms, modal, FAQ, and legal pages
- Consistent SEO URLs for `https://california-handymen.com`
- Node.js server with no runtime dependencies
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

## Required production environment

| Variable | Required | Purpose |
|---|---:|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Token for the bot that delivers estimate requests |
| `TELEGRAM_CHAT_ID` | Yes | User, group, or channel ID that receives leads |
| `PORT` | No | HTTP port; defaults to `3000` |

The bot must be able to send messages to the configured chat. For a group, add the bot to that group before testing.

## Coolify deployment

1. Create or update the application from this GitHub repository.
2. Choose **Dockerfile** as the build pack.
3. Set container port to `3000`.
4. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as runtime secrets.
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
