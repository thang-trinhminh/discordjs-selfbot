'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { ActivityType } = require('discord-api-types/v10');
const Client = require('../src/client/Client.js');
const { CustomStatus, RichPresence, SpotifyRPC } = require('../src/structures/RichPresence.js');

test('CustomStatus dung payload gateway voi emoji unicode', () => {
  const status = new CustomStatus().setState('dang ban').setEmoji('🔥');

  assert.deepStrictEqual(status.toJSON(), {
    name: 'Custom Status',
    type: ActivityType.Custom,
    state: 'dang ban',
    emoji: { id: null, name: '🔥', animated: false },
  });
});

test('CustomStatus nhan emoji dang <:name:id>', () => {
  const status = new CustomStatus().setState('x').setEmoji('<a:pepe:123456789012345678>');
  const { emoji } = status.toJSON();

  assert.strictEqual(emoji.id, '123456789012345678');
  assert.strictEqual(emoji.name, 'pepe');
  assert.strictEqual(emoji.animated, true);
});

test('CustomStatus tu choi state qua 128 ky tu', () => {
  assert.throws(() => new CustomStatus().setState('a'.repeat(129)), /128/);
});

test('CustomStatus tu choi khi khong co ca emoji lan state', () => {
  assert.throws(() => new CustomStatus().toJSON(), /at least one of emoji or state/);
});

test('RichPresence dung payload snake_case', () => {
  const presence = new RichPresence()
    .setName('Trò chơi')
    .setApplicationId('123456789012345678')
    .setDetails('Chi tiết')
    .setState('Trạng thái')
    .setAssetsLargeImage('large')
    .setAssetsLargeText('Ảnh lớn')
    .setPlatform('desktop');

  const json = presence.toJSON();
  assert.strictEqual(json.name, 'Trò chơi');
  assert.strictEqual(json.application_id, '123456789012345678');
  assert.strictEqual(json.type, ActivityType.Playing);
  assert.deepStrictEqual(json.assets, { large_image: 'large', large_text: 'Ảnh lớn' });
  assert.strictEqual(json.platform, 'desktop');
});

test('setParty doi size/max thanh mang [size, max]', () => {
  const json = new RichPresence().setName('x').setParty({ id: 'p1', size: 2, max: 5 }).toJSON();
  assert.deepStrictEqual(json.party, { id: 'p1', size: [2, 5] });
});

test('setParty doi hoi ca size lan max la so', () => {
  assert.throws(() => new RichPresence().setParty({ size: 2 }), /must both be numbers/);
});

test('timestamps luu duoi dang mili giay', () => {
  const start = new Date('2024-01-01T00:00:00.000Z');
  const json = new RichPresence()
    .setName('x')
    .setStartTimestamp(start)
    .setEndTimestamp(start.getTime() + 1000)
    .toJSON();

  assert.strictEqual(json.timestamps.start, start.getTime());
  assert.strictEqual(json.timestamps.end, start.getTime() + 1000);
});

test('addButton gom label vao buttons va url vao metadata', () => {
  const json = new RichPresence()
    .setName('x')
    .addButton('Trang chủ', 'https://kalix.vn')
    .addButton('Tài liệu', 'https://docs.kalix.vn')
    .toJSON();

  assert.deepStrictEqual(json.buttons, ['Trang chủ', 'Tài liệu']);
  assert.deepStrictEqual(json.metadata.button_urls, ['https://kalix.vn', 'https://docs.kalix.vn']);
});

test('addButton chan qua 2 nut va url sai', () => {
  const presence = new RichPresence().setName('x').addButton('a', 'https://a.vn').addButton('b', 'https://b.vn');

  assert.throws(() => presence.addButton('c', 'https://c.vn'), /at most 2 buttons/);
  assert.throws(() => new RichPresence().addButton('a', 'khong-phai-url'), /valid url/);
});

test('setButtons thay toan bo nut cu', () => {
  const presence = new RichPresence().setName('x').addButton('cu', 'https://cu.vn');
  const json = presence.setButtons({ label: 'moi', url: 'https://moi.vn' }).toJSON();

  assert.deepStrictEqual(json.buttons, ['moi']);
  assert.deepStrictEqual(json.metadata.button_urls, ['https://moi.vn']);
});

test('field rong bi loai khoi payload', () => {
  const json = new RichPresence().setName('x').toJSON();

  assert.ok(!('assets' in json));
  assert.ok(!('buttons' in json));
  assert.ok(!('secrets' in json));
  assert.ok(!('party' in json));
});

test('SpotifyRPC dung sync_id va metadata album/artist', () => {
  const spotify = new SpotifyRPC().setSongId('track1').setAlbumId('album1').setArtistIds('a1', 'a2');
  const json = spotify.toJSON();

  assert.strictEqual(json.name, 'Spotify');
  assert.strictEqual(json.type, ActivityType.Listening);
  assert.strictEqual(json.sync_id, 'track1');
  assert.strictEqual(json.flags, 48);
  assert.deepStrictEqual(json.metadata, { album_id: 'album1', artist_ids: ['a1', 'a2'] });
});

test('addArtistId noi them chu khong thay the', () => {
  const json = new SpotifyRPC().addArtistId('a1').addArtistId('a2').toJSON();
  assert.deepStrictEqual(json.metadata.artist_ids, ['a1', 'a2']);
});

test('getExternal kiem tra dau vao truoc khi goi API', async () => {
  const client = new Client({});
  client.token = 'tok';
  client.rest.post = async () => [{ url: 'x', external_asset_path: 'mp:external/abc' }];

  await assert.rejects(() => RichPresence.getExternal(client, 'khong-phai-snowflake'), /snowflake/);
  await assert.rejects(
    () => RichPresence.getExternal(client, '123456789012345678', 'a', 'b', 'c'),
    /at most 2 external images/,
  );
  await assert.rejects(() => RichPresence.getExternal(client, '123456789012345678', 'khong-phai-url'), /valid url/);

  const result = await RichPresence.getExternal(client, '123456789012345678', 'https://kalix.vn/a.png');
  assert.strictEqual(result[0].external_asset_path, 'mp:external/abc');

  client.destroy();
});

test('getExternal doi hoi client da dang nhap', async () => {
  const client = new Client({});
  await assert.rejects(() => RichPresence.getExternal(client, '123456789012345678'), /logged in/);
  client.destroy();
});

test('ClientPresence._parse day nguyen payload cua builder', () => {
  const client = new Client({});
  const status = new CustomStatus().setState('xin chao').setEmoji('🔥');

  const packet = client.presence._parse({ activities: [status] });

  assert.strictEqual(packet.activities.length, 1);
  // Đây là điểm upstream chặn: emoji bị vứt bỏ.
  assert.deepStrictEqual(packet.activities[0].emoji, { id: null, name: '🔥', animated: false });

  client.destroy();
});

test('ClientPresence._parse van xu ly object thuong nhu cu', () => {
  const client = new Client({});

  const packet = client.presence._parse({ activities: [{ name: 'Đang chơi', type: ActivityType.Playing }] });
  assert.deepStrictEqual(packet.activities[0], {
    type: ActivityType.Playing,
    name: 'Đang chơi',
    state: undefined,
    url: undefined,
  });

  // Object thường vẫn phải có name kiểu string.
  assert.throws(() => client.presence._parse({ activities: [{ type: ActivityType.Playing }] }), /name/);

  client.destroy();
});

test('ClientPresence._parse giu emoji cua object thuong', () => {
  const client = new Client({});
  const packet = client.presence._parse({
    activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: 'x', emoji: { name: '🔥' } }],
  });

  assert.deepStrictEqual(packet.activities[0].emoji, { name: '🔥' });
  client.destroy();
});

test('setCustomStatus nhan instance CustomStatus', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push(options.body);
    return {};
  };

  await client.settings.setCustomStatus(new CustomStatus().setState('ban').setEmoji('🔥'));

  assert.strictEqual(calls[0].custom_status.text, 'ban');
  assert.strictEqual(calls[0].custom_status.emoji_name, '🔥');
  assert.strictEqual(calls[0].custom_status.emoji_id, null);

  client.destroy();
});
