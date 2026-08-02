'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { GatewayOpcodes } = require('discord-api-types/v10');
const { patchShardSend } = require('../src/client/websocket/SelfbotShardingStrategy.js');
const Options = require('../src/util/Options.js');

function makeFakeShard() {
  const sent = [];
  return {
    sent,
    async send(payload) {
      sent.push(payload);
    },
  };
}

test('payload identify bi viet lai: bo intents va shard', async () => {
  const shard = makeFakeShard();
  const options = Options.createDefault();
  patchShardSend(shard, options, () => 'my-token');

  await shard.send({
    op: GatewayOpcodes.Identify,
    d: { token: 'wrong', intents: 3276799, shard: [0, 1], properties: {}, compress: false },
  });

  assert.strictEqual(shard.sent.length, 1);
  const { d } = shard.sent[0];
  assert.ok(!('intents' in d));
  assert.ok(!('shard' in d));
  assert.strictEqual(d.token, 'my-token');
  assert.strictEqual(d.capabilities, options.ws.capabilities);
  assert.strictEqual(d.properties.browser, 'Chrome');
});

test('presence duoc chuyen tiep tu payload goc', async () => {
  const shard = makeFakeShard();
  patchShardSend(shard, Options.createDefault(), () => 'tok');

  await shard.send({
    op: GatewayOpcodes.Identify,
    d: { token: 'x', presence: { status: 'dnd', activities: [] } },
  });

  assert.deepStrictEqual(shard.sent[0].d.presence, { status: 'dnd', activities: [] });
});

test('payload khac Identify di qua nguyen ven', async () => {
  const shard = makeFakeShard();
  patchShardSend(shard, Options.createDefault(), () => 'tok');

  const heartbeat = { op: GatewayOpcodes.Heartbeat, d: 42 };
  await shard.send(heartbeat);

  assert.deepStrictEqual(shard.sent[0], heartbeat);
});

test('strategy giu duoc field shards cua upstream', () => {
  const { SimpleShardingStrategy } = require('@discordjs/ws');
  const proto = SimpleShardingStrategy.prototype;
  assert.strictEqual(typeof proto.spawn, 'function', 'upstream doi ten spawn');
  assert.strictEqual(typeof proto.connect, 'function', 'upstream doi ten connect');

  // Duck-type chứ không `instanceof Collection`: node_modules có hai bản
  // @discordjs/collection (1.5.3 top-level cho discord.js, 2.1.1 lồng trong
  // ws/rest) nên `instanceof` giữa hai copy luôn false.
  const strategy = new SimpleShardingStrategy({ options: {} });
  assert.ok(strategy.shards, 'upstream doi ten field shards');
  assert.strictEqual(typeof strategy.shards.values, 'function', 'shards phai iterate duoc');
  assert.strictEqual(strategy.shards.constructor.name, 'Collection');
});

test('Client cam SelfbotShardingStrategy vao ws.buildStrategy', () => {
  const Client = require('../src/client/Client.js');
  const { SelfbotShardingStrategy } = require('../src/client/websocket/SelfbotShardingStrategy.js');
  const client = new Client({});
  assert.strictEqual(typeof client.options.ws.buildStrategy, 'function');
  const strategy = client.options.ws.buildStrategy({ options: {} });
  assert.ok(strategy instanceof SelfbotShardingStrategy);
  client.destroy();
});
