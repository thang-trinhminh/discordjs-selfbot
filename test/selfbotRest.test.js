'use strict';

const assert = require('node:assert');
const { Buffer } = require('node:buffer');
const { test } = require('node:test');
const { buildSelfbotHeaders, rewriteAuthorization, rewriteUserAgent } = require('../src/rest/SelfbotREST.js');
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

test('chi con mot user-agent, va la cua browser', () => {
  // @discordjs/rest them 'User-Agent' viet hoa cua no sau header cua minh.
  // Con ca hai thi undici gui hai dong, Discord lay dong sau va thay bot.
  const headers = rewriteUserAgent(
    { 'user-agent': DefaultUserAgent, 'User-Agent': 'DiscordBot (https://discord.js.org, 2.6.3)' },
    DefaultUserAgent,
  );

  const names = Object.keys(headers).filter(key => key.toLowerCase() === 'user-agent');
  assert.deepStrictEqual(names, ['user-agent']);
  assert.strictEqual(headers['user-agent'], DefaultUserAgent);
});

test('rewriteUserAgent dat user-agent ca khi request chua co', () => {
  const headers = rewriteUserAgent({ 'x-keep': '1' }, DefaultUserAgent);
  assert.strictEqual(headers['user-agent'], DefaultUserAgent);
  assert.strictEqual(headers['x-keep'], '1');
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

test('users.fetch di qua route profile chu khong phai GET /users/:id', async () => {
  const Client = require('../src/client/Client.js');
  const client = new Client({});
  const calls = [];

  // `GET /users/:id` là route bot-only, token người dùng ăn 403 code 40001.
  client.rest.get = async route => {
    calls.push(route);
    if (!route.endsWith('/profile')) throw new Error(`route bot-only bi goi: ${route}`);
    return { user: { id: '77', username: 'ai do', discriminator: '0', global_name: 'Ai Do' } };
  };

  const user = await client.users.fetch('77');

  assert.deepStrictEqual(calls, ['/users/77/profile']);
  assert.strictEqual(user.id, '77');
  assert.strictEqual(user.username, 'ai do');

  client.destroy();
});
