'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { buildSelfbotHeaders, rewriteAuthorization } = require('../src/rest/SelfbotREST.js');
const { DefaultUserAgent, DefaultSuperProperties } = require('../src/util/SelfbotDefaults.js');

const options = {
  ws: { properties: DefaultSuperProperties },
  http: { headers: {} },
};

test('header co x-super-properties dung base64', () => {
  const headers = buildSelfbotHeaders(options);
  const decoded = JSON.parse(Buffer.from(headers['x-super-properties'], 'base64').toString('utf8'));
  assert.strictEqual(decoded.browser, 'Chrome');
  assert.ok(!('$os' in decoded), 'khong duoc con key co $');
});

test('header co user-agent trung voi browser_user_agent', () => {
  const headers = buildSelfbotHeaders(options);
  assert.strictEqual(headers['user-agent'], DefaultUserAgent);
});

test('header co day du bo sec-ch-ua va origin discord', () => {
  const headers = buildSelfbotHeaders(options);
  for (const key of [
    'accept',
    'accept-language',
    'origin',
    'referer',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'x-discord-locale',
    'x-discord-timezone',
    'x-debug-options',
  ]) {
    assert.ok(key in headers, `thieu header ${key}`);
  }
  assert.strictEqual(headers.origin, 'https://discord.com');
});

test('http.headers cua user ghi de duoc default', () => {
  const headers = buildSelfbotHeaders({
    ...options,
    http: { headers: { 'accept-language': 'vi-VN' } },
  });
  assert.strictEqual(headers['accept-language'], 'vi-VN');
});

test('rewriteAuthorization bo prefix Bot', () => {
  const out = rewriteAuthorization({ authorization: 'Bot abc.def' }, 'abc.def');
  assert.strictEqual(out.authorization, 'abc.def');
});

test('rewriteAuthorization bo prefix Bearer va giu header khac', () => {
  const out = rewriteAuthorization({ Authorization: 'Bearer abc', 'x-keep': '1' }, 'abc');
  assert.strictEqual(out.Authorization, 'abc');
  assert.strictEqual(out['x-keep'], '1');
});

test('rewriteAuthorization khong doi gi khi token da tran', () => {
  const out = rewriteAuthorization({ authorization: 'abc' }, 'abc');
  assert.strictEqual(out.authorization, 'abc');
});

test('BaseClient dung shim, khong dung REST thuan', () => {
  const BaseClient = require('../src/client/BaseClient.js');
  const client = new BaseClient({});
  assert.strictEqual(
    typeof client.rest.options.makeRequest,
    'function',
    'makeRequest phai la function do shim gan vao',
  );
  assert.strictEqual(client.rest.options.headers.origin, 'https://discord.com');
  client.destroy();
});
