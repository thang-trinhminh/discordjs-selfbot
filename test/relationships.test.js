'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');
const { RelationshipType } = require('../src/util/UserEnums.js');

const READY_RELATIONSHIPS = [
  { id: '1', type: RelationshipType.Friend, nickname: 'Ban', since: '2024-01-01T00:00:00.000Z' },
  { id: '2', type: RelationshipType.Blocked, nickname: null, since: '2024-02-01T00:00:00.000Z' },
  { id: '3', type: RelationshipType.PendingIncoming, nickname: null },
  { id: '4', type: RelationshipType.PendingOutgoing, nickname: null },
];

function makeClient() {
  const client = new Client({});
  client.relationships._setup(READY_RELATIONSHIPS);
  return client;
}

test('_setup nap cache, nickname va since', () => {
  const client = makeClient();
  const { relationships } = client;

  assert.strictEqual(relationships.cache.size, 4);
  assert.strictEqual(relationships.cache.get('1'), RelationshipType.Friend);
  assert.strictEqual(relationships.friendNicknames.get('1'), 'Ban');
  assert.strictEqual(relationships.sinceCache.get('1').toISOString(), '2024-01-01T00:00:00.000Z');
  // Thiếu `since` thì về epoch chứ không phải Invalid Date.
  assert.strictEqual(relationships.sinceCache.get('3').getTime(), 0);

  client.destroy();
});

test('cac getter loc dung tung kieu quan he', () => {
  const client = makeClient();
  const { relationships } = client;

  assert.deepStrictEqual([...relationships.friendCache.keys()], ['1']);
  assert.deepStrictEqual([...relationships.blockedCache.keys()], ['2']);
  assert.deepStrictEqual([...relationships.incomingCache.keys()], ['3']);
  assert.deepStrictEqual([...relationships.outgoingCache.keys()], ['4']);

  client.destroy();
});

test('toJSON tra ve du 4 ban ghi voi nickname null khi khong co', () => {
  const client = makeClient();
  const json = client.relationships.toJSON();

  assert.strictEqual(json.length, 4);
  assert.deepStrictEqual(json[0], {
    id: '1',
    type: RelationshipType.Friend,
    nickname: 'Ban',
    since: '2024-01-01T00:00:00.000Z',
  });
  assert.strictEqual(json[1].nickname, null);

  client.destroy();
});

test('setNickname tu choi user khong phai ban be, khong goi API', async () => {
  const client = makeClient();
  let called = false;
  client.rest.patch = async () => {
    called = true;
  };

  assert.strictEqual(await client.relationships.setNickname('2', 'x'), false);
  assert.strictEqual(called, false);
  assert.strictEqual(client.relationships.friendNicknames.get('2'), null);

  client.destroy();
});

test('setNickname cap nhat cache va goi dung route', async () => {
  const client = makeClient();
  const calls = [];
  client.rest.patch = async (route, options) => calls.push([route, options]);

  assert.strictEqual(await client.relationships.setNickname('1', 'Ten moi'), true);
  assert.deepStrictEqual(calls, [['/users/@me/relationships/1', { body: { nickname: 'Ten moi' } }]]);
  assert.strictEqual(client.relationships.friendNicknames.get('1'), 'Ten moi');

  // Truyền null để xoá nickname.
  await client.relationships.setNickname('1', null);
  assert.strictEqual(client.relationships.friendNicknames.get('1'), null);

  client.destroy();
});

test('fetch xoa cache cu truoc khi nap moi', async () => {
  const client = makeClient();
  client.rest.get = async () => [{ id: '9', type: RelationshipType.Friend, nickname: null }];

  const result = await client.relationships.fetch();
  assert.strictEqual(result, client.relationships);
  assert.deepStrictEqual([...client.relationships.cache.keys()], ['9']);

  client.destroy();
});

test('fetch voi user tra ve kieu quan he cua user do', async () => {
  const client = makeClient();
  client.rest.get = async () => [{ id: '9', type: RelationshipType.Blocked, nickname: null }];

  assert.strictEqual(await client.relationships.fetch('9'), RelationshipType.Blocked);

  client.destroy();
});

test('handler RELATIONSHIP_ADD nap cache va emit', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/RELATIONSHIP_ADD.js');
  const emitted = [];
  client.on('relationshipAdd', (...args) => emitted.push(args));

  handler(client, { d: { id: '7', type: RelationshipType.Friend, nickname: 'A', should_notify: true } });

  assert.strictEqual(client.relationships.cache.get('7'), RelationshipType.Friend);
  assert.deepStrictEqual(emitted, [['7', true]]);

  client.destroy();
});

test('handler RELATIONSHIP_REMOVE emit nickname lay tu cache truoc khi xoa', () => {
  const client = makeClient();
  const handler = require('../src/client/websocket/handlers/RELATIONSHIP_REMOVE.js');
  const emitted = [];
  client.on('relationshipRemove', (...args) => emitted.push(args));

  handler(client, { d: { id: '1', type: RelationshipType.Friend } });

  assert.strictEqual(client.relationships.cache.has('1'), false);
  assert.strictEqual(client.relationships.friendNicknames.has('1'), false);
  // Payload cua Discord khong kem nickname, phai lay tu cache.
  assert.deepStrictEqual(emitted, [['1', RelationshipType.Friend, 'Ban']]);

  client.destroy();
});

test('handler RELATIONSHIP_UPDATE giu field vang mat', () => {
  const client = makeClient();
  const handler = require('../src/client/websocket/handlers/RELATIONSHIP_UPDATE.js');
  const emitted = [];
  client.on('relationshipUpdate', (...args) => emitted.push(args));

  handler(client, { d: { id: '1', nickname: 'Ten khac' } });

  const [userId, oldData, newData] = emitted[0];
  assert.strictEqual(userId, '1');
  assert.strictEqual(oldData.nickname, 'Ban');
  assert.strictEqual(newData.nickname, 'Ten khac');
  // `type` khong co trong payload nen phai giu nguyen.
  assert.strictEqual(newData.type, RelationshipType.Friend);
  assert.strictEqual(newData.since.toISOString(), '2024-01-01T00:00:00.000Z');

  client.destroy();
});

test('handler duoc dang ky trong bang packet handler', () => {
  const handlers = require('../src/client/websocket/handlers/index.js');
  for (const name of ['RELATIONSHIP_ADD', 'RELATIONSHIP_REMOVE', 'RELATIONSHIP_UPDATE']) {
    assert.strictEqual(typeof handlers[name], 'function', `thieu handler ${name}`);
  }
});

test('READY khong crash khi payload thieu application', () => {
  const client = new Client({});
  const ready = require('../src/client/websocket/handlers/READY.js');
  const shard = { id: 0, checkReady() {} };

  ready(
    client,
    {
      d: {
        user: { id: '10', username: 'me', discriminator: '0', global_name: 'me' },
        guilds: [],
        relationships: READY_RELATIONSHIPS,
      },
    },
    shard,
  );

  assert.strictEqual(client.application, null);
  assert.strictEqual(client.relationships.cache.size, 4);

  client.destroy();
});
