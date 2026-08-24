'use strict';

const crypto = require('node:crypto');
const { BUSINESS_PROFILE } = require('./agent-core');

const SERVICE_AREA_ZIPS = new Set(BUSINESS_PROFILE.serviceAreaZips);
const CATEGORIES = new Set([
  'general-repairs', 'fixtures-installations', 'painting-drywall',
  'furniture-assembly', 'tv-mounting', 'carpentry', 'plumbing-maintenance', 'other',
]);
const LANGUAGES = new Set(['en', 'es', 'ru']);
const CONTACT_METHODS = new Set(['phone', 'text', 'either']);
const RECORDING_CONSENTS = new Set(['accepted', 'declined', 'unknown']);
const SAFETY_FLAGS = new Set([
  'none', 'gas-odor', 'fire-or-smoke', 'sparks-or-hot-electrical',
  'active-flooding-near-electricity', 'sewage-exposure',
  'structural-instability', 'immediate-danger', 'other',
]);
const SCOPE_REVIEW_FLAGS = new Set([
  'electrical', 'gas', 'structural', 'hazardous', 'permit-required', 'other-licensed',
]);
// Authoritative derivation table. Multiple flags use logical OR across rows.
const SAFETY_FLAG_EFFECTS = Object.freeze({
  none: { immediate_danger: false, licensed_trade_review: false },
  'gas-odor': { immediate_danger: true, licensed_trade_review: true },
  'fire-or-smoke': { immediate_danger: true, licensed_trade_review: true },
  'sparks-or-hot-electrical': { immediate_danger: true, licensed_trade_review: true },
  'active-flooding-near-electricity': { immediate_danger: true, licensed_trade_review: true },
  'sewage-exposure': { immediate_danger: true, licensed_trade_review: true },
  'structural-instability': { immediate_danger: true, licensed_trade_review: true },
  'immediate-danger': { immediate_danger: true, licensed_trade_review: false },
  other: { immediate_danger: false, licensed_trade_review: false },
});
const PROJECT_OPTIONAL_STRINGS = new Map([
  ['location_on_property', 300], ['trigger', 500], ['severity', 100], ['onset', 200],
  ['damage', 500], ['previous_attempts', 500], ['materials', 500], ['dimensions', 300],
  ['access_notes', 500], ['model_brand', 300],
]);
const PROJECT_OPTIONAL_BOOLEANS = new Set(['photos_available', 'materials_available']);

function plainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, required, optional = []) {
  if (!plainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) && keys.every(key => allowed.has(key));
}

function boundedString(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    && value.trim().length >= min;
}

function validPhone(phone) {
  if (!boundedString(phone, 7, 30) || !/^[+\d().\s-]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national)
    && !/^(\d)\1{9}$/.test(national) && !/0000$/.test(national);
}

function normalizeZip(zip) {
  return typeof zip === 'string' && /^\d{5}(?:-\d{4})?$/.test(zip) ? zip.slice(0, 5) : null;
}

function validateServiceArea(input) {
  if (!exactKeys(input, ['zip']) || typeof input.zip !== 'string') {
    return { valid: false, error: 'Request must contain exactly one ZIP field.' };
  }
  const zip = normalizeZip(input.zip);
  if (!zip) return { valid: false, error: 'ZIP must be five digits or ZIP+4.' };
  return { valid: true, zip, eligible: SERVICE_AREA_ZIPS.has(zip) };
}

function validStringArray(value) {
  return Array.isArray(value) && value.length <= 10
    && value.every(item => boundedString(item, 1, 200));
}

const ADDRESS_SUFFIX_WORDS = new Set([
  'street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'lane', 'ln',
  'drive', 'dr', 'court', 'ct', 'way', 'place', 'pl', 'highway', 'hwy', 'parkway',
  'pkwy', 'terrace', 'ter', 'circle', 'cir', 'calle', 'avenida', 'carretera', 'camino',
  'paseo', 'trail', 'trl', 'square', 'sq', 'route', 'rte', 'row', 'crescent', 'grove',
  'plaza', 'plz', 'c', 'улица', 'ул', 'проспект', 'пр', 'переулок', 'пер', 'шоссе',
  'бульвар', 'набережная', 'дом', 'д', 'address', 'direccion', 'dirección', 'адрес',
]);
const ADDRESS_PREFIX_WORDS = new Set([
  'calle', 'avenida', 'carretera', 'camino', 'paseo', 'улица', 'ул', 'проспект', 'пр',
  'переулок', 'пер', 'шоссе', 'бульвар', 'набережная', 'дом', 'д', 'plaza', 'plz', 'c',
  'address', 'direccion', 'dirección', 'адрес',
]);
const ADDRESS_NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety', 'hundred', 'thousand',
  'cero', 'uno', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'veinte', 'treinta',
  'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'mil',
  'ноль', 'один', 'одна', 'два', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь',
  'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать',
  'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать',
  'девятнадцать', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят',
  'семьдесят', 'восемьдесят', 'девяносто', 'сто', 'тысяча',
]);

function containsStreetAddress(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/\bc\s*\/(?=\s*[\p{L}\p{M}])/gu, ' calle ');
  const tokens = (normalized.match(/[\p{L}\p{M}]+|\p{N}+/gu) || []).map(token => {
    if (/^улиц/u.test(token)) return 'улица';
    if (/^проспект/u.test(token)) return 'проспект';
    if (/^переул/u.test(token)) return 'переулок';
    if (/^бульвар/u.test(token)) return 'бульвар';
    if (/^набережн/u.test(token)) return 'набережная';
    if (/^дом(?:а|е|ом|у)?$/u.test(token)) return 'дом';
    return token;
  });
  const numberIndexes = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (/^\p{N}+$/u.test(tokens[i]) || ADDRESS_NUMBER_WORDS.has(tokens[i])) numberIndexes.push(i);
  }
  for (let i = 0; i < tokens.length; i += 1) {
    if (!ADDRESS_SUFFIX_WORDS.has(tokens[i])) continue;
    if (numberIndexes.some(index => index < i && i - index <= 6)) return true;
    if (ADDRESS_PREFIX_WORDS.has(tokens[i])
        && numberIndexes.some(index => index > i && index - i <= 6)) return true;
  }
  return false;
}

function validateVoiceLead(input) {
  const fail = message => ({ valid: false, errors: [message], lead: null });
  const root = ['call_id', 'caller', 'location', 'project', 'safety', 'preferences', 'assessment',
    'detected_language', 'recording_consent', 'callback_consent', 'commitments'];
  if (!exactKeys(input, root)) return fail('Invalid or unknown voice lead field.');
  if (!boundedString(input.call_id, 1, 128) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(input.call_id)) {
    return fail('Invalid call_id.');
  }
  if (!exactKeys(input.caller, ['name', 'callback_phone', 'preferred_contact'])
      || !boundedString(input.caller.name, 2, 100) || !validPhone(input.caller.callback_phone)
      || !CONTACT_METHODS.has(input.caller.preferred_contact)) return fail('Invalid caller details.');
  if (!exactKeys(input.location, ['zip', 'service_area_eligible'])
      || typeof input.location.service_area_eligible !== 'boolean') return fail('Invalid location.');
  const zip = normalizeZip(input.location.zip);
  if (!zip) return fail('Invalid location ZIP.');
  const serviceAreaEligible = SERVICE_AREA_ZIPS.has(zip);
  if (input.location.service_area_eligible !== serviceAreaEligible) {
    return fail('service_area_eligible does not match the server service-area result.');
  }

  const projectRequired = ['category', 'reported_problem'];
  const projectOptional = [...PROJECT_OPTIONAL_STRINGS.keys(), ...PROJECT_OPTIONAL_BOOLEANS];
  if (!exactKeys(input.project, projectRequired, projectOptional)
      || !CATEGORIES.has(input.project.category)
      || !boundedString(input.project.reported_problem, 3, 2000)) return fail('Invalid project details.');
  for (const [field, max] of PROJECT_OPTIONAL_STRINGS) {
    if (Object.hasOwn(input.project, field) && !boundedString(input.project[field], 1, max)) return fail(`Invalid project ${field}.`);
  }
  for (const field of PROJECT_OPTIONAL_BOOLEANS) {
    if (Object.hasOwn(input.project, field) && typeof input.project[field] !== 'boolean') return fail(`Invalid project ${field}.`);
  }

  if (!exactKeys(input.safety, ['flags', 'scope_review_flags', 'immediate_danger', 'licensed_trade_review'])
      || !Array.isArray(input.safety.flags) || input.safety.flags.length < 1 || input.safety.flags.length > 8
      || !input.safety.flags.every(flag => typeof flag === 'string' && SAFETY_FLAGS.has(flag))
      || new Set(input.safety.flags).size !== input.safety.flags.length
      || (input.safety.flags.includes('none') && input.safety.flags.length !== 1)
      || !Array.isArray(input.safety.scope_review_flags) || input.safety.scope_review_flags.length > 6
      || !input.safety.scope_review_flags.every(flag => typeof flag === 'string' && SCOPE_REVIEW_FLAGS.has(flag))
      || new Set(input.safety.scope_review_flags).size !== input.safety.scope_review_flags.length
      || typeof input.safety.immediate_danger !== 'boolean'
      || typeof input.safety.licensed_trade_review !== 'boolean') return fail('Invalid safety assessment.');
  if (!exactKeys(input.preferences, ['urgent', 'preferred_callback_window'])
      || typeof input.preferences.urgent !== 'boolean'
      || (input.preferences.preferred_callback_window !== null
        && !boundedString(input.preferences.preferred_callback_window, 1, 200))) return fail('Invalid preferences.');
  const expectedSafety = input.safety.flags.reduce((expected, flag) => ({
    immediate_danger: expected.immediate_danger || SAFETY_FLAG_EFFECTS[flag].immediate_danger,
    licensed_trade_review: expected.licensed_trade_review || SAFETY_FLAG_EFFECTS[flag].licensed_trade_review,
  }), { immediate_danger: false, licensed_trade_review: input.safety.scope_review_flags.length > 0 });
  if (input.safety.immediate_danger !== expectedSafety.immediate_danger
      || input.safety.licensed_trade_review !== expectedSafety.licensed_trade_review) {
    return fail('Safety fields are inconsistent with safety flags.');
  }
  if (!exactKeys(input.assessment, ['uncertainty', 'missing_info'])
      || !validStringArray(input.assessment.uncertainty)
      || !validStringArray(input.assessment.missing_info)) return fail('Invalid assessment.');
  if (!LANGUAGES.has(input.detected_language)) return fail('Invalid detected language.');
  if (!RECORDING_CONSENTS.has(input.recording_consent) || input.recording_consent !== 'accepted') {
    return fail('Full voice intake requires accepted recording and transcription consent.');
  }
  if (input.callback_consent !== true) return fail('Full voice intake requires callback or text consent.');
  if (!exactKeys(input.commitments, ['price_promised', 'appointment_confirmed', 'job_accepted'])
      || Object.values(input.commitments).some(value => value !== false)) return fail('Commitments must remain unconfirmed.');

  const lead = { ...input, location: { zip, service_area_eligible: serviceAreaEligible } };
  const textValues = [
    lead.call_id, lead.caller.name, lead.caller.callback_phone, lead.preferences.preferred_callback_window,
    ...Object.values(lead.project).filter(value => typeof value === 'string'),
    ...lead.assessment.uncertainty, ...lead.assessment.missing_info,
  ];
  if (textValues.some(containsStreetAddress)) {
    return fail('Street addresses are not accepted; provide only ZIP and location on the property.');
  }
  if (textValues.reduce((total, value) => total + String(value ?? '').length, 0) > 2800) {
    return fail('Voice lead details are too long.');
  }
  return { valid: true, errors: [], lead };
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function yesNo(value) { return value ? 'Yes' : 'No'; }
function valueOrUnknown(value) { return value == null || value === '' ? 'Unknown' : escapeHtml(value); }
function listOrNone(value) { return value.length ? value.map(escapeHtml).join('; ') : 'None reported'; }

function formatVoiceLead(lead, receivedAt = new Date().toISOString()) {
  const p = lead.project;
  const rows = [
    '<b>New Voice service request</b>',
    ...(lead.location.service_area_eligible ? [] : [
      '<b>⚠ OUT OF AREA — HUMAN REVIEW REQUIRED; DO NOT PROMISE SERVICE</b>',
    ]),
    `<b>Call ID:</b> ${escapeHtml(lead.call_id)}`,
    `<b>Caller:</b> ${escapeHtml(lead.caller.name)}`,
    `<b>Callback:</b> ${escapeHtml(lead.caller.callback_phone)} (${escapeHtml(lead.caller.preferred_contact)})`,
    `<b>ZIP:</b> ${escapeHtml(lead.location.zip)}`,
    `<b>Service-area eligible:</b> ${yesNo(lead.location.service_area_eligible)}`,
    `<b>Language:</b> ${escapeHtml(lead.detected_language)}`,
    `<b>Category:</b> ${escapeHtml(p.category)}`,
    `<b>Reported problem:</b> ${escapeHtml(p.reported_problem)}`,
    `<b>Property location:</b> ${valueOrUnknown(p.location_on_property)}`,
    `<b>Trigger:</b> ${valueOrUnknown(p.trigger)}`,
    `<b>Severity / onset:</b> ${valueOrUnknown(p.severity)} / ${valueOrUnknown(p.onset)}`,
    `<b>Damage:</b> ${valueOrUnknown(p.damage)}`,
    `<b>Previous attempts:</b> ${valueOrUnknown(p.previous_attempts)}`,
    `<b>Materials / dimensions:</b> ${valueOrUnknown(p.materials)} / ${valueOrUnknown(p.dimensions)}`,
    `<b>Access:</b> ${valueOrUnknown(p.access_notes)}`,
    `<b>Model / brand:</b> ${valueOrUnknown(p.model_brand)}`,
    `<b>Photos available:</b> ${p.photos_available == null ? 'Unknown' : yesNo(p.photos_available)}`,
    `<b>Materials available:</b> ${p.materials_available == null ? 'Unknown' : yesNo(p.materials_available)}`,
    `<b>Safety flags:</b> ${listOrNone(lead.safety.flags)}`,
    `<b>Scope-review flags:</b> ${listOrNone(lead.safety.scope_review_flags)}`,
    `<b>Immediate danger:</b> ${yesNo(lead.safety.immediate_danger)}`,
    `<b>Licensed-trade review:</b> ${yesNo(lead.safety.licensed_trade_review)}`,
    `<b>Urgent:</b> ${yesNo(lead.preferences.urgent)}`,
    `<b>Callback window:</b> ${valueOrUnknown(lead.preferences.preferred_callback_window)}`,
    `<b>Uncertainty:</b> ${listOrNone(lead.assessment.uncertainty)}`,
    `<b>Missing information:</b> ${listOrNone(lead.assessment.missing_info)}`,
    `<b>Recording consent:</b> ${escapeHtml(lead.recording_consent)}`,
    '<b>Callback consent:</b> Yes',
    '<b>Commitments:</b> No price promised; no appointment confirmed; no job accepted',
    '<b>Status:</b> Human confirmation required',
    `<b>Received:</b> ${escapeHtml(receivedAt)}`,
  ];
  return rows.join('\n');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (plainObject(value)) {
    const fields = Object.keys(value).sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprintVoiceLead(lead) {
  return crypto.createHash('sha256').update(canonicalJson(lead), 'utf8').digest('hex');
}

function authenticateBearer(header, configuredSecret) {
  if (typeof configuredSecret !== 'string' || configuredSecret.length < 32
      || configuredSecret.length > 4096 || /\s/.test(configuredSecret)) return 'unconfigured';
  const match = /^Bearer ([^\s]+)$/.exec(typeof header === 'string' ? header : '');
  const presented = match ? match[1] : '';
  const expectedDigest = crypto.createHash('sha256').update(configuredSecret, 'utf8').digest();
  const presentedDigest = crypto.createHash('sha256').update(presented, 'utf8').digest();
  return match && crypto.timingSafeEqual(presentedDigest, expectedDigest) ? 'authenticated' : 'unauthorized';
}

function createIdempotencyStore({ ttlMs = 24 * 60 * 60 * 1000, maxEntries = 1000, now = Date.now } = {}) {
  const safeTtlMs = Number.isSafeInteger(ttlMs) && ttlMs > 0 && ttlMs <= 7 * 24 * 60 * 60 * 1000
    ? ttlMs : 24 * 60 * 60 * 1000;
  const safeMaxEntries = Number.isSafeInteger(maxEntries) && maxEntries > 0 && maxEntries <= 10_000
    ? maxEntries : 1000;
  const clock = typeof now === 'function' ? now : Date.now;
  const entries = new Map();
  function prune(time) {
    for (const [key, entry] of entries) {
      if (!entry.inFlight && entry.expiresAt <= time) entries.delete(key);
    }
  }
  return {
    async run(key, fingerprint, operation) {
      if (!boundedString(key, 1, 128) || !/^[a-f0-9]{64}$/.test(fingerprint)
          || typeof operation !== 'function') throw new TypeError('Invalid idempotency operation.');
      const time = clock();
      const existing = entries.get(key);
      if (existing && (existing.inFlight || existing.expiresAt > time)) {
        if (existing.fingerprint !== fingerprint) {
          throw Object.assign(new Error('call_id was already used with a different lead payload.'), {
            status: 409, code: 'IDEMPOTENCY_CONFLICT',
          });
        }
        return existing.promise;
      }
      if (existing) entries.delete(key);
      prune(time);
      if (entries.size >= safeMaxEntries) {
        throw Object.assign(new Error('Idempotency capacity is occupied by in-flight requests.'), {
          status: 503, code: 'IDEMPOTENCY_CAPACITY',
        });
      }
      const entry = { expiresAt: time + safeTtlMs, fingerprint, inFlight: true };
      entry.promise = Promise.resolve().then(operation).then(value => {
        entry.inFlight = false;
        return value;
      }, error => {
        entry.inFlight = false;
        if (!error?.cacheIdempotency && entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.set(key, entry);
      return entry.promise;
    },
  };
}

module.exports = {
  SAFETY_FLAG_EFFECTS, authenticateBearer, createIdempotencyStore, fingerprintVoiceLead,
  formatVoiceLead, normalizeZip, validateServiceArea, validateVoiceLead,
};
