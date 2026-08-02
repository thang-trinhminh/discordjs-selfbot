'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Options = require('../src/util/Options.js');
const { DefaultCapabilities } = require('../src/util/SelfbotDefaults.js');

test('intents mac dinh la 0 nen khong bat user phai truyen', () => {
  assert.strictEqual(Options.createDefault().intents, 0);
});

test('Client khoi tao duoc khong can truyen intents', () => {
  const Client = require('../src/client/Client.js');
  const client = new Client({});
  // IntentsBitField dùng number, không phải BigInt (khác PermissionsBitField).
  assert.strictEqual(client.options.intents.bitfield, 0);
  client.destroy();
});

test('ws co properties, capabilities, client_state', () => {
  const { ws } = Options.createDefault();
  assert.strictEqual(ws.properties.browser, 'Chrome');
  assert.strictEqual(ws.capabilities, DefaultCapabilities);
  assert.strictEqual(typeof ws.client_state, 'object');
});

test('http mac dinh co headers rong va agent null', () => {
  const { http } = Options.createDefault();
  assert.deepStrictEqual(http.headers, {});
  assert.strictEqual(http.agent, null);
});

test('captcha option mac dinh', () => {
  const defaults = Options.createDefault();
  assert.strictEqual(defaults.captchaSolver, null);
  assert.strictEqual(defaults.captchaRetryLimit, 3);
});
