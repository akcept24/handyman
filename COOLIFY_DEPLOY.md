# Coolify deployment

## Application settings

- Source: this GitHub repository
- Build pack: **Dockerfile**
- Container port: `3000`
- Health check path: `/`
- Auto deploy: optional, recommended after the first verified release

## Required runtime secrets

```text
TELEGRAM_BOT_TOKEN=<set in Coolify, never commit>
TELEGRAM_CHAT_ID=<set in Coolify, never commit>
```

`PORT` defaults to `3000` and normally does not need to be set.

## Release verification

1. Deploy the exact Git commit intended for release.
2. Confirm `GET /`, `/privacy.html`, `/terms.html`, `/robots.txt`, and `/sitemap.xml` return `200`.
3. Submit a controlled test lead with a non-customer phone number.
4. Confirm the complete payload arrives in the configured Telegram destination.
5. Confirm the browser shows success only after Telegram delivery.
6. Temporarily set an invalid chat ID and confirm the form shows an error instead of success; restore the secret afterward.
7. Check desktop and mobile layouts.

## Troubleshooting

- `503` from `/api/submit-quote`: one or both Telegram variables are missing.
- `502`: Telegram rejected or timed out during delivery; verify token, chat ID, and bot membership.
- `400`: required fields or ZIP/phone validation failed.
- Page works but form fails: inspect the application logs without printing secret values.

## Security

- Store secrets only in Coolify runtime variables.
- Do not expose the bot token in browser JavaScript or HTML.
- Rotate the token immediately if it appears in logs, commits, screenshots, or chat messages.
