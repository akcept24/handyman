'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const MAX_BODY_BYTES = 32 * 1024;
const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/privacy.html', 'privacy.html'],
  ['/terms.html', 'terms.html'],
  ['/styles.css', 'styles.css'],
  ['/script.js', 'script.js'],
  ['/robots.txt', 'robots.txt'],
  ['/sitemap.xml', 'sitemap.xml'],
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
  return String(value ?? '').trim().slice(0, max);
}

function validateLead(input) {
  const lead = {
    name: clean(input?.name, 100),
    phone: clean(input?.phone, 30),
    email: clean(input?.email, 160),
    service: clean(input?.service, 80),
    zip: clean(input?.zip, 10),
    message: clean(input?.message, 2000),
    form_type: clean(input?.form_type, 40),
    urgent: input?.urgent === true || input?.urgent === 'on',
    website: clean(input?.website, 200),
  };
  const errors = [];
  if (lead.name.length < 2) errors.push('Please enter your name.');
  if (lead.phone.replace(/\D/g, '').length < 10) errors.push('Please enter a valid phone number.');
  if (!lead.service) errors.push('Please select a service.');
  if (!/^\d{5}(?:-\d{4})?$/.test(lead.zip)) errors.push('Please enter a valid ZIP code.');
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.push('Please enter a valid email.');
  return { valid: errors.length === 0, errors, lead };
}

function formatLead(lead) {
  const rows = [
    '<b>New handyman estimate request</b>',
    `<b>Name:</b> ${escapeHtml(lead.name)}`,
    `<b>Phone:</b> ${escapeHtml(lead.phone)}`,
    lead.email ? `<b>Email:</b> ${escapeHtml(lead.email)}` : '',
    `<b>ZIP:</b> ${escapeHtml(lead.zip)}`,
    `<b>Service:</b> ${escapeHtml(lead.service)}`,
    `<b>Urgent:</b> ${lead.urgent ? 'Yes' : 'No'}`,
    lead.message ? `<b>Project:</b> ${escapeHtml(lead.message)}` : '',
    `<b>Form:</b> ${escapeHtml(lead.form_type || 'unknown')}`,
  ];
  return rows.filter(Boolean).join('\n');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
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
  const cache = extension === '.html' ? 'no-cache' : 'public, max-age=86400';
  res.writeHead(200, { 'content-type': contentType, 'cache-control': cache });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function createApp(options = {}) {
  const telegramToken = options.telegramToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId ?? process.env.TELEGRAM_CHAT_ID;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'SAMEORIGIN');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");

    const url = new URL(req.url, 'http://localhost');
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (serveStatic(req, res, url.pathname)) return;
      sendJson(res, 404, { success: false, message: 'Not found.' });
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/api/submit-quote') {
      sendJson(res, 405, { success: false, message: 'Method not allowed.' });
      return;
    }

    try {
      const input = await readJson(req);
      if (input.website) { // honeypot: return a neutral response to bots
        sendJson(res, 200, { success: true });
        return;
      }
      const result = validateLead(input);
      if (!result.valid) {
        sendJson(res, 400, { success: false, message: result.errors[0], errors: result.errors });
        return;
      }
      if (!telegramToken || !chatId) {
        sendJson(res, 503, { success: false, message: 'Online requests are temporarily unavailable. Please try again later.' });
        return;
      }

      const response = await fetchImpl(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: formatLead(result.lead), parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(10000),
      });
      const delivery = await response.json().catch(() => ({}));
      if (!response.ok || delivery.ok !== true) throw new Error('Lead delivery failed');
      sendJson(res, 200, { success: true, message: 'Your request was sent successfully.' });
    } catch (error) {
      console.error('Lead request failed:', error.message);
      sendJson(res, error.status || 502, { success: false, message: 'We could not send your request. Please try again in a few minutes.' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '0.0.0.0', () => console.log(`Handyman site listening on port ${port}`));
}

module.exports = { createApp, validateLead, formatLead };
