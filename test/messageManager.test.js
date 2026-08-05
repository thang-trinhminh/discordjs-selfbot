'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { ChannelType } = require('discord-api-types/v10');
const Client = require('../src/client/Client.js');
const GroupDMChannel = require('../src/structures/GroupDMChannel.js');

const CHANNEL = {
  id: '900',
  type: ChannelType.GroupDM,
  name: 'Nhom cua toi',
  owner_id: '1',
  recipients: [{ id: '1', username: 'an', discriminator: '0', global_name: 'An' }],
};

const message = (id, content = 'xin chao') => ({
  id,
  channel_id: CHANNEL.id,
  content,
  author: { id: '1', username: 'an', discriminator: '0', global_name: 'An' },
  timestamp: new Date().toISOString(),
  edited_timestamp: null,
  tts: false,
  mention_everyone: false,
  mentions: [],
  mention_roles: [],
  attachments: [],
  embeds: [],
  type: 0,
  pinned: false,
});

function makeChannel() {
  const client = new Client({});
  const channel = new GroupDMChannel(client, CHANNEL);
  client.channels.cache.set(channel.id, channel);
  return { client, channel };
}

test('fetch mot tin di qua route liet ke, khong phai route bot-only', async () => {
  const { client, channel } = makeChannel();
  const calls = [];
  client.rest.get = async (route, options) => {
    calls.push([route, options?.query?.toString()]);
    return [message('5'), message('7')];
  };

  const fetched = await channel.messages.fetch({ message: '7', force: true });

  assert.strictEqual(fetched.id, '7');
  // GET /channels/900/messages/7 la bot-only: token nguoi dung an 403 code 20002.
  assert.deepStrictEqual(calls, [['/channels/900/messages', 'around=7&limit=1']]);

  client.destroy();
});

test('fetch tin khong ton tai van nem 10008 nhu route bot-only', async () => {
  const { client, channel } = makeChannel();
  client.rest.get = async () => [message('5')];

  await assert.rejects(channel.messages.fetch({ message: '7', force: true }), error => {
    assert.strictEqual(error.code, 10008);
    assert.strictEqual(error.status, 404);
    return true;
  });

  client.destroy();
});

test('fetch doc cache truoc, khong goi API khi khong force', async () => {
  const { client, channel } = makeChannel();
  let called = 0;
  client.rest.get = async () => {
    called += 1;
    return [message('7')];
  };

  await channel.messages.fetch({ message: '7', force: true });
  await channel.messages.fetch({ message: '7' });

  assert.strictEqual(called, 1);

  client.destroy();
});
