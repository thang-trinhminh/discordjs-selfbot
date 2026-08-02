'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createSelfbotREST, makeGatewayBotResponse } = require('../src/rest/SelfbotREST.js');
const Options = require('../src/util/Options.js');

test('makeGatewayBotResponse tra dung shape @discordjs/ws can', async () => {
  const res = makeGatewayBotResponse();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.ok, true);
  const body = await res.json();
  assert.strictEqual(body.url, 'wss://gateway.discord.gg');
  assert.strictEqual(body.shards, 1);
  assert.strictEqual(body.session_start_limit.max_concurrency, 1);
  assert.strictEqual(typeof body.session_start_limit.reset_after, 'number');
});

test('makeGatewayBotResponse co content-type json', () => {
  const res = makeGatewayBotResponse();
  assert.strictEqual(res.headers.get('content-type'), 'application/json');
});

test('makeRequest chan /gateway/bot truoc khi ra mang', async () => {
  const rest = createSelfbotREST(Options.createDefault());
  // URL trỏ tới host không tồn tại: nếu shim không chặn thì request sẽ lỗi DNS,
  // nên test pass chứng minh được là không có request nào đi ra.
  const res = await rest.options.makeRequest('https://invalid.invalid/api/v10/gateway/bot', {
    headers: {},
  });
  const body = await res.json();
  assert.strictEqual(body.url, 'wss://gateway.discord.gg');
});
