'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');

function makeClient() {
  const client = new Client({});
  client.token = 'tok';
  return client;
}

test('logout goi auth/logout roi destroy', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => posts.push([route, options.body]);
  let destroyed = false;
  client.destroy = async () => {
    destroyed = true;
  };

  await client.logout();

  assert.deepStrictEqual(posts, [['/auth/logout', { provider: null, voip_provider: null }]]);
  assert.strictEqual(destroyed, true);
});

test('redeemNitro tach ma tu nhieu dang link', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => {
    posts.push([route, options.body]);
    return {};
  };

  await client.redeemNitro('https://discord.gift/abcdefghijklmnop');
  await client.redeemNitro('https://discord.com/gifts/abcdefghijklmnop');
  await client.redeemNitro('abcdefghijklmnop');

  for (const [route] of posts) {
    assert.strictEqual(route, '/entitlements/gift-codes/abcdefghijklmnop/redeem');
  }

  client.destroy();
});

test('redeemNitro resolve kenh va nguon thanh toan', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => {
    posts.push(options.body);
    return {};
  };

  await client.redeemNitro('abcdefghijklmnop');
  await client.redeemNitro('abcdefghijklmnop', '900', 'pay1');

  assert.deepStrictEqual(posts[0], { channel_id: null, payment_source_id: null });
  assert.deepStrictEqual(posts[1], { channel_id: '900', payment_source_id: 'pay1' });

  client.destroy();
});

test('redeemNitro tu choi dau vao khong phai chuoi', async () => {
  const client = makeClient();
  await assert.rejects(() => client.redeemNitro(123), /must be a string/);
  client.destroy();
});

test('authorizeURL tu choi url khong phai cua Discord', async () => {
  const client = makeClient();
  await assert.rejects(() => client.authorizeURL('https://example.com/oauth2/authorize?x=1'), /OAuth2 authorize url/);
  client.destroy();
});

test('authorizeURL chuyen permissions/guild_id tu query sang body', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => {
    posts.push([route, [...options.query.entries()], options.body]);
    return {};
  };

  await client.authorizeURL(
    'https://discord.com/oauth2/authorize?client_id=123&scope=identify&permissions=8&guild_id=456',
  );

  const [route, query, body] = posts[0];
  assert.strictEqual(route, '/oauth2/authorize');
  // Ba field này thuộc body, để lại trong query sẽ bị Discord từ chối.
  assert.deepStrictEqual(query, [
    ['client_id', '123'],
    ['scope', 'identify'],
  ]);
  assert.strictEqual(body.permissions, '8');
  assert.strictEqual(body.guild_id, '456');
  assert.strictEqual(body.authorize, true);

  client.destroy();
});

test('installUserApps tra false khi app khong ho tro cai cho user', async () => {
  const client = makeClient();
  client.rest.get = async () => ({ integration_types_config: { 0: {} } });

  assert.strictEqual(await client.installUserApps('123'), false);
  client.destroy();
});

test('installUserApps gui scope lay tu config cua app', async () => {
  const client = makeClient();
  client.rest.get = async () => ({
    integration_types_config: { 1: { oauth2_install_params: { scopes: ['applications.commands'] } } },
  });
  const posts = [];
  client.rest.post = async (route, options) => {
    posts.push([[...options.query.entries()], options.body]);
    return {};
  };

  await client.installUserApps('123');

  assert.deepStrictEqual(posts[0][0], [
    ['client_id', '123'],
    ['scope', 'applications.commands'],
  ]);
  assert.strictEqual(posts[0][1].integration_type, 1);

  client.destroy();
});

test('deauthorize tim token theo application id', async () => {
  const client = makeClient();
  client.rest.get = async () => [
    { id: 'tok1', application: { id: 'app1' }, scopes: [] },
    { id: 'tok2', application: { id: 'app2' }, scopes: [] },
  ];
  const deletes = [];
  client.rest.delete = async route => deletes.push(route);

  await client.deauthorize('app2');
  assert.deepStrictEqual(deletes, ['/oauth2/tokens/tok2']);

  client.destroy();
});

test('deauthorize voi type token xoa thang, khong goi GET', async () => {
  const client = makeClient();
  let gets = 0;
  client.rest.get = async () => {
    gets += 1;
    return [];
  };
  const deletes = [];
  client.rest.delete = async route => deletes.push(route);

  await client.deauthorize('tok1', 'token');

  assert.deepStrictEqual(deletes, ['/oauth2/tokens/tok1']);
  assert.strictEqual(gets, 0);

  client.destroy();
});

test('deauthorize bao loi khi khong tim thay application', async () => {
  const client = makeClient();
  client.rest.get = async () => [];
  await assert.rejects(() => client.deauthorize('app-la'), /No authorization found/);
  client.destroy();
});

test('authorizedApplications tra Collection kem ham deauthorize', async () => {
  const client = makeClient();
  client.rest.get = async () => [{ id: 'tok1', application: { id: 'app1', name: 'App' }, scopes: ['identify'] }];
  const deletes = [];
  client.rest.delete = async route => deletes.push(route);

  const apps = await client.authorizedApplications();
  const entry = apps.get('app1');

  assert.strictEqual(entry.authorizedApplicationId, 'tok1');
  assert.deepStrictEqual(entry.scopes, ['identify']);
  assert.strictEqual(entry.application.name, 'App');

  await entry.deauthorize();
  assert.deepStrictEqual(deletes, ['/oauth2/tokens/tok1']);

  client.destroy();
});

test('refreshAttachmentURL bo query cu truoc khi gui', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => {
    posts.push([route, options.body]);
    return { refreshed_urls: [{ original: 'a', refreshed: 'b' }] };
  };

  const result = await client.refreshAttachmentURL('https://cdn.discordapp.com/a.png?ex=1&is=2&hm=3');

  assert.deepStrictEqual(posts[0], [
    '/attachments/refresh-urls',
    { attachment_urls: ['https://cdn.discordapp.com/a.png'] },
  ]);
  assert.deepStrictEqual(result, [{ original: 'a', refreshed: 'b' }]);

  client.destroy();
});

test('acceptInvite tra guild tu cache, khong goi API', async () => {
  const client = makeClient();
  client.guilds.cache.set('g1', { id: 'g1' });
  client.fetchInvite = async () => ({ code: 'abc', guild: { id: 'g1' }, channelId: 'c1' });
  let posted = false;
  client.rest.post = async () => {
    posted = true;
  };

  const result = await client.acceptInvite('abc');

  assert.deepStrictEqual(result, { id: 'g1' });
  assert.strictEqual(posted, false);

  client.destroy();
});

test('acceptInvite bo qua onboarding voi guest invite', async () => {
  const { InviteFlags } = require('discord-api-types/v10');
  const client = makeClient();
  client.fetchInvite = async () => ({
    code: 'abc',
    guild: { id: 'g2' },
    channelId: 'c1',
    flags: { has: flag => flag === InviteFlags.IsGuestInvite },
  });
  client.rest.post = async () => ({});
  let onboardingFetched = false;
  client.rest.get = async () => {
    onboardingFetched = true;
    return { enabled: true, prompts: [] };
  };

  await client.acceptInvite('abc');
  assert.strictEqual(onboardingFetched, false);

  client.destroy();
});

test('acceptInvite tra loi onboarding bang lua chon dau tien', async () => {
  const client = makeClient();
  client.fetchInvite = async () => ({ code: 'abc', guild: { id: 'g3' }, channelId: 'c1', flags: { has: () => false } });

  const posts = [];
  client.rest.post = async (route, options) => {
    posts.push([route, options.body]);
    return {};
  };
  client.rest.get = async () => ({
    enabled: true,
    prompts: [
      { id: 'p1', in_onboarding: true, required: true, options: [{ id: 'o1' }, { id: 'o2' }] },
      { id: 'p2', in_onboarding: false, required: true, options: [{ id: 'o3' }] },
    ],
  });

  await client.acceptInvite('abc');

  const onboarding = posts.find(([route]) => route === '/guilds/g3/onboarding-responses');
  assert.ok(onboarding, 'phai goi onboarding-responses');
  // Chỉ prompt in_onboarding mới được trả lời, và chỉ lấy option đầu.
  assert.deepStrictEqual(onboarding[1].onboarding_responses, ['o1']);
  assert.deepStrictEqual(Object.keys(onboarding[1].onboarding_prompts_seen), ['p1']);
  assert.deepStrictEqual(Object.keys(onboarding[1].onboarding_responses_seen), ['o1', 'o2']);

  client.destroy();
});

test('acceptInvite bo qua onboarding khi guild tat tinh nang', async () => {
  const client = makeClient();
  client.fetchInvite = async () => ({ code: 'abc', guild: { id: 'g4' }, channelId: 'c1', flags: { has: () => false } });
  const posts = [];
  client.rest.post = async route => {
    posts.push(route);
    return {};
  };
  client.rest.get = async () => ({ enabled: false, prompts: [] });

  await client.acceptInvite('abc');

  assert.deepStrictEqual(posts, ['/invites/abc']);
  client.destroy();
});

test('acceptInvite bao loi khi khong resolve duoc ma moi', async () => {
  const client = makeClient();
  await assert.rejects(() => client.acceptInvite(''), /resolve an invite code/);
  client.destroy();
});
