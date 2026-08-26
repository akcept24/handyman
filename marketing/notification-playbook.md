# Furniture Assembly — Notification & Retention Playbook

**Status:** draft for owner approval. No sender integration or automatic campaign is enabled.

## 1) Lead owner notification (internal)

**Trigger:** lead successfully validated and downstream Telegram delivery is acknowledged.

**Destination:** existing owner Telegram lead channel only.

**Target response:** the owner reviews the lead promptly during the published response hours. Do not publish a guaranteed response time unless it is operationally proven.

**Current fields already delivered:** name, phone, optional email, ZIP, selected service, project message, form source, consent status/version, and receipt time.

**Internal triage checklist**

```text
[ ] ZIP is in the served Santa Clarita Valley area
[ ] Service is furniture assembly (or correctly categorized)
[ ] Project appears to fit current minor-work scope
[ ] Product/item list and number of pieces are understandable
[ ] Any mounting/licensed-trade/permit question is flagged for review
[ ] Owner chooses: request details / discuss scope / decline or refer
```

Do not paste a customer’s full data into group chats beyond the approved lead destination.

## 2) Transactional client sequence

These messages are tied to the customer’s specific request. They must not be repurposed into a bulk marketing list.

| Stage | Channel | Owner action before send | Template |
|---|---|---|---|
| Request delivered | Email, if email was supplied | Confirm lead receipt and no delivery issue | Email 01 — Request received |
| More information needed | Email or the lead’s requested channel | Write the specific missing items | Email 02 — Details request |
| Scope looks potentially suitable | Email or the lead’s requested channel | Owner confirms wording, scope and next question | Email 03 — Scope reviewed |
| Appointment has been agreed independently | Email/text confirmation | Include only actual agreed date/window/scope | Create a separate owner-approved confirmation template |
| Project complete | Direct conversation | Do not automate review/referral messaging without a separate consent and owner policy | Manual only |

## 3) Marketing / retention sequence

### Required condition

Only use this sequence if the person made a **separate affirmative choice** to receive marketing updates. The current website request consent explicitly says it is not marketing consent, so it cannot be used for this purpose.

Capture at least:

```text
email address
affirmative opt-in value
opt-in timestamp
source/page/form
consent wording/version
unsubscribe status and timestamp (if applicable)
```

### Suggested low-frequency cadence

| Timing | Audience | Message | Guardrail |
|---|---|---|---|
| 30–60 days after completed work | Opted-in prior customers only | “Another furniture project on your list?” | One concise email, no urgency claim |
| 6–9 months | Opted-in prior customers only | Local home-project reminder | Skip if they already requested/received recent contact |
| Any time | Unsubscribed contact | None | Suppress immediately |

Do not send weekly newsletters. One useful local message every few months is enough for this service.

## 4) Recommended operating model

```text
Website form
  → validation
  → Telegram owner notification (existing)
  → owner reviews scope
  → owner-approved transactional reply
  → optional separate marketing opt-in
  → provider-managed unsubscribe/suppression
  → low-frequency retention only
```

## 5) Sender setup decision gate

Before any live email:

1. Choose one sender: Google Workspace or Resend are reasonable candidates.
2. Verify the sending domain and set a monitored reply-to mailbox.
3. Create separate transactional and marketing audiences/tags.
4. Configure SPF/DKIM/DMARC using the provider’s documented values.
5. Create an unsubscribe URL for marketing only.
6. Send test messages only to an owner-controlled inbox.
7. Have the owner explicitly approve first live send and recipient segment.

## 6) Offline-to-online lead handling

Printed materials should use the public website and a readable phone number. If a QR code is later added, direct it to a campaign-specific but truthful URL and record only aggregate attribution unless the visitor submits a consented form.

Suggested print attribution tags, once analytics is configured:

```text
/?utm_source=offline&utm_medium=flyer&utm_campaign=furniture_assembly
/?utm_source=offline&utm_medium=business-card&utm_campaign=furniture_assembly
/?utm_source=offline&utm_medium=magnet&utm_campaign=furniture_assembly
```

Do not create tracking parameters with a customer’s personal information.

## 7) Owner approval checklist

```text
[ ] Sender platform selected
[ ] Domain verified and reply inbox monitored
[ ] Transactional vs marketing audiences separated
[ ] Separate marketing opt-in wording approved
[ ] Suppression/unsubscribe process tested
[ ] Each template checked for truthfulness and current service scope
[ ] No auto-send is enabled without owner approval
[ ] One test received successfully in owner inbox
```
