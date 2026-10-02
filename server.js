'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { BUSINESS_PROFILE, buildSystemPrompt, normalizeConversation, enforceReplyPolicy } = require('./agent-core');
const {
  authenticateBearer, createIdempotencyStore, fingerprintVoiceLead, formatVoiceLead,
  validateServiceArea, validateVoiceLead,
} = require('./voice-intake');

const ROOT = __dirname;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_VOICE_BODY_BYTES = 256 * 1024;
const ALLOWED_SERVICES = new Set([
  'general-repairs', 'fixtures-installations', 'painting-drywall',
  'furniture-assembly', 'carpentry', 'plumbing-maintenance', 'other',
]);
const ALLOWED_FORM_TYPES = new Set(['hero_form', 'contact_form', 'modal_form', 'chat_form']);
const CONSENT_VERSION = '2026-08-20';
const CHAT_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
const CHAT_SYSTEM_PROMPT = buildSystemPrompt('web');
const SERVICE_AREA_ZIPS = new Set(BUSINESS_PROFILE.serviceAreaZips);

const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/privacy.html', 'privacy.html'],
  ['/terms.html', 'terms.html'],
  ['/thank-you.html', 'thank-you.html'],
  ['/styles.css', 'styles.css'],
  ['/script.js', 'script.js'],
  ['/robots.txt', 'robots.txt'],
  ['/sitemap.xml', 'sitemap.xml'],
  ['/tracking.config.js', 'tracking.config.js'],
  ['/tracking.loader.js', 'tracking.loader.js'],
  ['/chat-widget.css', 'chat-widget.css'],
  ['/chat-widget.js', 'chat-widget.js'],
]);
const IMAGE_TYPES = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'],
]);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function clean(value, max = 1000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function normalizeSpamText(value) {
  const lookalikes = new Map([
    ['а', 'a'], ['е', 'e'], ['о', 'o'], ['р', 'p'], ['с', 'c'], ['х', 'x'],
    ['у', 'y'], ['і', 'i'], ['ј', 'j'], ['ѕ', 's'], ['ο', 'o'],
  ]);
  let text = clean(value, 2000).normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
  text = [...text].map(char => lookalikes.get(char) || char).join('');
  text = text
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/hxxps?:\/\//g, 'https://')
    .replace(/[‐‑‒–—−_-]+/g, ' ')
    .replace(/\bs\s*[. ]\s*e\s*[. ]\s*o\b/g, 'seo')
    .replace(/\bweb\s+sites?\b/g, 'website')
    .replace(/\bwebsites\b/g, 'website')
    .replace(/\bdigital\s*marketing\b/g, 'digital marketing')
    .replace(/\blead\s*gen(?:eration)?\b/g, 'lead generation')
    .replace(/\bbooking\s*system\b/g, 'booking system')
    .replace(/\bonline\s*booking\b/g, 'online booking')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function assessSpam(input) {
  const message = normalizeSpamText(input?.message);
  const compact = message.replace(/[^a-z0-9]+/g, '');
  const digits = clean(input?.phone, 30).replace(/\D/g, '');
  const reasons = [];

  const physicalObject = /\b(?:door|gate|fence|shel(?:f|ves|ving)|cabinet|wall|ceiling|drywall|furniture|desk|table|chair|bed|fan|garbage disposal|disposal|tv|monitor|tablet|display|kiosk|bracket|faucet|sink|toilet|trim|baseboard|window|curtain|rod|sign|fixture|light|lock|hinge|closer|outlet cover|room|office|studio|garage|home|apartment|damage)\b/;
  const strongPhysicalObject = /\b(?:door|gate|fence|shel(?:f|ves|ving)|cabinet|wall|ceiling|drywall|furniture|desk|table|chair|bed|fan|garbage disposal|disposal|tv|monitor|tablet|display|kiosk|bracket|faucet|sink|toilet|trim|baseboard|window|curtain|rod|sign|fixture|light|lock|hinge|closer|outlet cover|damage)\b/;
  const physicalAction = /\b(?:repair(?:s|ed|ing)?|fix(?:es|ed|ing)?|install(?:ation|ations|ed|ing)?|mount(?:ed|ing)?|assembl(?:y|ies|e|ed|ing)|paint(?:ed|ing)?|patch(?:ed|ing)?|anchor(?:ed|ing)?|replac(?:ement|ements|e|ed|ing)|hang|hung|adjust(?:ed|ing)?|remount(?:ed|ing)?|build|built|add|adding|set up)\b/;
  const digitalOnlyInstallation = /\b(?:build|create|design|redesign|improve|optimize)\s+(?:your\s+)?websites?\b|\b(?:install|add)\b.{0,40}\b(?:software|booking system|online booking)\b/.test(message)
    && !strongPhysicalObject.test(message);
  const repairIntent = physicalObject.test(message) && physicalAction.test(message) && !digitalOnlyInstallation;

  const marketingTopic = /\b(?:booking (?:system|platform|software)|online booking|online scheduler|scheduling (?:system|software)|appointment (?:scheduling|automation)|seo|search engine optimization|web design|website (?:audit|redesign)|digital marketing|marketing|social media marketing|social ads|advertising|marketing campaigns?|marketing packages?|lead generation|lead packages?|leads|local search|search visibility|google ranks?|google rankings?|rank higher|higher rankings?|backlinks?|found on google|google business profile|page one (?:of google|rankings?)|online presence|customer acquisition|customer base|more (?:customers|leads|bookings)|qualified leads|book more jobs)\b/;
  const websiteService = /\b(?:build|create|design|redesign|improve|optimize)\s+(?:your\s+)?websites?\b|\bwebsite (?:design|redesign|services?)\b/;
  const directRankingPitch = /\b(?:rank your\b.{0,50}\bon google|get page one rankings?)\b/;
  const sellerVoice = /\b(?:i|we|our agency|our company|our team|a specialist|our specialists?)\s+(?:can|could|would like to|want to|offer|provide|sell|build|create|design|redesign|improve|optimize|generate|guarantee|specialize|specializes|help|noticed|handle|add)\b/;
  const directSellerOffer = /\b(?:i|we|our agency|our company|our team)\s+(?:sell|provide|offer)\b/;
  const salesCta = /\b(?:would you be interested|are you interested|interested\??|can i send|may i send|contact us|learn more|email me(?: for (?:details|pricing))?|reply(?: for| if)?|send (?:you )?(?:a )?(?:proposal|pricing|examples|details)|book a quick call|quick call|free (?:website )?(?:audit|report)|complimentary (?:audit|analysis)|proposal|pricing|pay per lead|guarantee|let us|get more customers|more customers|grow(?:ing)? your (?:business|customer base)|miss out on|lost jobs|loses jobs|costs you customers|competitors rank|convert more visitors|discuss more customers)\b/;
  const b2bTarget = /\b(?:for (?:your|the) (?:business|company|website|site|handyman|contractor)|for contractors|for handymen|service businesses|home service companies)\b/;
  const salesUrl = /(?:https?:\/\/|www\.|\b(?:calendly|growth)\.[a-z]{2,})/;
  const referenceUrl = strongPhysicalObject.test(message)
    && /\b(?:photos?|pictures?|reference|purchased|bought|product|damage)\b.{0,120}(?:https?:\/\/|www\.)/.test(message);
  const promotionalUrl = salesUrl.test(message) && !referenceUrl;
  const spacedBookingPitch = compact.includes('nothavingonlinebooking') && /(?:lostjobs|losesjobs|missout|customers)/.test(compact);
  const businessNeedsMarketing = /\byour business (?:needs|could use) (?:a )?(?:better )?(?:website|web design|marketing|seo)\b/.test(message);
  const compactMarketing = /(?:bookingsystem|onlinebooking|onlinescheduler|appointmentscheduling|appointmentautomation|seo|searchengineoptimization|webdesign|websiteredesign|digitalmarketing|socialmediamarketing|socialads|advertising|marketingcampaign|marketingpackage|leadgeneration|leadpackage|localsearch|searchvisibility|googleranking|googlebusinessprofile|pageoneofgoogle|onlinepresence|customeracquisition|morecustomers|moreleads|qualifiedleads)/;
  const compactSeller = /(?:ican|wecan|icould|wecould|iwouldliketo|wewouldliketo|ouragency|ourcompany)(?:add|build|create|design|redesign|improve|optimize|generate|offer|help|handle|specialize)/;
  const compactSalesCta = /(?:wouldyoubeinterested|areyouinterested|canisend|mayisend|replyfor|sendproposal|sendpricing|sendexamples|senddetails|quickcall|freeaudit|freewebsiteaudit|freereport|complimentaryanalysis|payperlead|growyourbusiness|missouton|lostjobs|losesjobs|costsyoucustomers|convertmorevisitors)/;
  const topicDetected = marketingTopic.test(message) || compactMarketing.test(compact)
    || websiteService.test(message) || directRankingPitch.test(message);
  const sellerDetected = sellerVoice.test(message) || compactSeller.test(compact);
  const ctaDetected = salesCta.test(message) || compactSalesCta.test(compact);
  const standaloneSalesClause = message.split(/[.!?;\n]+/).some(clause => {
    const clauseCompact = clause.replace(/[^a-z0-9]+/g, '');
    const clauseTopic = marketingTopic.test(clause) || compactMarketing.test(clauseCompact);
    const clauseSeller = sellerVoice.test(clause) || compactSeller.test(clauseCompact);
    const clauseRepair = strongPhysicalObject.test(clause) && physicalAction.test(clause);
    return clauseTopic && clauseSeller && !clauseRepair;
  });
  const shortPitch = message.split(/\s+/).length <= 12
    && /\b(?:seo services|booking software|website redesign|lead generation|marketing partnership)\b/.test(message)
    && /\b(?:contractors?|handymen|business|company|interested|reply|pricing|call)\b/.test(message);
  const promotionalArtifact = /\b(?:complimentary\b.{0,40}\b(?:analysis|audit)|see our (?:lead|marketing) packages?|customer acquisition services?|lead packages?)\b/.test(message);
  let score = 0;
  if (topicDetected) score += 2;
  if (sellerDetected && !repairIntent) score += 3;
  if (ctaDetected) score += 3;
  if (b2bTarget.test(message)) score += 1;
  if (promotionalUrl && topicDetected) score += 3;
  if (promotionalArtifact && topicDetected) score += 3;
  if (spacedBookingPitch || businessNeedsMarketing || shortPitch || directRankingPitch.test(message)
      || (standaloneSalesClause && (ctaDetected || directSellerOffer.test(message)))) score += 6;
  if (repairIntent) score -= 3;
  const commercialSolicitation = score >= 5;

  if (commercialSolicitation) reasons.push('commercial-solicitation');
  if (/^(?:1)?555/.test(digits)) reasons.push('fictional-phone');
  if (promotionalUrl && commercialSolicitation) reasons.push('promotional-link');

  return { blocked: commercialSolicitation, reasons };
}

const LEAD_STRING_FIELDS = ['name', 'phone', 'email', 'zip', 'service', 'message', 'form_type', 'consent_version', 'fax_number', 'website'];
const LEAD_FIELDS = new Set([...LEAD_STRING_FIELDS, 'contact_consent', 'urgent']);

function hasValidLeadFieldTypes(input) {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).every(field => LEAD_FIELDS.has(field))
    && LEAD_STRING_FIELDS.every(field => input[field] == null || typeof input[field] === 'string')
    && (input.contact_consent == null || typeof input.contact_consent === 'boolean' || input.contact_consent === 'on')
    && (input.urgent == null || typeof input.urgent === 'boolean' || input.urgent === 'on'));
}

function validateLead(input) {
  if (!hasValidLeadFieldTypes(input)) {
    return { valid: false, errors: ['Invalid field type.'], lead: {} };
  }

  const lead = {
    name: clean(input?.name, 100),
    phone: clean(input?.phone, 30),
    email: clean(input?.email, 160),
    service: clean(input?.service, 80),
    zip: clean(input?.zip, 10),
    message: clean(input?.message, 2000),
    form_type: clean(input?.form_type, 40),
    urgent: input?.urgent === true || input?.urgent === 'on',
    contact_consent: input?.contact_consent === true || input?.contact_consent === 'on',
    consent_version: clean(input?.consent_version, 30),
    fax_number: clean(input?.fax_number, 200),
  };
  const errors = [];
  if (lead.name.length < 2) errors.push('Please enter your name.');
  const phoneDigits = lead.phone.replace(/\D/g, '');
  const nationalPhone = phoneDigits.length === 11 && phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
  if (!/^[+\d().\s-]+$/.test(lead.phone) || !/^[2-9]\d{2}[2-9]\d{6}$/.test(nationalPhone)
      || /^(\d)\1{9}$/.test(nationalPhone) || /0000$/.test(nationalPhone)) {
    errors.push('Please enter a valid phone number.');
  }
  if (!ALLOWED_SERVICES.has(lead.service)) errors.push('Please select a valid service.');
  if (!ALLOWED_FORM_TYPES.has(lead.form_type)) errors.push('Invalid form source.');
  if (lead.consent_version !== CONSENT_VERSION) errors.push('Please review and accept the current contact terms.');
  if (!/^\d{5}(?:-\d{4})?$/.test(lead.zip)) {
    errors.push('Please enter a valid ZIP code.');
  }
  // Out-of-area leads are accepted and flagged for human review (same policy
  // as the voice intake path) instead of being silently discarded.
  lead.service_area_eligible = /^\d{5}/.test(lead.zip)
    ? SERVICE_AREA_ZIPS.has(lead.zip.slice(0, 5))
    : false;
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.push('Please enter a valid email.');
  if (!lead.contact_consent) errors.push('Please agree to the contact and website terms.');
  return { valid: errors.length === 0, errors, lead };
}

function formatLead(lead) {
  const furnitureRequest = lead.service === 'furniture-assembly';
  const outOfArea = lead.service_area_eligible === false;
  const rows = [
    furnitureRequest ? '<b>🛋 Furniture assembly request</b>' : '<b>🧰 New handyman estimate request</b>',
    outOfArea ? '<b>⚠️ OUT OF AREA — HUMAN REVIEW REQUIRED; DO NOT PROMISE SERVICE</b>' : '',
    '<b>────────────────</b>',
    `<b>Contact:</b> ${escapeHtml(lead.name)} · ${escapeHtml(lead.phone)}`,
    lead.email ? `<b>Email:</b> ${escapeHtml(lead.email)}` : '',
    `<b>Area:</b> ${escapeHtml(lead.zip)}${outOfArea ? ' (outside current service area)' : ''}`,
    `<b>Service:</b> ${escapeHtml(lead.service)}`,
    lead.message ? `<b>Project:</b> ${escapeHtml(lead.message)}` : '',
    '<b>────────────────</b>',
    furnitureRequest
      ? '<b>Next:</b> Confirm furniture list/photos, access details, and scope before discussing timing or price.'
      : '<b>Next:</b> Confirm scope, access details, and legal fit before discussing timing or price.',
    lead.urgent ? '<b>Customer marked:</b> Urgent — review safety and scope first.' : '',
    lead.review_flags?.length ? `<b>Review flags:</b> ${escapeHtml(lead.review_flags.join(', '))}` : '',
    `<b>Source:</b> ${escapeHtml(lead.form_type || 'unknown')}`,
    `<b>Request contact consent:</b> ${lead.contact_consent ? 'Recorded' : 'Not recorded'}`,
    `<b>Received:</b> ${escapeHtml(lead.received_at || 'not recorded')}`,
  ];
  return rows.filter(Boolean).join('\n');
}

function renderRequestReceivedEmail(lead) {
  const firstName = escapeHtml(lead.name.split(/\s+/, 1)[0] || 'there');
  const isFurniture = lead.service === 'furniture-assembly';
  const service = escapeHtml(isFurniture ? 'Furniture assembly' : 'Home project');
  const projectHint = isFurniture
    ? 'Product links, assembly manuals, box counts, measurements, or a few room photos can help with review.'
    : 'A few photos or any helpful project details can make the scope review easier.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#edf1f5;color:#172b44;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Your California Handymen request has been received. We typically follow up within 1 business day.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf1f5"><tr><td align="center" style="padding:32px 12px 40px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;margin:0 auto"><tr><td style="padding:0 0 12px 4px;color:#65758a;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Santa Clarita Valley · California</td></tr><tr><td style="overflow:hidden;border-radius:18px;background:#ffffff;box-shadow:0 14px 36px rgba(22,42,68,.14)"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:30px 34px 27px;background:#102a43;background:linear-gradient(135deg,#102a43 0%,#1e4968 100%);color:#ffffff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:middle"><div style="font-size:22px;line-height:1.1;font-weight:400;letter-spacing:-.4px">California <strong>Handymen</strong></div><div style="margin-top:9px;color:#c7d8e7;font-size:12px;line-height:1.4">Local project review, handled with care.</div></td><td align="right" style="vertical-align:middle"><div style="display:inline-block;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:8px 12px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase">Request received</div></td></tr></table></td></tr><tr><td style="height:5px;background:#e88332;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:34px 34px 12px"><div style="color:#e06f1c;font-size:11px;font-weight:800;letter-spacing:1.25px;text-transform:uppercase">You’re all set for review</div><h1 style="margin:10px 0 14px;color:#102a43;font-size:31px;line-height:1.13;letter-spacing:-.8px;font-weight:700">Thanks, ${firstName}.</h1><p style="margin:0;color:#42566b;font-size:16px;line-height:1.65">Your <strong style="color:#102a43">${service} request</strong> has been received. We’ll review your project details and confirm availability in your area. We typically follow up within <strong style="color:#102a43">1 business day</strong>.</p></td></tr><tr><td style="padding:18px 34px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dce5ec;border-radius:12px;background:#f8fafc"><tr><td style="padding:18px 19px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="width:37px;vertical-align:top"><div style="width:28px;height:28px;border-radius:50%;background:#fff0e4;color:#d96314;text-align:center;font-size:17px;line-height:28px;font-weight:700">1</div></td><td style="vertical-align:top"><div style="color:#102a43;font-size:14px;font-weight:700">What happens next</div><div style="margin-top:5px;color:#53677b;font-size:14px;line-height:1.55">We review the project details and confirm availability in your area, then follow up using the information you provided.</div></td></tr></table></td></tr></table></td></tr><tr><td style="padding:13px 34px 30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-left:3px solid #e88332;padding:4px 0 4px 15px;color:#53677b;font-size:14px;line-height:1.58"><strong style="color:#102a43">Help us review it faster:</strong> Reply to this email with product links, photos, measurements, or assembly instructions. ${projectHint}</td></tr></table><p style="margin:22px 0 0;color:#6c7e90;font-size:12px;line-height:1.55">We appreciate the opportunity to help with your project.</p><p style="margin:12px 0 0;color:#6c7e90;font-size:12px;line-height:1.55">Nothing is scheduled or priced yet. Final scope, pricing, and availability will be confirmed with you before any appointment is booked.</p></td></tr><tr><td style="padding:22px 34px;background:#f4f7f9;border-top:1px solid #dce5ec;color:#718294;font-size:11px;line-height:1.6">California Handymen · Santa Clarita Valley<br>This message concerns a request you submitted. <a href="https://california-handymen.com/privacy.html" style="color:#476178;text-decoration:underline">Privacy</a> · <a href="https://california-handymen.com/terms.html" style="color:#476178;text-decoration:underline">Terms</a></td></tr></table></td></tr><tr><td align="center" style="padding:18px 10px 0;color:#8795a4;font-size:11px;line-height:1.45">Thoughtful local help for the projects waiting at home.</td></tr></table></td></tr></table></body></html>`;
}

async function sendRequestReceivedEmail({ fetchImpl, resendApiKey, resendFromEmail, lead }) {
  if (!resendApiKey || !resendFromEmail || !lead.email) return { attempted: false };
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [lead.email],
      subject: 'We received your California Handymen request',
      html: renderRequestReceivedEmail(lead),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const receipt = await readJsonResponseLimited(response, 16 * 1024).catch(() => ({}));
  if (!response.ok || !clean(receipt?.id, 200)) throw new Error('Resend request-received email failed');
  return { attempted: true, id: clean(receipt.id, 200) };
}

function saveLeadRecord(leadStorePath, record) {
  if (!leadStorePath) return false;
  fs.mkdirSync(path.dirname(leadStorePath), { recursive: true });
  fs.appendFileSync(leadStorePath, `${JSON.stringify(record)}\n`, 'utf8');
  return true;
}

async function sendOwnerAlertEmail({ fetchImpl, resendApiKey, resendFromEmail, ownerAlertEmail, lead, channel }) {
  if (!resendApiKey || !resendFromEmail || !ownerAlertEmail) return { attempted: false };
  const text = formatLead(lead).replaceAll('<b>', '').replaceAll('</b>', '');
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [ownerAlertEmail],
      subject: `New California Handymen lead via fallback (${channel}) — ${clean(lead.zip, 10)}`,
      text: `Lead delivery fallback channel: ${channel}\n\n${text}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const receipt = await readJsonResponseLimited(response, 16 * 1024).catch(() => ({}));
  if (!response.ok || !clean(receipt?.id, 200)) throw new Error('Resend owner alert email failed');
  return { attempted: true, id: clean(receipt.id, 200) };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readJson(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      req.resume();
      reject(Object.assign(new Error('Payload too large'), { status: 413 }));
      return;
    }

    let body = '';
    let bytes = 0;
    let settled = false;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBytes) {
        settled = true;
        body = '';
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function voiceToolArgs(input, expectedName) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(input, 'args')) return input;
  if (input.name !== expectedName || !input.args || typeof input.args !== 'object' || Array.isArray(input.args)) {
    throw Object.assign(new Error('Invalid Retell voice tool envelope'), { status: 400 });
  }
  const envelopeCallId = input.call?.call_id;
  const argsCallId = input.args.call_id;
  if (envelopeCallId != null && argsCallId != null && envelopeCallId !== argsCallId) {
    throw Object.assign(new Error('Retell call_id does not match voice lead call_id'), { status: 400 });
  }
  if (expectedName === 'submit_voice_lead' && envelopeCallId != null) {
    return { ...input.args, call_id: envelopeCallId };
  }
  return input.args;
}

function isPrivateAddress(value) {
  const address = String(value || '').replace(/^::ffff:/, '');
  return address === '::1' || address === '127.0.0.1'
    || /^10\./.test(address) || /^192\.168\./.test(address)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(address)
    || /^(?:fc|fd)[0-9a-f]{2}:/i.test(address) || /^fe[89ab][0-9a-f]:/i.test(address);
}

function clientKey(req, trustedProxyHops = 0) {
  const remote = String(req.socket.remoteAddress || 'unknown');
  const chain = String(req.headers['x-forwarded-for'] || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const validChain = chain.length && chain.every(value => net.isIP(value) !== 0);
  const canTrustForwarding = Number.isSafeInteger(trustedProxyHops) && trustedProxyHops > 0
    && isPrivateAddress(remote) && validChain;
  const forwardedIndex = Math.max(0, chain.length - trustedProxyHops);
  const trustedForwarded = canTrustForwarding ? chain[forwardedIndex] : remote;
  return trustedForwarded.slice(0, 80) || 'unknown';
}

function createRateLimiter({ limit, windowMs, maxKeys = 1000, now = Date.now, trustedProxyHops = 0 }) {
  const entries = new Map();
  return req => {
    const key = clientKey(req, trustedProxyHops);
    const currentTime = now();
    const existing = entries.get(key);
    if (existing && currentTime - existing.startedAt < windowMs) {
      if (existing.count >= limit) return false;
      existing.count += 1;
      return true;
    }
    if (existing) entries.delete(key);
    if (entries.size >= maxKeys) {
      for (const [entryKey, entry] of entries) {
        if (currentTime - entry.startedAt >= windowMs) entries.delete(entryKey);
      }
    }
    if (entries.size >= maxKeys) entries.delete(entries.keys().next().value);
    entries.set(key, { startedAt: currentTime, count: 1 });
    return true;
  };
}

function createTenantRateLimiter({ limit, windowMs, now = Date.now }) {
  // Voice routes authenticate one provider/tenant. Their shared source IP is not a caller identity.
  const allow = createRateLimiter({ limit, windowMs, maxKeys: 1, now });
  const tenantRequest = { socket: { remoteAddress: 'authenticated-voice-tenant' }, headers: {} };
  return () => allow(tenantRequest);
}

function createDailyBudget(limit) {
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 && limit <= 10_000 ? limit : 0;
  let state = { day: '', used: 0 };
  return {
    take() {
      const day = new Date().toISOString().slice(0, 10);
      if (state.day !== day) state = { day, used: 0 };
      if (state.used >= safeLimit) return false;
      state.used += 1;
      return true;
    },
  };
}

async function readJsonResponseLimited(response, maxBytes) {
  const announced = Number(response?.headers?.get?.('content-length'));
  if (Number.isFinite(announced) && announced > maxBytes) {
    await response.body?.cancel?.().catch(() => {});
    throw new Error('Upstream response too large');
  }
  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.length;
        if (total > maxBytes) {
          await reader.cancel('response limit exceeded').catch(() => {});
          throw new Error('Upstream response too large');
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }
    try { return JSON.parse(Buffer.concat(chunks, total).toString('utf8')); }
    catch { return {}; }
  }
  // Test-adapter compatibility. Native Node fetch always uses the bounded stream path above.
  const payload = await response.json().catch(() => ({}));
  if (Buffer.byteLength(JSON.stringify(payload)) > maxBytes) throw new Error('Upstream response too large');
  return payload;
}

async function handleChat(req, res, fetchImpl, rateAllowed, concurrency, apiKey, dailyBudget) {
  if (!apiKey) {
    sendJson(res, 503, { success: false, message: 'Chat is temporarily unavailable. Please use the estimate form.' });
    return;
  }
  const input = await readJson(req);
  const safeMessages = normalizeConversation(input?.messages);
  if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
    sendJson(res, 400, { success: false, message: 'Please enter a message.' });
    return;
  }
  if (!rateAllowed(req)) {
    sendJson(res, 429, { success: false, message: 'Please wait a moment before sending another message.' });
    return;
  }
  if (concurrency.active >= concurrency.max) {
    sendJson(res, 429, { success: false, message: 'Chat is busy. Please wait a moment and try again.' });
    return;
  }
  if (!dailyBudget.take()) {
    sendJson(res, 503, { success: false, message: 'Chat has reached today’s capacity. Please use the estimate form.' });
    return;
  }
  concurrency.active += 1;
  let response;
  let payload;
  try {
    response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'http-referer': 'https://california-handymen.com',
        'x-title': 'California Handymen website chat',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...safeMessages],
        max_tokens: 80,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    payload = await readJsonResponseLimited(response, 32 * 1024);
  } finally {
    concurrency.active -= 1;
  }
  const providerReply = clean(payload?.choices?.[0]?.message?.content, 1600);
  if (!response.ok || !providerReply) throw new Error(`Chat provider failed (${response.status})`);
  sendJson(res, 200, { success: true, reply: enforceReplyPolicy(providerReply) });
}

function staticPath(urlPath) {
  if (STATIC_FILES.has(urlPath)) return STATIC_FILES.get(urlPath);
  if (!urlPath.startsWith('/images/')) return null;
  const segments = urlPath.slice(1).split('/');
  const safe = segments.every(segment => (
    segment && segment !== '.' && segment !== '..' && /^[a-zA-Z0-9._-]+$/.test(segment)
  ));
  return safe ? segments.join('/') : null;
}

function serveStatic(req, res, urlPath) {
  const relative = staticPath(urlPath);
  if (!relative) return false;
  const filePath = path.join(ROOT, relative);
  const extension = path.extname(filePath).toLowerCase();
  if (relative.startsWith('images/') && !IMAGE_TYPES.has(extension)) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const contentType = CONTENT_TYPES[extension] || IMAGE_TYPES.get(extension) || 'application/octet-stream';
  const cache = ['.html', '.js', '.css'].includes(extension) ? 'no-cache' : 'public, max-age=86400';
  res.writeHead(200, { 'content-type': contentType, 'cache-control': cache });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function createApp(options = {}) {
  const telegramToken = options.telegramToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId ?? process.env.TELEGRAM_CHAT_ID;
  const openRouterKey = options.openRouterKey ?? process.env.OPENROUTER_API_KEY;
  const resendApiKey = options.resendApiKey ?? process.env.RESEND_API_KEY;
  const resendFromEmail = clean(options.resendFromEmail ?? process.env.RESEND_FROM_EMAIL, 320);
  const ownerAlertEmail = clean(options.ownerAlertEmail ?? process.env.OWNER_ALERT_EMAIL, 320);
  const leadStorePath = options.leadStorePath !== undefined
    ? options.leadStorePath
    : (process.env.LEAD_STORE_PATH || path.join(ROOT, 'data', 'leads.jsonl'));
  const voiceToolSecret = options.voiceToolSecret ?? process.env.VOICE_TOOL_SECRET;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const configuredDailyLimit = Number(options.chatDailyLimit ?? process.env.CHAT_DAILY_LIMIT ?? 200);
  const trustedProxyHops = Number(options.trustedProxyHops ?? process.env.TRUST_PROXY_HOPS ?? 0);
  const limiterProxyHops = Number.isSafeInteger(trustedProxyHops) && trustedProxyHops >= 0 ? trustedProxyHops : 0;
  const chatRateAllowed = createRateLimiter({ limit: options.chatRateLimit ?? 12, windowMs: 60_000, trustedProxyHops: limiterProxyHops });
  const leadRateAllowed = createRateLimiter({ limit: options.leadRateLimit ?? 8, windowMs: 5 * 60_000, trustedProxyHops: limiterProxyHops });
  const voiceRequestRateAllowed = createTenantRateLimiter({
    limit: options.voiceRequestRateLimit ?? 1000, windowMs: 5 * 60_000, now: options.now ?? Date.now,
  });
  const voiceLeadRateAllowed = createTenantRateLimiter({
    limit: options.voiceRateLimit ?? 100, windowMs: 5 * 60_000, now: options.now ?? Date.now,
  });
  const voiceAreaRateAllowed = createTenantRateLimiter({
    limit: options.voiceServiceAreaRateLimit ?? 300, windowMs: 60_000, now: options.now ?? Date.now,
  });
  const voiceIdempotency = createIdempotencyStore({
    ttlMs: options.voiceIdempotencyTtlMs ?? 24 * 60 * 60 * 1000,
    maxEntries: options.voiceIdempotencyMaxEntries ?? 1000,
    now: options.now ?? Date.now,
  });
  const chatDailyBudget = options.chatDailyBudget ?? createDailyBudget(configuredDailyLimit);
  const chatConcurrency = { active: 0, max: 4 };

  const server = http.createServer({ connectionsCheckingInterval: 1_000 }, async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'SAMEORIGIN');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; script-src 'self' https://www.googletagmanager.com https://connect.facebook.net; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://region1.google-analytics.com https://region1.analytics.google.com; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");

    const url = new URL(req.url, 'http://localhost');
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/ready') {
      const ready = Boolean(telegramToken && chatId);
      sendJson(res, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/ready/chat') {
      const ready = Boolean(openRouterKey && Number.isSafeInteger(configuredDailyLimit) && configuredDailyLimit > 0 && configuredDailyLimit <= 10_000);
      sendJson(res, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/ready/voice') {
      const validVoiceSecret = authenticateBearer('', voiceToolSecret) !== 'unconfigured';
      const ready = Boolean(telegramToken && chatId && validVoiceSecret);
      sendJson(res, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/ready/leads') {
      // Lead intake is ready when at least one owner delivery channel is
      // configured: Telegram or the owner alert email.
      const ready = Boolean((telegramToken && chatId) || ownerAlertEmail);
      sendJson(res, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (serveStatic(req, res, url.pathname)) return;
      sendJson(res, 404, { success: false, message: 'Not found.' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const mediaType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        sendJson(res, 415, { success: false, message: 'Please submit the chat message as JSON.' });
        return;
      }
      try {
        await handleChat(req, res, fetchImpl, chatRateAllowed, chatConcurrency, openRouterKey, chatDailyBudget);
      } catch (error) {
        console.error('Chat request failed:', error.message);
        sendJson(res, error.status || 502, { success: false, message: 'Chat is temporarily unavailable. Please use the estimate form.' });
      }
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/api/voice/service-area' || url.pathname === '/api/voice/lead')) {
      const authentication = authenticateBearer(req.headers.authorization, voiceToolSecret);
      if (authentication === 'unconfigured') {
        sendJson(res, 503, { success: false, message: 'Voice intake is not configured.' });
        return;
      }
      if (authentication !== 'authenticated') {
        sendJson(res, 401, { success: false, message: 'Unauthorized.' });
        return;
      }
      if (!voiceRequestRateAllowed()) {
        sendJson(res, 429, { success: false, delivered: false, message: 'Too many authenticated voice requests.' });
        return;
      }
      const mediaType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        sendJson(res, 415, { success: false, message: 'Voice tool requests must use application/json.' });
        return;
      }
      try {
        const rawInput = await readJson(req, MAX_VOICE_BODY_BYTES);
        const input = voiceToolArgs(rawInput,
          url.pathname === '/api/voice/service-area' ? 'check_service_area' : 'submit_voice_lead');
        if (url.pathname === '/api/voice/service-area') {
          const result = validateServiceArea(input);
          if (!result.valid) {
            sendJson(res, 400, { success: false, message: result.error });
            return;
          }
          if (!voiceAreaRateAllowed()) {
            sendJson(res, 429, { success: false, message: 'Too many voice tool requests.' });
            return;
          }
          sendJson(res, 200, { eligible: result.eligible, zip: result.zip });
          return;
        }

        const result = validateVoiceLead(input);
        if (!result.valid) {
          sendJson(res, 400, { success: false, delivered: false, message: result.errors[0] });
          return;
        }
        const fingerprint = fingerprintVoiceLead(result.lead);
        const receipt = await voiceIdempotency.run(result.lead.call_id, fingerprint, async () => {
          if (!voiceLeadRateAllowed()) throw Object.assign(new Error('Too many voice tool requests.'), { status: 429 });
          if (!telegramToken || !chatId) throw Object.assign(new Error('Voice lead delivery is not configured.'), { status: 503 });
          let response;
          try {
            response = await fetchImpl(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: formatVoiceLead(result.lead), parse_mode: 'HTML' }),
              signal: AbortSignal.timeout(10_000),
            });
          } catch (cause) {
            throw Object.assign(new Error('Voice lead delivery is indeterminate after a network failure.', { cause }), {
              status: 503, code: 'DELIVERY_INDETERMINATE', cacheIdempotency: true,
            });
          }
          if (!response.ok) {
            await readJsonResponseLimited(response, 16 * 1024).catch(() => ({}));
            throw Object.assign(new Error('Telegram rejected voice lead delivery.'), { status: 502 });
          }
          let delivery;
          try {
            delivery = await readJsonResponseLimited(response, 16 * 1024);
          } catch (cause) {
            throw Object.assign(new Error('Voice lead delivery receipt is indeterminate.', { cause }), {
              status: 502, code: 'DELIVERY_INDETERMINATE', cacheIdempotency: true,
            });
          }
          if (delivery.ok === false) {
            throw Object.assign(new Error('Telegram rejected voice lead delivery.'), { status: 502 });
          }
          if (delivery.ok !== true || !Number.isSafeInteger(delivery?.result?.message_id)) {
            throw Object.assign(new Error('Voice lead delivery receipt is indeterminate.'), {
              status: 502, code: 'DELIVERY_INDETERMINATE', cacheIdempotency: true,
            });
          }
          return { success: true, delivered: true, call_id: result.lead.call_id };
        });
        sendJson(res, 200, receipt);
      } catch (error) {
        console.error('Voice intake request failed:', error.message);
        const status = error.status || 502;
        const messages = {
          400: 'Voice tool request was not valid JSON.',
          409: 'This call_id was already used with different lead details.',
          413: 'Voice tool request is too large.',
          429: 'Too many voice tool requests.',
          503: 'Voice lead delivery is not configured.',
        };
        const message = error.code === 'DELIVERY_INDETERMINATE'
          ? 'Delivery was not confirmed; this exact request was not resent to avoid a duplicate.'
          : error.code === 'IDEMPOTENCY_CAPACITY'
            ? 'Voice intake is busy with in-flight requests; retry later.'
            : messages[status] || 'Voice lead delivery failed.';
        sendJson(res, status, {
          success: false, delivered: false,
          message,
          ...(error.code ? { code: error.code } : {}),
        });
      }
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/api/submit-quote') {
      sendJson(res, 405, { success: false, message: 'Method not allowed.' });
      return;
    }

    const mediaType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'application/json') {
      sendJson(res, 415, { success: false, message: 'Please submit the form as JSON.' });
      return;
    }

    try {
      const input = await readJson(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        sendJson(res, 400, { success: false, message: 'Invalid request data.' });
        return;
      }
      if ((input.fax_number != null && clean(input.fax_number, 200))
          || (input.website != null && clean(input.website, 200))) {
        sendJson(res, 200, { success: false, delivered: false, message: 'The request could not be confirmed.' });
        return;
      }
      if (!hasValidLeadFieldTypes(input)) {
        sendJson(res, 400, { success: false, message: 'Invalid request data.' });
        return;
      }
      const spamAssessment = assessSpam(input);
      const result = validateLead(input);
      if (!result.valid) {
        sendJson(res, 400, { success: false, message: result.errors[0], errors: result.errors });
        return;
      }

      if (!leadRateAllowed(req)) {
        sendJson(res, 429, { success: false, message: 'Too many requests. Please wait a few minutes and try again.' });
        return;
      }

      if (!(telegramToken && chatId) && !ownerAlertEmail) {
        sendJson(res, 503, { success: false, message: 'Online requests are temporarily unavailable. Please try again later.' });
        return;
      }

      result.lead.received_at = new Date().toISOString();
      result.lead.review_flags = [
        ...(spamAssessment.blocked ? spamAssessment.reasons : []),
        ...(result.lead.service_area_eligible === false ? ['out-of-area'] : []),
      ];

      // Primary channel: Telegram (one retry on a thrown network error only;
      // an explicit Telegram rejection is not retried, to avoid duplicates).
      let telegramDelivered = false;
      if (telegramToken && chatId) {
        for (let attempt = 0; attempt < 2 && !telegramDelivered; attempt += 1) {
          let response;
          try {
            response = await fetchImpl(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: formatLead(result.lead), parse_mode: 'HTML' }),
              signal: AbortSignal.timeout(10000),
            });
          } catch (networkError) {
            if (attempt === 1) console.error('Telegram lead delivery failed after retry:', networkError.message);
            continue;
          }
          const delivery = await readJsonResponseLimited(response, 16 * 1024).catch(() => ({}));
          telegramDelivered = Boolean(response.ok && delivery.ok === true && Number.isSafeInteger(delivery?.result?.message_id));
          break;
        }
      }

      // Fallback 1: durable on-disk lead store, so a Telegram outage can
      // never silently discard a valid lead.
      let stored = false;
      try {
        stored = saveLeadRecord(leadStorePath, {
          received_at: result.lead.received_at,
          channel: telegramDelivered ? 'telegram' : 'fallback-pending',
          lead: result.lead,
        });
      } catch (storeError) {
        console.error('Lead store write failed:', storeError.message);
      }

      // Fallback 2: owner alert email when Telegram did not confirm.
      let ownerEmailed = false;
      if (!telegramDelivered) {
        try {
          const alert = await sendOwnerAlertEmail({
            fetchImpl, resendApiKey, resendFromEmail, ownerAlertEmail,
            lead: result.lead, channel: stored ? 'store' : 'email',
          });
          ownerEmailed = Boolean(alert.attempted);
        } catch (emailError) {
          console.error('Owner alert email failed:', emailError.message);
        }
      }

      if (!telegramDelivered && !ownerEmailed && !stored) {
        throw new Error('Lead delivery failed on every configured channel');
      }
      const channel = telegramDelivered ? 'telegram' : ownerEmailed ? 'email' : 'store';
      if (!telegramDelivered) {
        console.error(`Lead accepted via fallback channel (${channel}) for ZIP ${result.lead.zip}`);
      }
      // The client confirmation email stays optional and non-blocking; it is
      // only sent after an owner channel has accepted the lead.
      if (telegramDelivered) {
        try {
          await sendRequestReceivedEmail({ fetchImpl, resendApiKey, resendFromEmail, lead: result.lead });
        } catch (emailError) {
          console.error('Request-received email failed after Telegram receipt:', emailError.message);
        }
      }
      sendJson(res, 200, { success: true, delivered: true, channel, message: 'Your request was sent successfully.' });
    } catch (error) {
      console.error('Lead request failed:', error.message);
      const status = error.status || 502;
      const messages = {
        400: 'The request data was not valid JSON.',
        413: 'The request is too large. Please shorten the project details.',
      };
      sendJson(res, status, { success: false, message: messages[status] || 'We could not send your request. Please try again in a few minutes.' });
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '0.0.0.0', () => console.log(`Handyman site listening on port ${port}`));
}

module.exports = { createApp, validateLead, formatLead, assessSpam, createRateLimiter, createDailyBudget, renderRequestReceivedEmail, sendRequestReceivedEmail };
