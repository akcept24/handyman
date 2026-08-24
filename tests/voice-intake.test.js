'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../server');
const {
  SAFETY_FLAG_EFFECTS, createIdempotencyStore, fingerprintVoiceLead,
  formatVoiceLead, validateVoiceLead,
} = require('../voice-intake');

const SECRET = 'voice-test-secret-32-chars-minimum!!';

async function start(options = {}) {
  const server = createApp(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function validVoiceLead(overrides = {}) {
  return {
    call_id: 'call_01J5YQ9R3VCZ2',
    caller: { name: 'Alex <Smith>', callback_phone: '(661) 259-0199', preferred_contact: 'phone' },
    location: { zip: '91355-1234', service_area_eligible: true },
    project: {
      category: 'general-repairs', reported_problem: 'Interior <door> sticks & will not latch.',
      location_on_property: 'Hallway', severity: 'moderate', photos_available: true,
    },
    safety: { flags: ['none'], scope_review_flags: [], immediate_danger: false, licensed_trade_review: false },
    preferences: { urgent: false, preferred_callback_window: 'Weekday afternoon' },
    assessment: { uncertainty: ['Exact hinge condition'], missing_info: ['Door material'] },
    detected_language: 'en', recording_consent: 'accepted', callback_consent: true,
    commitments: { price_promised: false, appointment_confirmed: false, job_accepted: false },
    ...overrides,
  };
}

function voicePost(base, route, body, token = SECRET, headers = {}) {
  return fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  });
}

function telegramSuccess(messageId = 41) {
  return { ok: true, json: async () => ({ ok: true, result: { message_id: messageId } }) };
}

test('full voice lead is strict and requires recording plus callback/text consent', () => {
  assert.equal(validateVoiceLead(validVoiceLead()).valid, true);
  for (const recording_consent of ['declined', 'unknown']) {
    const result = validateVoiceLead(validVoiceLead({ recording_consent }));
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /accepted recording/i);
  }
  assert.match(validateVoiceLead(validVoiceLead({ callback_consent: false })).errors[0], /callback or text consent/i);
  for (const changed of [
    { unknown: true }, { detected_language: 'fr' },
    { caller: { name: 'Alex', callback_phone: '555', preferred_contact: 'phone' } },
    { commitments: { price_promised: true, appointment_confirmed: false, job_accepted: false } },
    { assessment: { uncertainty: Array(11).fill('x'), missing_info: [] } },
    { project: { category: 'general-repairs', reported_problem: 'x'.repeat(2001) } },
  ]) assert.equal(validateVoiceLead(validVoiceLead(changed)).valid, false, JSON.stringify(changed).slice(0, 100));
});

test('location eligibility is server-verified while valid out-of-area leads are accepted and flagged', () => {
  const outside = validateVoiceLead(validVoiceLead({
    location: { zip: '90210', service_area_eligible: false },
  }));
  assert.equal(outside.valid, true);
  assert.deepEqual(outside.lead.location, { zip: '90210', service_area_eligible: false });
  const card = formatVoiceLead(outside.lead, '2026-08-24T12:00:00.000Z');
  assert.match(card, /OUT OF AREA — HUMAN REVIEW REQUIRED; DO NOT PROMISE SERVICE/);
  assert.match(card, /Service-area eligible:<\/b> No/);

  for (const location of [
    { zip: '91355', service_area_eligible: false },
    { zip: '90210', service_area_eligible: true },
    { zip: '91355' },
  ]) {
    const result = validateVoiceLead(validVoiceLead({ location }));
    assert.equal(result.valid, false, JSON.stringify(location));
  }
});

test('optional fields are presence-aware, urgency is caller-set, and TV mounting is explicit', () => {
  assert.equal(validateVoiceLead(validVoiceLead({
    project: { category: 'tv-mounting', reported_problem: 'Mount a television on the living-room wall.' },
    preferences: { urgent: true, preferred_callback_window: null },
  })).valid, true);
  for (const [field, value] of [['severity', null], ['photos_available', null], ['trigger', 42]]) {
    assert.equal(validateVoiceLead(validVoiceLead({
      project: { ...validVoiceLead().project, [field]: value },
    })).valid, false, `${field}=${value}`);
  }
});

test('street addresses are rejected across EN/ES/RU, Unicode digits, and every free-text container', () => {
  const addressSamples = [
    'Door sticks at 123 Main Street.',
    'Door sticks at one twenty-three Main Street.',
    'Door sticks at １２３ Main Street.',
    'Trabajo en Calle Principal 123.',
    'Работа по адресу улица Ленина 123.',
    'At 5 Oak Trail.',
    'At 7 Market Square.',
    'En C/ Mayor 123.',
    'En Plaza Mayor 5.',
    'На улице Ленина, 123.',
    'Ленина, дом 123.',
    'Repair at 8 Center Plz.',
    'Trabajo en C. Mayor 123.',
    'Работа: Ленина, д. 123.',
    'The door sticks. My street address is 123 Main.',
    'Mi dirección es Calle Mayor 123.',
    'Мой адрес: Ленина 123.',
  ];
  for (const reported_problem of addressSamples) {
    assert.match(validateVoiceLead(validVoiceLead({
      project: { category: 'general-repairs', reported_problem },
    })).errors[0], /street addresses/i, reported_problem);
  }

  const projectFields = [
    'location_on_property', 'trigger', 'severity', 'onset', 'damage', 'previous_attempts',
    'materials', 'dimensions', 'access_notes', 'model_brand',
  ];
  for (const field of projectFields) {
    assert.match(validateVoiceLead(validVoiceLead({
      project: { category: 'general-repairs', reported_problem: 'Door sticks.', [field]: '123 Main Street' },
    })).errors[0], /street addresses/i, field);
  }
  for (const override of [
    { caller: { name: 'Resident 123 Main Street', callback_phone: '(661) 259-0199', preferred_contact: 'phone' } },
    { preferences: { urgent: false, preferred_callback_window: '123 Main Street' } },
    { assessment: { uncertainty: ['123 Main Street'], missing_info: [] } },
    { assessment: { uncertainty: [], missing_info: ['123 Main Street'] } },
  ]) assert.match(validateVoiceLead(validVoiceLead(override)).errors[0], /street addresses/i);

  for (const project of [
    { category: 'tv-mounting', reported_problem: 'Mount a 65 inch TV in the living room.', dimensions: '65 x 40 inches' },
    { category: 'fixtures-installations', reported_problem: 'Install model 123 Mainline faucet.', model_brand: 'Delta 35770LF' },
    { category: 'general-repairs', reported_problem: 'Door sticks.', location_on_property: 'Upstairs hallway' },
    { category: 'general-repairs', reported_problem: 'Repair road-facing fence 5 feet wide.' },
  ]) assert.equal(validateVoiceLead(validVoiceLead({ project })).valid, true, JSON.stringify(project));
});

test('voice card escapes caller data and in-area cards do not show the out-of-area warning', () => {
  const result = validateVoiceLead(validVoiceLead());
  const card = formatVoiceLead(result.lead, '2026-08-24T12:00:00.000Z');
  assert.match(card, /Alex &lt;Smith&gt;/);
  assert.match(card, /Interior &lt;door&gt; sticks &amp; will not latch/);
  assert.doesNotMatch(card, /Alex <Smith>|Interior <door>|OUT OF AREA/);
  assert.match(card, /Human confirmation required/);
});

test('safety fields must exactly match the explicit per-flag derivation table', () => {
  for (const [flag, expected] of Object.entries(SAFETY_FLAG_EFFECTS)) {
    const lead = validVoiceLead({
      safety: {
        flags: [flag], immediate_danger: expected.immediate_danger,
        scope_review_flags: [], licensed_trade_review: expected.licensed_trade_review,
      },
      preferences: { urgent: false, preferred_callback_window: null },
    });
    assert.equal(validateVoiceLead(lead).valid, true, flag);
    for (const field of ['immediate_danger', 'licensed_trade_review']) {
      const contradictory = { ...lead, safety: { ...lead.safety, [field]: !lead.safety[field] } };
      assert.match(validateVoiceLead(contradictory).errors[0], /inconsistent/i, `${flag}/${field}`);
    }
    assert.equal(validateVoiceLead({
      ...lead, preferences: { ...lead.preferences, urgent: true },
    }).valid, true, `${flag}/caller urgency`);
  }
  const combined = validateVoiceLead(validVoiceLead({
    safety: { flags: ['other', 'gas-odor'], scope_review_flags: [], immediate_danger: true, licensed_trade_review: true },
    preferences: { urgent: true, preferred_callback_window: null },
  }));
  assert.equal(combined.valid, true);
  for (const scope of ['electrical', 'gas', 'structural', 'hazardous', 'permit-required', 'other-licensed']) {
    assert.equal(validateVoiceLead(validVoiceLead({
      safety: { flags: ['none'], scope_review_flags: [scope], immediate_danger: false, licensed_trade_review: true },
    })).valid, true, scope);
  }
  assert.match(validateVoiceLead(validVoiceLead({
    safety: { flags: ['none'], scope_review_flags: ['electrical'], immediate_danger: false, licensed_trade_review: false },
  })).errors[0], /inconsistent/i);
});

test('idempotency fingerprints canonical validated payloads and rejects sequential/concurrent conflicts', async () => {
  const firstLead = validateVoiceLead(validVoiceLead()).lead;
  const reordered = { ...firstLead, caller: {
    preferred_contact: firstLead.caller.preferred_contact,
    callback_phone: firstLead.caller.callback_phone,
    name: firstLead.caller.name,
  } };
  const fingerprint = fingerprintVoiceLead(firstLead);
  assert.equal(fingerprintVoiceLead(reordered), fingerprint);

  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const store = createIdempotencyStore();
  const first = store.run(firstLead.call_id, fingerprint, async () => {
    calls += 1; await gate; return { delivered: true };
  });
  const exact = store.run(firstLead.call_id, fingerprint, async () => { calls += 1; });
  const conflictFingerprint = fingerprintVoiceLead({ ...firstLead, project: { ...firstLead.project, severity: 'high' } });
  await assert.rejects(store.run(firstLead.call_id, conflictFingerprint, async () => {}), error => error.status === 409);
  release();
  assert.deepEqual(await Promise.all([first, exact]), [{ delivered: true }, { delivered: true }]);
  assert.equal(calls, 1);
  await assert.rejects(store.run(firstLead.call_id, conflictFingerprint, async () => {}), error => error.status === 409);
});

test('idempotency expires successes and never caches failed delivery', async () => {
  let clock = 1000;
  let calls = 0;
  const store = createIdempotencyStore({ ttlMs: 100, now: () => clock });
  const lead = validateVoiceLead(validVoiceLead()).lead;
  const fp = fingerprintVoiceLead(lead);
  await store.run(lead.call_id, fp, async () => { calls += 1; return true; });
  await store.run(lead.call_id, fp, async () => { calls += 1; return true; });
  assert.equal(calls, 1);
  clock += 101;
  await store.run(lead.call_id, fp, async () => { calls += 1; return true; });
  assert.equal(calls, 2);
  for (let i = 0; i < 2; i += 1) {
    await assert.rejects(store.run('failed-call', fp, async () => { throw new Error('failed'); }));
  }
});

test('idempotency capacity never evicts unexpired work and exact overlap still coalesces', async () => {
  const store = createIdempotencyStore({ maxEntries: 1 });
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = store.run('first', 'a'.repeat(64), async () => { calls += 1; await gate; return 'done'; });
  const exact = store.run('first', 'a'.repeat(64), async () => { calls += 1; return 'duplicate'; });
  await assert.rejects(store.run('second', 'b'.repeat(64), async () => 'unsafe'), error => (
    error.status === 503 && error.code === 'IDEMPOTENCY_CAPACITY'
  ));
  release();
  assert.deepEqual(await Promise.all([first, exact]), ['done', 'done']);
  assert.equal(calls, 1);
  await assert.rejects(store.run('second', 'b'.repeat(64), async () => 'unsafe'), error => (
    error.status === 503 && error.code === 'IDEMPOTENCY_CAPACITY'
  ));
  assert.equal(await store.run('first', 'a'.repeat(64), async () => 'duplicate'), 'done');
  assert.equal(calls, 1);
});

test('idempotency capacity churn cannot evict successful or indeterminate records', async () => {
  const store = createIdempotencyStore({ maxEntries: 2 });
  let firstCalls = 0;
  const first = async () => { firstCalls += 1; return 'delivered'; };
  await store.run('first', 'a'.repeat(64), first);
  await assert.rejects(store.run('uncertain', 'b'.repeat(64), async () => {
    throw Object.assign(new Error('indeterminate'), { cacheIdempotency: true });
  }));
  await assert.rejects(store.run('third', 'c'.repeat(64), async () => 'unsafe'), error => (
    error.status === 503 && error.code === 'IDEMPOTENCY_CAPACITY'
  ));
  assert.equal(await store.run('first', 'a'.repeat(64), first), 'delivered');
  assert.equal(firstCalls, 1);
  await assert.rejects(store.run('uncertain', 'b'.repeat(64), async () => 'unsafe'), /indeterminate/);
});

test('voice routes fail closed, require exact bearer auth and JSON, and do not expose allowlist', async t => {
  const missing = await start({ telegramToken: 'token', chatId: 'chat', voiceToolSecret: '' });
  t.after(() => missing.server.close());
  assert.equal((await fetch(`${missing.base}/ready/voice`)).status, 503);
  assert.equal((await voicePost(missing.base, '/api/voice/service-area', { zip: '91355' })).status, 503);
  for (const weak of ['x'.repeat(31), `${'x'.repeat(31)} `]) {
    const instance = await start({ telegramToken: 'token', chatId: 'chat', voiceToolSecret: weak });
    t.after(() => instance.server.close());
    assert.equal((await fetch(`${instance.base}/ready/voice`)).status, 503);
    assert.equal((await voicePost(instance.base, '/api/voice/service-area', { zip: '91355' }, weak)).status, 503);
  }

  const configured = await start({ telegramToken: 'token', chatId: 'chat', voiceToolSecret: SECRET });
  t.after(() => configured.server.close());
  assert.equal((await fetch(`${configured.base}/ready/voice`)).status, 200);
  assert.equal((await voicePost(configured.base, '/api/voice/service-area', { zip: '91355' }, 'wrong')).status, 401);
  const wrongType = await fetch(`${configured.base}/api/voice/service-area`, {
    method: 'POST', headers: { 'content-type': 'text/plain', authorization: `Bearer ${SECRET}` }, body: '{}',
  });
  assert.equal(wrongType.status, 415);
  const eligible = await voicePost(configured.base, '/api/voice/service-area', { zip: '91355-1234' });
  assert.deepEqual(await eligible.json(), { eligible: true, zip: '91355' });
  const outside = await voicePost(configured.base, '/api/voice/service-area', { zip: '90210' });
  assert.deepEqual(await outside.json(), { eligible: false, zip: '90210' });
  assert.equal((await voicePost(configured.base, '/api/voice/service-area', { zip: '91355', reveal: true })).status, 400);
});

test('backend rejects declined/unknown full leads before delivery and delivers out-of-area cards', async t => {
  let calls = 0;
  let sentText = '';
  const { server, base } = await start({
    telegramToken: 'telegram', chatId: '123', voiceToolSecret: SECRET,
    fetchImpl: async (_url, options) => { calls += 1; sentText = JSON.parse(options.body).text; return telegramSuccess(); },
  });
  t.after(() => server.close());
  for (const recording_consent of ['declined', 'unknown']) {
    assert.equal((await voicePost(base, '/api/voice/lead', validVoiceLead({ recording_consent }))).status, 400);
  }
  assert.equal(calls, 0);
  const outside = validVoiceLead({
    call_id: 'outside-call', location: { zip: '90210', service_area_eligible: false },
  });
  assert.equal((await voicePost(base, '/api/voice/lead', outside)).status, 200);
  assert.equal(calls, 1);
  assert.match(sentText, /OUT OF AREA/);
});

test('voice lead route returns 409 for sequential and concurrent payload conflicts', async t => {
  let deliveries = 0;
  let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { server, base } = await start({
    telegramToken: 'telegram', chatId: '123', voiceToolSecret: SECRET,
    fetchImpl: async () => { deliveries += 1; signalStarted(); await gate; return telegramSuccess(); },
  });
  t.after(() => server.close());
  const original = validVoiceLead();
  const changed = validVoiceLead({ project: { ...validVoiceLead().project, severity: 'high' } });
  const first = voicePost(base, '/api/voice/lead', original);
  await started;
  const concurrentConflict = await voicePost(base, '/api/voice/lead', changed);
  assert.equal(concurrentConflict.status, 409);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await voicePost(base, '/api/voice/lead', changed)).status, 409);
  assert.equal((await voicePost(base, '/api/voice/lead', original)).status, 200);
  assert.equal(deliveries, 1);
});

test('indeterminate Telegram delivery is cached and exact retries never resend', async t => {
  let calls = 0;
  const { server, base } = await start({
    telegramToken: 'telegram', chatId: '123', voiceToolSecret: SECRET,
    fetchImpl: async () => { calls += 1; return { ok: true, json: async () => ({ ok: true, result: {} }) }; },
  });
  t.after(() => server.close());
  assert.equal((await voicePost(base, '/api/voice/lead', validVoiceLead())).status, 502);
  const retry = await voicePost(base, '/api/voice/lead', validVoiceLead());
  assert.equal(retry.status, 502);
  assert.match((await retry.json()).message, /not confirmed.*not resent/i);
  assert.equal(calls, 1);
});

test('network-indeterminate delivery is cached while known Telegram rejection remains retryable', async t => {
  let calls = 0;
  const { server, base } = await start({
    telegramToken: 'telegram', chatId: '123', voiceToolSecret: SECRET,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new Error('socket timeout');
      if (calls === 2) return { ok: false, status: 400, json: async () => ({ ok: false }) };
      return telegramSuccess();
    },
  });
  t.after(() => server.close());
  const uncertain = validVoiceLead({ call_id: 'uncertain' });
  assert.equal((await voicePost(base, '/api/voice/lead', uncertain)).status, 503);
  assert.equal((await voicePost(base, '/api/voice/lead', uncertain)).status, 503);
  assert.equal(calls, 1);
  const rejected = validVoiceLead({ call_id: 'rejected' });
  assert.equal((await voicePost(base, '/api/voice/lead', rejected)).status, 502);
  assert.equal((await voicePost(base, '/api/voice/lead', rejected)).status, 200);
  assert.equal(calls, 3);
});

test('authenticated voice limits are tenant-wide safety caps and defaults are 100 leads/5min and 300 area checks/min', async t => {
  let deliveries = 0;
  const { server, base } = await start({
    telegramToken: 'telegram', chatId: '123', voiceToolSecret: SECRET,
    fetchImpl: async () => { deliveries += 1; return telegramSuccess(deliveries); },
  });
  t.after(() => server.close());
  for (let i = 0; i < 300; i += 1) {
    const response = await voicePost(base, '/api/voice/service-area', { zip: '91355' }, SECRET,
      { 'x-forwarded-for': `198.51.100.${i % 250}` });
    assert.equal(response.status, 200, `area ${i}`);
  }
  assert.equal((await voicePost(base, '/api/voice/service-area', { zip: '91355' })).status, 429);

  for (let i = 0; i < 100; i += 1) {
    const response = await voicePost(base, '/api/voice/lead', validVoiceLead({ call_id: `limit-call-${i}` }), SECRET,
      { 'x-forwarded-for': `203.0.113.${i}` });
    assert.equal(response.status, 200, `lead ${i}`);
  }
  assert.equal((await voicePost(base, '/api/voice/lead', validVoiceLead({ call_id: 'limit-call-101' }))).status, 429);
  // Per-call exact retries are handled by idempotency before the tenant cap.
  assert.equal((await voicePost(base, '/api/voice/lead', validVoiceLead({ call_id: 'limit-call-0' }))).status, 200);
  assert.equal(deliveries, 100);
});

test('authenticated voice routes accept Retell call envelopes without retaining transcript metadata', async t => {
  let deliveries = 0;
  let sentText = '';
  const { server, base } = await start({
    telegramToken: 'telegram', chatId: '123', voiceToolSecret: SECRET,
    fetchImpl: async (_url, options) => {
      deliveries += 1;
      sentText = JSON.parse(options.body).text;
      return telegramSuccess(91);
    },
  });
  t.after(() => server.close());

  const transcript = 'Caller private transcript context. '.repeat(1400);
  const areaEnvelope = {
    name: 'check_service_area',
    args: { zip: '91355' },
    call: { call_id: 'retell-real-call', transcript },
  };
  const area = await voicePost(base, '/api/voice/service-area', areaEnvelope);
  assert.equal(area.status, 200);
  assert.deepEqual(await area.json(), { eligible: true, zip: '91355' });

  const leadArgs = validVoiceLead();
  delete leadArgs.call_id;
  const leadEnvelope = {
    name: 'submit_voice_lead',
    args: leadArgs,
    call: { call_id: 'retell-real-call', transcript },
  };
  const lead = await voicePost(base, '/api/voice/lead', leadEnvelope);
  assert.equal(lead.status, 200);
  assert.deepEqual(await lead.json(), { success: true, delivered: true, call_id: 'retell-real-call' });
  assert.equal(deliveries, 1);
  assert.doesNotMatch(sentText, /private transcript context/i);

  const mismatch = await voicePost(base, '/api/voice/lead', {
    name: 'submit_voice_lead',
    args: validVoiceLead({ call_id: 'args-call' }),
    call: { call_id: 'different-call' },
  });
  assert.equal(mismatch.status, 400);
  assert.equal(deliveries, 1);

  const oversized = await voicePost(base, '/api/voice/service-area', {
    name: 'check_service_area', args: { zip: '91355' }, call: { transcript: 'x'.repeat(257 * 1024) },
  });
  assert.equal(oversized.status, 413);
});

test('authenticated request cap bounds malformed traffic before parsing while delivery cap remains', async t => {
  const { server, base } = await start({ voiceToolSecret: SECRET, voiceRequestRateLimit: 3, voiceRateLimit: 1 });
  t.after(() => server.close());
  assert.equal((await voicePost(base, '/api/voice/lead', {}, 'wrong')).status, 401);
  for (let i = 0; i < 2; i += 1) assert.equal((await voicePost(base, '/api/voice/lead', {})).status, 400);
  const malformed = await fetch(`${base}/api/voice/lead`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${SECRET}` }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await voicePost(base, '/api/voice/lead', validVoiceLead({ call_id: 'call-a' }))).status, 429);
});
