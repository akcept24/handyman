# Coolify deployment

## Application settings

- Source: this GitHub repository
- Build pack: **Dockerfile**
- Container port: `3000`
- Health check path: `/ready`
- Auto deploy: optional, recommended after the first verified release

## Required runtime secrets

```text
TELEGRAM_BOT_TOKEN=<set in Coolify, never commit>
TELEGRAM_CHAT_ID=<set in Coolify, never commit>
OPENROUTER_API_KEY=<set in Coolify, never commit>
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
CHAT_DAILY_LIMIT=200
TRUST_PROXY_HOPS=1
```

`PORT` defaults to `3000` and normally does not need to be set.
`CHAT_DAILY_LIMIT` is a per-container fallback circuit breaker. Configure a hard OpenRouter spending cap and edge/CDN throttling as the distributed production controls.
`TRUST_PROXY_HOPS=1` assumes exactly one trusted Coolify reverse-proxy hop and that the application port is not directly reachable by untrusted clients. Verify that topology before enabling it; otherwise keep `0` so forwarded headers are ignored.

## Release verification

1. Deploy the exact Git commit intended for release.
2. Confirm `GET /`, `/privacy.html`, `/terms.html`, `/robots.txt`, `/sitemap.xml`, `/chat-widget.css`, and `/chat-widget.js` return `200`.
3. Send a harmless chat question and confirm the AI answers without exposing configuration or inventing price/availability.
4. Submit a controlled test lead with a non-customer phone number.
5. Confirm the complete payload arrives in the configured Telegram destination.
6. Confirm the browser shows success only after Telegram delivery.
7. Temporarily set an invalid chat ID and confirm the form shows an error instead of success; restore the secret afterward.
8. Check desktop and mobile layouts.

## Troubleshooting

- `503` from `/api/submit-quote`: one or both Telegram variables are missing.
- `502`: Telegram rejected or timed out during delivery; verify token, chat ID, and bot membership.
- `400`: required fields or ZIP/phone validation failed.
- Page works but form fails: inspect the application logs without printing secret values.

## Security

- Store secrets only in Coolify runtime variables.
- Do not expose the bot token in browser JavaScript or HTML.
- Rotate the token immediately if it appears in logs, commits, screenshots, or chat messages.
