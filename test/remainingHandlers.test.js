'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { setImmediate } = require('node:timers');
const Client = require('../src/client/Client.js');
const PremiumUsageFlagsBitField = require('../src/util/PremiumUsageFlagsBitField.js');
const PurchasedFlagsBitField = require('../src/util/PurchasedFlagsBitField.js');

test('bitfield Nitro dung gia tri cua v13', () => {
  assert.strictEqual(PremiumUsageFlagsBitField.Flags.PremiumDiscriminator, 1);
  assert.strictEqual(PremiumUsageFlagsBitField.Flags.AnimatedAvatar, 2);
  assert.strictEqual(PremiumUsageFlagsBitField.Flags.ProfileBanner, 4);

  assert.strictEqual(PurchasedFlagsBitField.Flags.NitroClassic, 1);
  assert.strictEqual(PurchasedFlagsBitField.Flags.Nitro, 2);
  assert.strictEqual(PurchasedFlagsBitField.Flags.GuildBoost, 4);
  assert.strictEqual(PurchasedFlagsBitField.Flags.NitroBasic, 8);
});

test('nam handler con thieu deu duoc dang ky', () => {
  const handlers = require('../src/client/websocket/handlers/index.js');
  for (const name of [
    'APPLICATION_COMMAND_CREATE',
    'APPLICATION_COMMAND_UPDATE',
    'APPLICATION_COMMAND_DELETE',
    'USER_REQUIRED_ACTION_UPDATE',
    'VOICE_CHANNEL_STATUS_UPDATE',
  ]) {
    assert.strictEqual(typeof handlers[name], 'function', `thieu handler ${name}`);
  }
});

test('APPLICATION_COMMAND_* bo qua khi chua co manager', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/APPLICATION_COMMAND_CREATE.js');

  // Tài khoản người dùng không nhận `application` trong READY, nên phải guard.
  assert.strictEqual(client.application, null);
  assert.doesNotThrow(() => handler(client, { d: { id: 'c1', application_id: 'app1' } }));

  client.destroy();
});

test('APPLICATION_COMMAND_DELETE xoa khoi cache roi emit', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/APPLICATION_COMMAND_DELETE.js');
  const emitted = [];
  client.on('applicationCommandDelete', command => emitted.push(command));

  const guild = { commands: { cache: new Map([['c1', { id: 'c1' }]]), _add: () => ({ id: 'c1' }) } };
  client.guilds.cache.set('g1', guild);

  handler(client, { d: { id: 'c1', guild_id: 'g1', application_id: 'app1' } });

  assert.strictEqual(guild.commands.cache.has('c1'), false);
  assert.strictEqual(emitted[0].id, 'c1');

  client.destroy();
});

test('VOICE_CHANNEL_STATUS_UPDATE emit ca ban cu lan ban moi', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/VOICE_CHANNEL_STATUS_UPDATE.js');
  const emitted = [];
  client.on('voiceChannelStatusUpdate', (...args) => emitted.push(args));

  const channel = {
    id: 'v1',
    status: 'cu',
    _clone() {
      return { ...this };
    },
  };
  client.channels.cache.set('v1', channel);

  handler(client, { d: { id: 'v1', status: 'moi' } });

  assert.strictEqual(emitted[0][0].status, 'cu');
  assert.strictEqual(emitted[0][1].status, 'moi');
  assert.strictEqual(channel.status, 'moi');

  client.destroy();
});

test('VOICE_CHANNEL_STATUS_UPDATE bo qua kenh chua cache', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/VOICE_CHANNEL_STATUS_UPDATE.js');
  assert.doesNotThrow(() => handler(client, { d: { id: 'khong-co', status: 'x' } }));
  client.destroy();
});

test('USER_REQUIRED_ACTION_UPDATE emit hanh dong kem mo ta', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/USER_REQUIRED_ACTION_UPDATE.js');
  const emitted = [];
  client.on('userRequiredActionUpdate', (...args) => emitted.push(args));

  handler(client, { d: { required_action: 'REQUIRE_VERIFIED_PHONE' } });
  handler(client, { d: { required_action: null } });
  handler(client, { d: { required_action: 'CAI_GI_DO_MOI' } });

  assert.deepStrictEqual(emitted[0], ['REQUIRE_VERIFIED_PHONE', 'You must verify your phone number']);
  assert.strictEqual(emitted[1][0], null);
  assert.match(emitted[2][1], /Unknown required action/);

  client.destroy();
});

test('KHONG tu chap nhan dieu khoan khi chua bat option', async () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/USER_REQUIRED_ACTION_UPDATE.js');
  let patched = false;
  client.rest.patch = async () => {
    patched = true;
  };

  // Mặc định phải là tắt: đây là hành động pháp lý nhân danh chủ tài khoản.
  assert.strictEqual(client.options.autoAcceptAgreements, false);
  handler(client, { d: { required_action: 'AGREEMENTS' } });

  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(patched, false, 'khong duoc tu chap nhan dieu khoan');

  client.destroy();
});

test('chi tu chap nhan dieu khoan khi bat tuong minh', async () => {
  const client = new Client({ autoAcceptAgreements: true });
  const handler = require('../src/client/websocket/handlers/USER_REQUIRED_ACTION_UPDATE.js');
  const calls = [];
  client.rest.patch = async (route, options) => calls.push([route, options.body]);

  handler(client, { d: { required_action: 'AGREEMENTS' } });

  await new Promise(resolve => setImmediate(resolve));
  assert.deepStrictEqual(calls, [['/users/@me/agreements', { terms: true, privacy: true }]]);

  client.destroy();
});

test('THREAD_LIST_SYNC chiu duoc payload thieu threads va members', () => {
  const client = new Client({});
  const guild = { id: 'g1', channels: { cache: new Map() } };
  client.guilds.cache.set('g1', guild);

  const handler = require('../src/client/websocket/handlers/THREAD_LIST_SYNC.js');
  const seen = [];
  client.on('threadListSync', (threads, syncedGuild) => seen.push([threads.size, syncedGuild.id]));

  // Tai khoan nguoi dung nhan packet nay ngay sau khi subscribe guild (op 14),
  // va payload khong co `threads` lan `members`. Upstream doc thang -> chet.
  assert.doesNotThrow(() => handler(client, { d: { guild_id: 'g1' } }));
  assert.deepStrictEqual(seen, [[0, 'g1']]);

  client.destroy();
});
