# Furniture Assembly Email + Notification Playbook

## Safety boundary

- **Transactional email** is allowed only in response to a person’s specific estimate request and only where the person gave contact consent in that form.
- **Marketing email** is never implied by estimate-request consent. Send it only after a separate, affirmative marketing opt-in is stored with timestamp, source, and consent copy.
- Do not import, buy, scrape, or cold-email lists. Do not automate follow-ups to people who opted out, asked to stop, or did not request service.
- Every marketing message needs a working unsubscribe path and a truthful sender identity. No false urgency, fabricated availability, pricing, reviews, warranties, licensing, or “same-day” promises.

## Transactional lifecycle — furniture estimate requests

### T0: Request receipt
**Trigger:** the lead is confirmed delivered to Telegram and the lead supplied an email plus request-contact consent.

**Send once:** `templates/furniture-request-received.html`

**Subject:** `We received your furniture assembly request`

**Purpose:** receipt only. Do not quote price or availability. Ask for the furniture list / product links / photos only if needed.

### T0–T1: Human scope review
**Trigger:** a team member has reviewed the request.

**Send manually:** `templates/furniture-scope-review.html`

**Subject:** `A quick follow-up on your furniture assembly request`

**Purpose:** ask the smallest set of needed questions: furniture items, product links or photos, ZIP, parking/access constraints, and preferred contact window. Do not claim the project is accepted.

### T+1 business day: requested estimate follow-up
**Trigger:** customer asked for an estimate, has not declined, and a team member has an accurate update.

**Send manually:** `templates/furniture-estimate-follow-up.html`

**Subject:** `Your furniture assembly request — next step`

**Purpose:** provide the actual status. If an estimate is not ready, say that plainly. Do not auto-send repeated nudges.

## Marketing re-permission sequence — optional, not enabled

### Separate sign-up mechanism required first
Use a distinct checkbox or signup form containing materially equivalent wording:

> I would like occasional California Handymen news, seasonal home-project tips, and service updates by email. I understand this is optional and I can unsubscribe at any time.

Store: email, opt-in timestamp, source URL/UTM, exact consent copy version, unsubscribe state. Do not pre-check this box.

### Welcome email
**Template:** `templates/marketing-welcome-opt-in.html`

**Subject:** `You’re on the California Handymen updates list`

**Cadence after welcome:** at most one useful email per month, only to active subscribers. Examples: a furniture-assembly preparation checklist, seasonal minor-project checklist, or an availability update that is factually true at send time.

## Owner operating SLA

1. Telegram lead receipt arrives first.
2. Owner responds by call/text/email as requested; aim for a personal reply within five minutes during staffed hours — not a promise in advertising.
3. Confirm product list, ZIP, access, scope, and legal fit before offering an appointment.
4. Tag source: `google-furniture`, `offline-flyer`, `offline-card`, `door-hanger`, `magnet`, `organic`, or `referral`.
5. Record outcome: `reviewing`, `declined-out-of-scope`, `estimate-sent`, `scheduled`, `completed`, `no-response`, `opted-out`.
6. Send no promotional follow-up if the customer did not separately opt in.

## Before enabling email delivery

- Add a verified transactional sender domain and SPF/DKIM/DMARC.
- Configure an email provider with API credentials in deployment secrets — never in repository files.
- Implement unsubscribe suppression before enabling marketing mail.
- Test to an owner-controlled inbox only; do not send real customer mail until the sender, consent records, and copy are approved.
