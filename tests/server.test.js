const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp, validateLead, formatLead } = require('../server');

async function startServer(options = {}) {
  const server = createApp(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function post(baseUrl, payload) {
  return fetch(`${baseUrl}/api/submit-quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test('validateLead rejects malformed leads', () => {
  assert.deepEqual(validateLead({ name: 'A', phone: '12' }).valid, false);
  assert.deepEqual(validateLead({
    name: 'Alex Smith',
    phone: '(213) 555-0199',
    service: 'general',
    zip: '90210',
  }).valid, true);
});

test('formatLead escapes Telegram HTML and contains lead context', () => {
  const text = formatLead({
    name: '<Alex & Co>',
    phone: '(213) 555-0199',
    service: 'general',
    zip: '90210',
    message: '<script>alert(1)</script>',
    form_type: 'hero_form',
  });
  assert.match(text, /&lt;Alex &amp; Co&gt;/);
  assert.doesNotMatch(text, /<script>/);
  assert.match(text, /90210/);
  assert.match(text, /hero_form/);
});

test('health endpoint reports readiness without exposing configuration', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('static server serves nested WebP assets and blocks traversal', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const image = await fetch(`${baseUrl}/images/generated/hero-handyman.webp`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/webp');
  assert.ok((await image.arrayBuffer()).byteLength > 0);

  const traversal = await fetch(`${baseUrl}/images/%2e%2e/server.js`);
  assert.equal(traversal.status, 404);
});

test('API returns 400 for invalid payload', async (t) => {
  const { server, baseUrl } = await startServer({ telegramToken: 'x', chatId: '1' });
  t.after(() => server.close());
  const response = await post(baseUrl, { name: 'x' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).success, false);
});

test('API returns 503 when lead delivery is not configured', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const response = await post(baseUrl, {
    name: 'Alex Smith', phone: '(213) 555-0199', service: 'general', zip: '90210',
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('API confirms success only after Telegram accepts the lead', async (t) => {
  let outbound;
  const fetchImpl = async (url, options) => {
    outbound = { url, options };
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) };
  };
  const { server, baseUrl } = await startServer({
    telegramToken: 'test-token', chatId: '123', fetchImpl,
  });
  t.after(() => server.close());

  const response = await post(baseUrl, {
    name: 'Alex Smith', phone: '(213) 555-0199', service: 'general', zip: '90210',
    form_type: 'contact_form', message: 'Repair a door',
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.match(outbound.url, /bot.*\/sendMessage$/);
  const body = JSON.parse(outbound.options.body);
  assert.equal(body.chat_id, '123');
  assert.match(body.text, /Repair a door/);
});
