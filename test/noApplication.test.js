'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');

// Tài khoản người dùng không nhận `application` trong READY, nên `client.application`
// luôn là null. Upstream viết cho bot nên giả định nó luôn tồn tại. Mỗi test dưới
// đây khoá một đường đi mà giả định đó làm crash.

test('client.application la null voi tai khoan nguoi dung', () => {
  const client = new Client({});
  assert.strictEqual(client.application, null);
  client.destroy();
});

test('MessageReaction#emoji khong crash voi emoji tuy chinh', () => {
  const client = new Client({});
  const MessageReaction = require('../src/structures/MessageReaction.js');

  const message = { client, guild: null };
  const reaction = new MessageReaction(client, { emoji: { id: '123', name: 'pepe' }, count: 1, me: false }, message);

  // Đây là đường chạy mỗi khi có reaction bằng emoji tuỳ chỉnh — deref thẳng
  // `client.application.emojis` là hỏng ngay.
  assert.doesNotThrow(() => reaction.emoji);
  assert.strictEqual(reaction.emoji.id, '123');

  client.destroy();
});

test('handler SUBSCRIPTION_* bo qua khi khong co application', () => {
  const client = new Client({});
  const emitted = [];
  client.on('subscriptionCreate', () => emitted.push('create'));

  for (const name of ['SUBSCRIPTION_CREATE', 'SUBSCRIPTION_UPDATE', 'SUBSCRIPTION_DELETE']) {
    const handler = require(`../src/client/websocket/handlers/${name}.js`);
    assert.doesNotThrow(() => handler(client, { d: { id: 's1' } }), name);
  }

  assert.strictEqual(emitted.length, 0, 'khong co application thi khong emit');
  client.destroy();
});

test('action Entitlement* bo qua khi khong co application', () => {
  const client = new Client({});
  const emitted = [];
  client.on('entitlementCreate', () => emitted.push('create'));

  for (const name of ['EntitlementCreate', 'EntitlementUpdate', 'EntitlementDelete']) {
    assert.doesNotThrow(() => client.actions[name].handle({ id: 'e1' }), name);
  }

  assert.strictEqual(emitted.length, 0);
  client.destroy();
});

test('BaseInteraction giu entitlement tho khi khong co application', () => {
  const client = new Client({});
  const BaseInteraction = require('../src/structures/BaseInteraction.js');

  const interaction = new BaseInteraction(client, {
    id: 'i1',
    application_id: 'app1',
    type: 2,
    token: 'tok',
    version: 1,
    user: { id: 'u1', username: 'me', discriminator: '0' },
    entitlements: [{ id: 'e1', sku_id: 's1' }],
    app_permissions: '0',
    authorizing_integration_owners: {},
  });

  // Không cache được thì giữ nguyên dữ liệu thô, không ném.
  assert.strictEqual(interaction.entitlements.size, 1);
  assert.strictEqual(interaction.entitlements.get('e1').id, 'e1');

  client.destroy();
});
