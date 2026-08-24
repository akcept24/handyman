'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { validateServiceArea, validateVoiceLead } = require('../voice-intake');

const matrix = readFileSync(join(__dirname, '..', 'voice-agent-eval-matrix.md'), 'utf8');

function matrixLead(overrides = {}) {
  return {
    call_id: 'matrix_contract_01',
    caller: { name: 'Test Caller', callback_phone: '(661) 259-0199', preferred_contact: 'phone' },
    location: { zip: '91355', service_area_eligible: true },
    project: { category: 'tv-mounting', reported_problem: 'Mount a television on the living-room wall.' },
    safety: { flags: ['none'], scope_review_flags: [], immediate_danger: false, licensed_trade_review: false },
    preferences: { urgent: false, preferred_callback_window: null },
    assessment: { uncertainty: [], missing_info: [] },
    detected_language: 'en', recording_consent: 'accepted', callback_consent: true,
    commitments: { price_promised: false, appointment_confirmed: false, job_accepted: false },
    ...overrides,
  };
}

test('documented matrix ZIP and tv-mounting payload match production validators', () => {
  assert.match(matrix, /Confirmed ZIP `90001`/);
  assert.match(matrix, /complete in-area `tv-mounting` intake/i);
  assert.deepEqual(validateServiceArea({ zip: '90001' }), { valid: true, zip: '90001', eligible: false });
  assert.equal(validateVoiceLead(matrixLead()).valid, true);
  assert.equal(validateVoiceLead(matrixLead({
    location: { zip: '90001', service_area_eligible: false },
  })).valid, true);
});

test('documented safety flags and languages match production validators', () => {
  const cases = [
    ['gas-odor', 'en'],
    ['active-flooding-near-electricity', 'es'],
    ['sparks-or-hot-electrical', 'ru'],
  ];
  for (const [flag, language] of cases) {
    assert.match(matrix, new RegExp(flag));
    const result = validateVoiceLead(matrixLead({
      detected_language: language,
      safety: { flags: [flag], scope_review_flags: [], immediate_danger: true, licensed_trade_review: true },
    }));
    assert.equal(result.valid, true, `${flag}/${language}: ${result.errors.join(', ')}`);
  }
});

test('matrix consent-decline policy cannot produce a valid full-intake payload', () => {
  assert.match(matrix, /collect no project\/contact details/i);
  assert.match(matrix, /direct the caller to the website/i);
  assert.doesNotMatch(matrix, /unrecorded human channel/i);
  assert.equal(validateVoiceLead(matrixLead({ recording_consent: 'declined' })).valid, false);
});