'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');
const GuildBoost = require('../src/structures/GuildBoost.js');
const WebEmbed = require('../src/structures/WebEmbed.js');

const UNUSED_SLOT = { id: 'slot1', subscription_id: 'sub1', canceled: false, cooldown_ends_at: null };
const USED_SLOT = {
  ...UNUSED_SLOT,
  id: 'slot2',
  premium_guild_subscription: { id: 'pgs1', guild_id: 'g1', ended: false },
};

test('GuildBoost doc suat chua dung', () => {
  const client = new Client({});
  const boost = new GuildBoost(client, UNUSED_SLOT);

  assert.strictEqual(boost.id, 'slot1');
  assert.strictEqual(boost.subscriptionId, 'sub1');
  assert.strictEqual(boost.used, false);
  assert.strictEqual(boost.guildId, null);
  assert.strictEqual(boost.guild, null);
  assert.strictEqual(boost.cooldownEndsAt, null);

  client.destroy();
});

test('GuildBoost doc suat da dung', () => {
  const client = new Client({});
  client.guilds.cache.set('g1', { id: 'g1' });
  const boost = new GuildBoost(client, USED_SLOT);

  assert.strictEqual(boost.used, true);
  assert.strictEqual(boost.guildId, 'g1');
  assert.strictEqual(boost.premiumGuildSubscriptionId, 'pgs1');
  assert.deepStrictEqual(boost.guild, { id: 'g1' });

  client.destroy();
});

test('subscribe gui slot id va cap nhat state tu ket qua', async () => {
  const client = new Client({});
  const boost = new GuildBoost(client, UNUSED_SLOT);
  const puts = [];
  client.rest.put = async (route, options) => {
    puts.push([route, options.body]);
    return [{ id: 'pgs9', guild_id: 'g5', ended: false, user_premium_guild_subscription_slot_id: 'slot1' }];
  };

  await boost.subscribe('g5');

  assert.deepStrictEqual(puts, [
    ['/guilds/g5/premium/subscriptions', { user_premium_guild_subscription_slot_ids: ['slot1'] }],
  ]);
  assert.strictEqual(boost.used, true);
  assert.strictEqual(boost.guildId, 'g5');
  assert.strictEqual(boost.premiumGuildSubscriptionId, 'pgs9');

  client.destroy();
});

test('subscribe tu choi khi suat da duoc dung', async () => {
  const client = new Client({});
  const boost = new GuildBoost(client, USED_SLOT);
  await assert.rejects(() => boost.subscribe('g5'), /already used/);
  client.destroy();
});

test('unsubscribe goi dung route roi xoa lien ket', async () => {
  const client = new Client({});
  const boost = new GuildBoost(client, USED_SLOT);
  const deletes = [];
  client.rest.delete = async route => deletes.push(route);

  await boost.unsubscribe();

  assert.deepStrictEqual(deletes, ['/guilds/g1/premium/subscriptions/pgs1']);
  assert.strictEqual(boost.used, false);
  assert.strictEqual(boost.guildId, null);

  client.destroy();
});

test('unsubscribe tu choi khi suat chua duoc dung', async () => {
  const client = new Client({});
  const boost = new GuildBoost(client, UNUSED_SLOT);
  await assert.rejects(() => boost.unsubscribe(), /not used on any guild/);
  client.destroy();
});

test('BillingManager nap ba loai du lieu vao dung Collection', async () => {
  const client = new Client({});
  const routes = [];
  client.rest.get = async route => {
    routes.push(route);
    if (route.endsWith('payment-sources')) return [{ id: 'ps1' }];
    if (route.endsWith('subscription-slots')) return [UNUSED_SLOT, USED_SLOT];
    return [{ id: 'sub1' }];
  };

  assert.deepStrictEqual([...(await client.billing.fetchPaymentSources()).keys()], ['ps1']);
  assert.deepStrictEqual([...(await client.billing.fetchGuildBoosts()).keys()], ['slot1', 'slot2']);
  assert.deepStrictEqual([...(await client.billing.fetchCurrentSubscription()).keys()], ['sub1']);

  assert.ok(client.billing.guildBoosts.get('slot1') instanceof GuildBoost);
  assert.deepStrictEqual(routes, [
    '/users/@me/billing/payment-sources',
    '/users/@me/guilds/premium/subscription-slots',
    '/users/@me/billing/subscriptions',
  ]);

  client.destroy();
});

test('WebEmbed dung query string tu cac setter', () => {
  const embed = new WebEmbed()
    .setTitle('Tiêu đề')
    .setDescription('Mô tả')
    .setURL('https://kalix.vn')
    .setColor('#FF0000')
    .setAuthor({ name: 'Tác giả', url: 'https://kalix.vn/tac-gia' })
    .setProvider({ name: 'Kalix', url: 'https://kalix.vn' });

  const params = new URL(embed.toString()).searchParams;

  assert.strictEqual(params.get('title'), 'Tiêu đề');
  assert.strictEqual(params.get('description'), 'Mô tả');
  assert.strictEqual(params.get('url'), 'https://kalix.vn');
  assert.strictEqual(params.get('color'), '#ff0000');
  assert.strictEqual(params.get('author_name'), 'Tác giả');
  assert.strictEqual(params.get('provider_name'), 'Kalix');
});

test('WebEmbed dem du 6 chu so mau', () => {
  const embed = new WebEmbed().setColor(0x0000ff);
  assert.strictEqual(new URL(embed.toString()).searchParams.get('color'), '#0000ff');
});

test('setImage va setThumbnail loai tru nhau', () => {
  const embed = new WebEmbed().setThumbnail('https://kalix.vn/thumb.png');
  assert.strictEqual(embed.imageType, 'thumbnail');

  embed.setImage('https://kalix.vn/big.png');
  assert.strictEqual(embed.imageType, 'image');
  assert.strictEqual(embed.thumbnail, null);

  const params = new URL(embed.toString()).searchParams;
  // Cả hai dùng chung tham số `image`; `image_type` quyết định ô hiển thị.
  assert.strictEqual(params.get('image'), 'https://kalix.vn/big.png');
  assert.strictEqual(params.get('image_type'), 'image');
});

test('WebEmbed tu choi mo ta qua 350 ky tu', () => {
  assert.throws(() => new WebEmbed().setDescription('a'.repeat(351)), /350/);
});

test('baseURL doi duoc de tu host', () => {
  const embed = new WebEmbed({ baseURL: 'https://embed.kalix.vn/e' }).setTitle('x');
  assert.ok(embed.toString().startsWith('https://embed.kalix.vn/e?'));
});

test('hiddenEmbed la chuoi spoiler de an link', () => {
  assert.strictEqual(typeof WebEmbed.hiddenEmbed, 'string');
  assert.ok(WebEmbed.hiddenEmbed.startsWith('||'));
});
