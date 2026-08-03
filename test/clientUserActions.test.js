'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');
const ClientUser = require('../src/structures/ClientUser.js');
const { HypeSquadHouse } = require('../src/util/UserEnums.js');

function makeClient() {
  const client = new Client({});
  client.user = new ClientUser(client, { id: '10', username: 'me', discriminator: '0', global_name: 'Me' });
  client.users.cache.set('10', client.user);
  return client;
}

// Giá trị giả, cố tình đặt trong ngoặc nhọn để không máy quét nào nhầm là
// credential thật.
function captureEdit(client) {
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push([route, options.body]);
    return { id: '10', username: 'me', discriminator: '0', global_name: 'Me' };
  };
  return calls;
}

test('edit giu lai field rieng cua tai khoan nguoi dung', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.edit({
    username: 'ten-moi',
    password: '<mat-khau-gia-cho-test>',
    bio: 'gioi thieu',
    pronouns: 'they/them',
  });

  // Upstream destructure đúng { username, avatar, banner } nên password, bio,
  // pronouns bị vứt im lặng.
  assert.deepStrictEqual(calls[0][1], {
    username: 'ten-moi',
    password: '<mat-khau-gia-cho-test>',
    bio: 'gioi thieu',
    pronouns: 'they/them',
  });

  client.destroy();
});

test('edit khong gui avatar/banner khi khong duoc truyen', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.edit({ bio: 'x' });

  assert.ok(!('avatar' in calls[0][1]));
  assert.ok(!('banner' in calls[0][1]));

  client.destroy();
});

test('setUsername gui kem password', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.setUsername('ten-moi', '<mat-khau-gia-cho-test>');
  assert.deepStrictEqual(calls[0], ['/users/@me', { username: 'ten-moi', password: '<mat-khau-gia-cho-test>' }]);

  client.destroy();
});

test('setGlobalName va setPronouns mac dinh la chuoi rong', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.setGlobalName();
  await client.user.setPronouns();

  assert.deepStrictEqual(calls[0][1], { global_name: '' });
  assert.deepStrictEqual(calls[1][1], { pronouns: '' });

  client.destroy();
});

test('setGlobalName doi camelCase sang snake_case', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.setGlobalName('Ten hien thi');
  assert.deepStrictEqual(calls[0][1], { global_name: 'Ten hien thi' });

  client.destroy();
});

test('setAccentColor resolve mau va chap nhan null', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.setAccentColor('#FF0000');
  await client.user.setAccentColor(null);

  assert.deepStrictEqual(calls[0][1], { accent_color: 0xff0000 });
  assert.deepStrictEqual(calls[1][1], { accent_color: null });

  client.destroy();
});

test('setAboutMe gui field bio', async () => {
  const client = makeClient();
  const calls = captureEdit(client);

  await client.user.setAboutMe('xin chao');
  assert.deepStrictEqual(calls[0][1], { bio: 'xin chao' });

  client.destroy();
});

test('setHypeSquad POST khi vao nha, DELETE khi roi', async () => {
  const client = makeClient();
  const posts = [];
  const deletes = [];
  client.rest.post = async (route, options) => posts.push([route, options]);
  client.rest.delete = async route => deletes.push(route);

  await client.user.setHypeSquad(HypeSquadHouse.Bravery);
  await client.user.setHypeSquad(HypeSquadHouse.Leave);

  assert.deepStrictEqual(posts, [['/hypesquad/online', { body: { house_id: 1 } }]]);
  assert.deepStrictEqual(deletes, ['/hypesquad/online']);

  client.destroy();
});

test('setHypeSquad nhan ten nha dang chuoi', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => posts.push(options.body);

  await client.user.setHypeSquad('Balance');
  assert.deepStrictEqual(posts, [{ house_id: 3 }]);

  client.destroy();
});

test('setHypeSquad tu choi nha khong ton tai', async () => {
  const client = makeClient();
  await assert.rejects(() => client.user.setHypeSquad('KhongCo'), /Unknown HypeSquad house/);
  client.destroy();
});

test('friend invite: tao, liet ke, huy', async () => {
  const client = makeClient();
  const posts = [];
  const deletes = [];
  client.rest.post = async (route, options) => {
    posts.push([route, options]);
    return { code: 'abc' };
  };
  client.rest.get = async () => [{ code: 'abc' }, { code: 'def' }];
  client.rest.delete = async route => deletes.push(route);

  const invite = await client.user.createFriendInvite();
  assert.strictEqual(invite.code, 'abc');
  assert.deepStrictEqual(posts, [['/users/@me/invites', { body: {} }]]);

  const all = await client.user.fetchFriendInvites();
  assert.deepStrictEqual([...all.keys()], ['abc', 'def']);

  await client.user.revokeAllFriendInvites();
  assert.deepStrictEqual(deletes, ['/users/@me/invites']);

  client.destroy();
});

test('setSamsungActivity kiem tra package name va action', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => posts.push([route, options.body]);

  await client.user.setSamsungActivity('com.example.game');
  assert.deepStrictEqual(posts[0], ['/presences', { package_name: 'com.example.game', update: 'START' }]);

  await client.user.setSamsungActivity('com.example.game', 'stop');
  assert.strictEqual(posts[1][1].update, 'STOP');

  await assert.rejects(() => client.user.setSamsungActivity(''), /Package name is required/);
  await assert.rejects(() => client.user.setSamsungActivity('com.x', 'PAUSE'), /Action must be one of/);

  client.destroy();
});

test('stopRinging resolve kenh thanh id', async () => {
  const client = makeClient();
  const posts = [];
  client.rest.post = async (route, options) => posts.push([route, options]);

  await client.user.stopRinging('900');
  assert.deepStrictEqual(posts, [['/channels/900/call/stop-ringing', { body: {} }]]);

  client.destroy();
});

test('fetchBurstCredit tra ve so amount', async () => {
  const client = makeClient();
  client.rest.get = async () => ({ amount: 7 });

  assert.strictEqual(await client.user.fetchBurstCredit(), 7);

  client.destroy();
});
