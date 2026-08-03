'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');
const Session = require('../src/structures/Session.js');

const SESSION_PAYLOAD = {
  id_hash: 'hash-a',
  approx_last_used_time: '2024-03-01T10:00:00.000Z',
  client_info: { location: 'Hanoi, Vietnam', platform: 'desktop', os: 'Windows' },
};

test('Session doc dung field snake_case', () => {
  const client = new Client({});
  const session = new Session(client, SESSION_PAYLOAD);

  assert.strictEqual(session.id, 'hash-a');
  assert.strictEqual(session.clientInfo.os, 'Windows');
  assert.strictEqual(session.lastUsedAt.toISOString(), '2024-03-01T10:00:00.000Z');
  assert.strictEqual(session.lastUsedTimestamp, Date.parse('2024-03-01T10:00:00.000Z'));

  client.destroy();
});

test('alias createdAt cua v13 tro ve cung gia tri lastUsedAt', () => {
  const client = new Client({});
  const session = new Session(client, SESSION_PAYLOAD);

  assert.strictEqual(session.createdAt.getTime(), session.lastUsedAt.getTime());
  assert.strictEqual(session.createdTimestamp, session.lastUsedTimestamp);

  client.destroy();
});

test('Session#logout goi dung route voi hash cua chinh no', async () => {
  const client = new Client({});
  const session = new Session(client, SESSION_PAYLOAD);
  const calls = [];
  client.rest.post = async (...args) => calls.push(args);

  await session.logout();
  assert.deepStrictEqual(calls, [['/auth/sessions/logout', { body: { session_id_hashes: ['hash-a'] } }]]);

  client.destroy();
});

test('SessionManager#fetch cache theo id_hash chu khong phai id', async () => {
  const client = new Client({});
  client.rest.get = async () => ({ user_sessions: [SESSION_PAYLOAD, { ...SESSION_PAYLOAD, id_hash: 'hash-b' }] });

  const cache = await client.sessions.fetch();
  assert.deepStrictEqual([...cache.keys()], ['hash-a', 'hash-b']);
  assert.ok(cache.get('hash-a') instanceof Session);

  client.destroy();
});

test('currentSession null truoc fetch, co gia tri sau fetch', async () => {
  const client = new Client({});
  client.rest.get = async () => ({ user_sessions: [SESSION_PAYLOAD] });

  assert.strictEqual(client.sessions.currentSession, null);

  client.sessions.currentSessionIdHash = 'hash-a';
  // Van null vi cache chua co du lieu.
  assert.strictEqual(client.sessions.currentSession, null);

  await client.sessions.fetch();
  assert.strictEqual(client.sessions.currentSession.id, 'hash-a');

  client.destroy();
});

test('logoutAllDevices gui moi hash trong cache', async () => {
  const client = new Client({});
  client.rest.get = async () => ({ user_sessions: [SESSION_PAYLOAD, { ...SESSION_PAYLOAD, id_hash: 'hash-b' }] });
  const calls = [];
  client.rest.post = async (...args) => calls.push(args);

  await client.sessions.fetch();
  await client.sessions.logoutAllDevices();

  assert.deepStrictEqual(calls, [['/auth/sessions/logout', { body: { session_id_hashes: ['hash-a', 'hash-b'] } }]]);

  client.destroy();
});

test('UserNoteManager#_reload chiu duoc undefined', () => {
  const client = new Client({});
  client.notes._reload({ 1: 'ghi chu' });
  assert.strictEqual(client.notes.cache.get('1'), 'ghi chu');

  client.notes._reload(undefined);
  assert.strictEqual(client.notes.cache.size, 0);

  client.destroy();
});

test('updateNote dat va xoa note', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.put = async (...args) => calls.push(args);

  await client.notes.updateNote('1', 'xin chao');
  assert.strictEqual(client.notes.cache.get('1'), 'xin chao');

  await client.notes.updateNote('1', null);
  assert.strictEqual(client.notes.cache.has('1'), false);

  assert.deepStrictEqual(calls, [
    ['/users/@me/notes/1', { body: { note: 'xin chao' } }],
    ['/users/@me/notes/1', { body: { note: null } }],
  ]);

  client.destroy();
});

test('notes.fetch tra chuoi rong khi API 404', async () => {
  const client = new Client({});
  client.rest.get = async () => {
    throw new Error('404');
  };

  assert.strictEqual(await client.notes.fetch('1'), '');
  assert.strictEqual(client.notes.cache.has('1'), false);

  client.destroy();
});

test('notes.fetch dung cache tru khi force', async () => {
  const client = new Client({});
  client.notes.cache.set('1', 'cu');
  let hits = 0;
  client.rest.get = async () => {
    hits += 1;
    return { note: 'moi' };
  };

  assert.strictEqual(await client.notes.fetch('1'), 'cu');
  assert.strictEqual(hits, 0);

  assert.strictEqual(await client.notes.fetch('1', { force: true }), 'moi');
  assert.strictEqual(hits, 1);
  assert.strictEqual(client.notes.cache.get('1'), 'moi');

  client.destroy();
});

test('handler USER_NOTE_UPDATE emit old/new va xoa khi note rong', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/USER_NOTE_UPDATE.js');
  const emitted = [];
  client.on('userNoteUpdate', (...args) => emitted.push(args));

  handler(client, { d: { id: '1', note: 'a' } });
  handler(client, { d: { id: '1', note: '' } });

  assert.deepStrictEqual(emitted, [
    ['1', null, 'a'],
    ['1', 'a', null],
  ]);
  assert.strictEqual(client.notes.cache.has('1'), false);

  client.destroy();
});

test('READY nap notes va session hash', () => {
  const client = new Client({});
  const ready = require('../src/client/websocket/handlers/READY.js');

  ready(
    client,
    {
      d: {
        user: { id: '10', username: 'me', discriminator: '0', global_name: 'me' },
        guilds: [],
        notes: { 5: 'ban cu' },
        auth_session_id_hash: 'hash-a',
      },
    },
    { id: 0, checkReady() {} },
  );

  assert.strictEqual(client.notes.cache.get('5'), 'ban cu');
  assert.strictEqual(client.sessions.currentSessionIdHash, 'hash-a');

  client.destroy();
});

test('READY chiu duoc user_guild_settings ca dang object lan dang mang', () => {
  const ready = require('../src/client/websocket/handlers/READY.js');
  const base = {
    user: { id: '10', username: 'me', discriminator: '0', global_name: 'me' },
    guilds: [],
    notes: {},
  };

  const entries = [{ guild_id: '1', muted: true }];

  // Dang that Discord tra ve hom nay la object bao ngoai, khong iterable. Dang mang
  // tran van phai chay: mang cung co `.entries` nen nhanh nay de bi nuot nham.
  for (const [userGuildSettings, patched] of [
    [{ version: 1, partial: false, entries }, true],
    [entries, true],
    [undefined, false],
  ]) {
    const client = new Client({});
    const { Guild } = require('../src/structures/Guild.js');
    client.guilds.cache.set('1', new Guild(client, { id: '1', unavailable: false }));

    const label = JSON.stringify(userGuildSettings ?? null);
    assert.doesNotThrow(
      () => ready(client, { d: { ...base, user_guild_settings: userGuildSettings } }, { id: 0, checkReady() {} }),
      label,
    );
    assert.strictEqual(client.guilds.cache.get('1').settings.muted, patched ? true : undefined, label);

    client.destroy();
  }
});
