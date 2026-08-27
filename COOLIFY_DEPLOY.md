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

# Resend transactional request confirmation — enable only after the domain is verified
RESEND_API_KEY=<set in Coolify, never commit>
RESEND_FROM_EMAIL=California Handyman <hello@california-handymen.com>
```

`PORT` defaults to `3000` and normally does not need to be set.
`CHAT_DAILY_LIMIT` is a per-container fallback circuit breaker. Configure a hard OpenRouter spending cap and edge/CDN throttling as the distributed production controls.
`TRUST_PROXY_HOPS=1` assumes exactly one trusted Coolify reverse-proxy hop and that the application port is not directly reachable by untrusted clients. Verify that topology before enabling it; otherwise keep `0` so forwarded headers are ignored.

## Resend sender-domain verification

Resend domain registration for `california-handymen.com` has been created but is not verified yet. Add the following DNS records at the authoritative DNS provider, exactly as shown, then check the domain status in Resend:

| Purpose | Host/name | Type | Value | Priority |
|---|---|---|---|---:|
| DKIM | `resend._domainkey` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQd9SttYZbNPFHuXGCdDhjPOmFzrHvM5t4mK+qX9WVJgusfWzWxOM/3CpTfn9jTYksd/dCJC6HWfkA+RyPcprz4RokF7LXsFptF4vSFWKJnrHioNalwbBEyFrGyzZKz/rTnixRP4PlX8nM6IYiFYOd1k2ts9TyfOfqSzRaR22btwIDAQAB` | — |
| SPF / MAIL FROM | `send` | MX | `feedback-smtp.us-east-1.amazonses.com` | `10` |
| SPF / MAIL FROM | `send` | TXT | `v=spf1 include:amazonses.com ~all` | — |

Do not set `RESEND_FROM_EMAIL` in Coolify until Resend reports the domain as verified. Once verified, use `California Handyman <hello@california-handymen.com>` (or another real, monitored inbox at that domain). The server sends only a request-specific confirmation after Telegram delivery is confirmed; it does not send marketing mail.

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
