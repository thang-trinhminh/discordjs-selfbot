'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { ChannelType } = require('discord-api-types/v10');
const Client = require('../src/client/Client.js');
const CallState = require('../src/structures/CallState.js');
const GroupDMChannel = require('../src/structures/GroupDMChannel.js');

const GROUP_DM = {
  id: '900',
  type: ChannelType.GroupDM,
  name: 'Nhom cua toi',
  icon: 'iconhash',
  owner_id: '1',
  last_message_id: '5',
  recipients: [
    { id: '1', username: 'an', discriminator: '0', global_name: 'An' },
    { id: '2', username: 'binh', discriminator: '0', global_name: 'Binh' },
  ],
};

function makeChannel() {
  const client = new Client({});
  const channel = new GroupDMChannel(client, GROUP_DM);
  client.channels.cache.set(channel.id, channel);
  return { client, channel };
}

test('createChannel dung GroupDMChannel chu khong phai ban partial', () => {
  const client = new Client({});
  const { createChannel } = require('../src/util/Channels.js');
  const channel = createChannel(client, GROUP_DM);

  assert.ok(channel instanceof GroupDMChannel);
  client.destroy();
});

test('recipients la Collection<Snowflake, User> chu khong phai mang', () => {
  const { client, channel } = makeChannel();

  assert.strictEqual(typeof channel.recipients.get, 'function');
  assert.deepStrictEqual([...channel.recipients.keys()], ['1', '2']);
  assert.strictEqual(channel.recipients.get('1').username, 'an');

  client.destroy();
});

test('owner lay tu cache sau khi recipients duoc doc', () => {
  const { client, channel } = makeChannel();

  // Đọc recipients một lần để user vào cache.
  assert.strictEqual(channel.recipients.size, 2);
  assert.strictEqual(channel.owner.id, '1');

  client.destroy();
});

test('toString tra ve ten, khong co ten thi ghep username', () => {
  const { client, channel } = makeChannel();
  assert.strictEqual(channel.toString(), 'Nhom cua toi');

  const noName = new GroupDMChannel(client, { ...GROUP_DM, id: '901', name: null });
  assert.strictEqual(noName.toString(), 'an, binh');

  client.destroy();
});

test('send va sendTyping duoc mo lai (upstream chan)', () => {
  const { client, channel } = makeChannel();
  const PartialGroupDMChannel = require('../src/structures/PartialGroupDMChannel.js');

  assert.strictEqual(typeof channel.send, 'function');
  assert.strictEqual(typeof channel.sendTyping, 'function');
  assert.strictEqual(typeof channel.createMessageCollector, 'function');

  // Bản partial của upstream không định nghĩa send: applyToClass bỏ qua
  // hẳn property chứ không tạo hàm ném lỗi.
  const partial = new PartialGroupDMChannel(client, { ...GROUP_DM, id: '902' });
  assert.strictEqual(typeof partial.send, 'undefined');

  client.destroy();
});

test('_update khong chet vi recipients — CHANNEL_UPDATE cua group DM', () => {
  const { client, channel } = makeChannel();

  // Base#_clone chay Object.assign(Object.create(this), this). Dat `recipients`
  // thanh accessor chi-doc ngay tren instance lam phep gan do ném TypeError, tuc
  // la moi CHANNEL_UPDATE cua group DM giet ca client trong handler packet.
  const old = channel._update({ ...GROUP_DM, name: 'Ten moi' });

  assert.strictEqual(channel.name, 'Ten moi');
  assert.strictEqual(old.name, 'Nhom cua toi');
  assert.strictEqual(channel.recipients.size, 2);
  assert.deepStrictEqual(channel.toJSON().recipients, ['1', '2']);

  client.destroy();
});

test('_patch cap nhat name va icon (upstream chi set trong constructor)', () => {
  const { client, channel } = makeChannel();

  channel._patch({ name: 'Ten moi', icon: null });
  assert.strictEqual(channel.name, 'Ten moi');
  assert.strictEqual(channel.icon, null);

  client.destroy();
});

test('setName goi PATCH channel va cap nhat state', async () => {
  const { client, channel } = makeChannel();
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push([route, options]);
    return { ...GROUP_DM, name: options.body.name };
  };

  await channel.setName('Ten khac');
  assert.deepStrictEqual(calls, [['/channels/900', { body: { name: 'Ten khac' } }]]);
  assert.strictEqual(channel.name, 'Ten khac');

  client.destroy();
});

test('setOwner resolve user thanh id', async () => {
  const { client, channel } = makeChannel();
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push(options.body);
    return GROUP_DM;
  };

  await channel.setOwner('2');
  assert.deepStrictEqual(calls, [{ owner: '2' }]);

  client.destroy();
});

test('addUser va removeUser goi route recipients', async () => {
  const { client, channel } = makeChannel();
  const puts = [];
  const deletes = [];
  client.rest.put = async route => puts.push(route);
  client.rest.delete = async route => deletes.push(route);

  await channel.addUser('3');
  await channel.removeUser('3');

  assert.deepStrictEqual(puts, ['/channels/900/recipients/3']);
  assert.deepStrictEqual(deletes, ['/channels/900/recipients/3']);

  client.destroy();
});

test('delete gui query silent khi duoc yeu cau', async () => {
  const { client, channel } = makeChannel();
  const calls = [];
  client.rest.delete = async (route, options) => calls.push([route, options]);

  await channel.delete();
  await channel.delete(true);

  assert.strictEqual(calls[0][1].query, undefined);
  assert.strictEqual(calls[1][1].query.get('silent'), 'true');

  client.destroy();
});

test('ring gui null khi khong chi dinh nguoi nhan', async () => {
  const { client, channel } = makeChannel();
  const calls = [];
  client.rest.post = async (route, options) => calls.push([route, options]);

  await channel.ring();
  await channel.ring(['2']);

  assert.deepStrictEqual(calls, [
    ['/channels/900/call/ring', { body: { recipients: null } }],
    ['/channels/900/call/ring', { body: { recipients: ['2'] } }],
  ]);

  client.destroy();
});

test('CallState doc region va ringing', () => {
  const client = new Client({});
  const call = new CallState(client, { channel_id: '900', region: 'singapore', ringing: ['1', '2'] });

  assert.strictEqual(call.channelId, '900');
  assert.strictEqual(call.region, 'singapore');
  assert.deepStrictEqual([...call.ringing.keys()], ['1', '2']);
  // User chưa cache thì là null chứ không phải undefined.
  assert.strictEqual(call.ringing.get('1'), null);

  client.destroy();
});

test('CallState#setRTCRegion goi route call', async () => {
  const client = new Client({});
  const call = new CallState(client, { channel_id: '900' });
  const calls = [];
  client.rest.patch = async (route, options) => calls.push([route, options]);

  await call.setRTCRegion('japan');
  assert.deepStrictEqual(calls, [['/channels/900/call', { body: { region: 'japan' } }]]);

  client.destroy();
});

test('handler CALL_CREATE emit CallState va day voice state', () => {
  const { client } = makeChannel();
  const handler = require('../src/client/websocket/handlers/CALL_CREATE.js');
  const emitted = [];
  const voiceStates = [];
  client.actions.VoiceStateUpdate.handle = data => voiceStates.push(data);
  client.on('callCreate', call => emitted.push(call));

  handler(client, { d: { channel_id: '900', region: 'singapore', voice_states: [{ user_id: '1' }] } });

  assert.strictEqual(emitted.length, 1);
  assert.strictEqual(emitted[0].region, 'singapore');
  assert.deepStrictEqual(voiceStates, [{ user_id: '1' }]);

  client.destroy();
});

test('handler CALL_CREATE chiu duoc payload thieu voice_states', () => {
  const { client } = makeChannel();
  const handler = require('../src/client/websocket/handlers/CALL_CREATE.js');
  assert.doesNotThrow(() => handler(client, { d: { channel_id: '900' } }));
  client.destroy();
});

test('CHANNEL_RECIPIENT_ADD them thanh vien, khong nhan doi khi lap lai', () => {
  const { client, channel } = makeChannel();
  const handler = require('../src/client/websocket/handlers/CHANNEL_RECIPIENT_ADD.js');
  const Status = require('../src/util/Status.js');
  const emitted = [];
  client.on('channelRecipientAdd', (...args) => emitted.push(args));

  const packet = { d: { channel_id: '900', user: { id: '3', username: 'cuong', discriminator: '0' } } };
  handler(client, packet, { status: Status.Ready });
  handler(client, packet, { status: Status.Ready });

  assert.deepStrictEqual([...channel.recipients.keys()], ['1', '2', '3']);
  assert.strictEqual(emitted.length, 2);

  client.destroy();
});

test('CHANNEL_RECIPIENT_ADD khong emit khi shard chua ready', () => {
  const { client } = makeChannel();
  const handler = require('../src/client/websocket/handlers/CHANNEL_RECIPIENT_ADD.js');
  const Status = require('../src/util/Status.js');
  const emitted = [];
  client.on('channelRecipientAdd', (...args) => emitted.push(args));

  handler(
    client,
    { d: { channel_id: '900', user: { id: '3', username: 'cuong', discriminator: '0' } } },
    { status: Status.Connecting },
  );

  assert.strictEqual(emitted.length, 0);
  client.destroy();
});

test('CHANNEL_RECIPIENT_REMOVE bo thanh vien va emit', () => {
  const { client, channel } = makeChannel();
  const handler = require('../src/client/websocket/handlers/CHANNEL_RECIPIENT_REMOVE.js');
  const emitted = [];
  client.on('channelRecipientRemove', (...args) => emitted.push(args));

  handler(client, { d: { channel_id: '900', user: { id: '2', username: 'binh', discriminator: '0' } } });

  assert.deepStrictEqual([...channel.recipients.keys()], ['1']);
  assert.strictEqual(emitted[0][1].id, '2');

  client.destroy();
});

test('handler recipient bo qua kenh chua cache', () => {
  const { client } = makeChannel();
  const add = require('../src/client/websocket/handlers/CHANNEL_RECIPIENT_ADD.js');
  const remove = require('../src/client/websocket/handlers/CHANNEL_RECIPIENT_REMOVE.js');
  const packet = { d: { channel_id: 'khong-ton-tai', user: { id: '3' } } };

  assert.doesNotThrow(() => add(client, packet, { status: 0 }));
  assert.doesNotThrow(() => remove(client, packet));

  client.destroy();
});

test('handler moi deu duoc dang ky', () => {
  const handlers = require('../src/client/websocket/handlers/index.js');
  for (const name of [
    'CALL_CREATE',
    'CALL_UPDATE',
    'CALL_DELETE',
    'CHANNEL_RECIPIENT_ADD',
    'CHANNEL_RECIPIENT_REMOVE',
  ]) {
    assert.strictEqual(typeof handlers[name], 'function', `thieu handler ${name}`);
  }
});
