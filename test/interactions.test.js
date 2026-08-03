'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { setImmediate } = require('node:timers');
const { ApplicationCommandOptionType, ComponentType, InteractionType } = require('discord-api-types/v10');
const Client = require('../src/client/Client.js');
const {
  awaitInteractionResponse,
  buildCommandInteraction,
  buildComponentInteraction,
  buildModalSubmit,
  createNonce,
  resolveMessageComponent,
} = require('../src/util/InteractionSender.js');

const GLOBAL_COMMAND = { id: 'cmd1', version: 'v1', name: 'ping', type: 1 };
const GUILD_COMMAND = { ...GLOBAL_COMMAND, id: 'cmd2', guild_id: 'g1' };

test('createNonce sinh snowflake khac nhau', () => {
  const first = createNonce();
  assert.strictEqual(typeof first, 'string');
  assert.notStrictEqual(first, createNonce());
});

test('body application command dung shape API', () => {
  const body = buildCommandInteraction({
    applicationId: 'app1',
    nonce: 'n1',
    guildId: 'g1',
    channelId: 'c1',
    sessionId: 's1',
    command: GLOBAL_COMMAND,
  });

  assert.strictEqual(body.type, InteractionType.ApplicationCommand);
  assert.strictEqual(body.application_id, 'app1');
  assert.strictEqual(body.session_id, 's1');
  assert.strictEqual(body.data.id, 'cmd1');
  assert.strictEqual(body.data.version, 'v1');
  assert.deepStrictEqual(body.data.options, []);
  // Lệnh toàn cục không được kèm guild_id trong data.
  assert.ok(!('guild_id' in body.data));
});

test('lenh rieng cua guild kem guild_id trong data', () => {
  const body = buildCommandInteraction({
    applicationId: 'app1',
    nonce: 'n1',
    guildId: 'g1',
    channelId: 'c1',
    command: GUILD_COMMAND,
  });
  assert.strictEqual(body.data.guild_id, 'g1');
});

test('name_default duoc uu tien hon name', () => {
  const body = buildCommandInteraction({
    applicationId: 'app1',
    nonce: 'n1',
    channelId: 'c1',
    command: { ...GLOBAL_COMMAND, name: 'ping-vi', name_default: 'ping' },
  });
  assert.strictEqual(body.data.name, 'ping');
});

test('body autocomplete dung type khac', () => {
  const body = buildCommandInteraction({
    applicationId: 'app1',
    nonce: 'n1',
    channelId: 'c1',
    command: GLOBAL_COMMAND,
    isAutocomplete: true,
  });
  assert.strictEqual(body.type, InteractionType.ApplicationCommandAutocomplete);
});

test('body component chi kem values khi co', () => {
  const base = {
    applicationId: 'app1',
    nonce: 'n1',
    channelId: 'c1',
    messageId: 'm1',
    messageFlags: 0,
    componentType: ComponentType.Button,
    customId: 'nut',
  };

  assert.ok(!('values' in buildComponentInteraction(base).data));
  const withValues = buildComponentInteraction({ ...base, values: ['a'] });
  assert.deepStrictEqual(withValues.data.values, ['a']);
  assert.strictEqual(withValues.type, InteractionType.MessageComponent);
});

test('body modal submit dung shape API', () => {
  const body = buildModalSubmit({
    applicationId: 'app1',
    nonce: 'n1',
    channelId: 'c1',
    customId: 'form',
    components: [{ type: 1, components: [] }],
  });

  assert.strictEqual(body.type, InteractionType.ModalSubmit);
  assert.strictEqual(body.data.custom_id, 'form');
});

test('awaitInteractionResponse chi nhan dung nonce', async () => {
  const client = new Client({});
  const waiting = awaitInteractionResponse(client, 'n1', 1000);

  client.emit('messageCreate', { nonce: 'khac' });
  client.emit('messageCreate', { nonce: 'n1', content: 'xong' });

  assert.strictEqual((await waiting).content, 'xong');
  client.destroy();
});

test('awaitInteractionResponse nhan ca modal', async () => {
  const client = new Client({});
  const waiting = awaitInteractionResponse(client, 'n2', 1000);

  client.emit('interactionModalCreate', { nonce: 'n2', title: 'Form' });
  assert.strictEqual((await waiting).title, 'Form');

  client.destroy();
});

test('awaitInteractionResponse het gio thi reject va go listener', async () => {
  const client = new Client({});
  await assert.rejects(() => awaitInteractionResponse(client, 'n3', 20), /did not get a response/);

  // Không được rò listener sau khi hết giờ.
  assert.strictEqual(client.listenerCount('messageCreate'), 0);
  assert.strictEqual(client.listenerCount('interactionModalCreate'), 0);

  client.destroy();
});

function makeMessage() {
  return {
    id: 'm1',
    components: [
      {
        components: [
          { type: ComponentType.Button, customId: 'nut-a', disabled: false },
          { type: ComponentType.Button, customId: 'nut-b', disabled: true },
        ],
      },
      {
        components: [
          {
            type: ComponentType.StringSelect,
            customId: 'menu',
            disabled: false,
            minValues: 1,
            maxValues: 2,
            options: [
              { label: 'Mot', value: '1' },
              { label: 'Hai', value: '2' },
            ],
          },
        ],
      },
    ],
  };
}

test('resolveMessageComponent tim theo customId va theo chi so', () => {
  const message = makeMessage();

  assert.strictEqual(resolveMessageComponent(message, 'nut-b', [ComponentType.Button]).customId, 'nut-b');
  // Chỉ số đếm trong phạm vi các component cùng loại, không tính hàng.
  assert.strictEqual(resolveMessageComponent(message, 1, [ComponentType.Button]).customId, 'nut-b');
  assert.strictEqual(resolveMessageComponent(message, 'khong-co', [ComponentType.Button]), null);
});

function makeClientWithMessage() {
  const client = new Client({});
  const { Message } = require('../src/structures/Message.js');
  const message = Object.create(Message.prototype);

  Object.assign(message, makeMessage(), {
    client,
    channelId: 'c1',
    guildId: 'g1',
    applicationId: 'app1',
    author: { id: 'bot1' },
    flags: { bitfield: 64 },
  });

  const posted = [];
  client.rest.post = async (route, options) => {
    posted.push([route, options.body]);
    // Trả lời ngay để `sendInteraction` không phải chờ hết giờ.
    setImmediate(() => client.emit('messageCreate', { nonce: options.body.nonce, content: 'ok' }));
  };

  return { client, message, posted };
}

test('clickButton gui dung payload', async () => {
  const { client, message, posted } = makeClientWithMessage();

  const response = await message.clickButton('nut-a');

  assert.strictEqual(response.content, 'ok');
  const [route, body] = posted[0];
  assert.strictEqual(route, '/interactions');
  assert.strictEqual(body.data.component_type, ComponentType.Button);
  assert.strictEqual(body.data.custom_id, 'nut-a');
  assert.strictEqual(body.message_id, 'm1');
  assert.strictEqual(body.message_flags, 64);

  client.destroy();
});

test('clickButton tu choi nut bi vo hieu hoa', async () => {
  const { client, message } = makeClientWithMessage();
  await assert.rejects(() => message.clickButton('nut-b'), /disabled/);
  client.destroy();
});

test('clickButton bao loi khi khong tim thay nut', async () => {
  const { client, message } = makeClientWithMessage();
  await assert.rejects(() => message.clickButton('khong-co'), /not found/);
  client.destroy();
});

test('selectMenu doi label thanh value', async () => {
  const { client, message, posted } = makeClientWithMessage();

  await message.selectMenu('menu', ['Hai']);
  assert.deepStrictEqual(posted[0][1].data.values, ['2']);

  client.destroy();
});

test('selectMenu ton trong minValues va maxValues', async () => {
  const { client, message } = makeClientWithMessage();

  await assert.rejects(() => message.selectMenu('menu', []), /at least 1/);
  await assert.rejects(() => message.selectMenu('menu', ['1', '2', '1']), /at most 2/);

  client.destroy();
});

test('selectMenu bao loi khi gia tri khong co trong menu', async () => {
  const { client, message } = makeClientWithMessage();
  await assert.rejects(() => message.selectMenu('menu', ['Ba']), /not found on select menu/);
  client.destroy();
});

function makeChannel(searchResult) {
  const client = new Client({});
  const TextChannel = require('../src/structures/TextChannel.js');
  const channel = Object.create(TextChannel.prototype);
  Object.assign(channel, { client, id: 'c1', guild: { id: 'g1' } });

  client.rest.get = async () => searchResult;
  const posted = [];
  client.rest.post = async (route, options) => {
    posted.push(options.body);
    setImmediate(() => client.emit('messageCreate', { nonce: options.body.nonce, content: 'pong' }));
  };

  return { client, channel, posted };
}

const SEARCH_RESULT = {
  applications: [{ id: 'app1', bot_id: 'bot1' }],
  application_commands: [
    {
      id: 'cmd1',
      application_id: 'app1',
      version: 'v1',
      name: 'ping',
      type: 1,
      options: [{ type: ApplicationCommandOptionType.String, name: 'text', required: true }],
    },
  ],
};

test('sendSlash dung lenh tim duoc va dung option', async () => {
  const { client, channel, posted } = makeChannel(SEARCH_RESULT);

  const response = await channel.sendSlash('bot1', 'ping', 'xin chao');

  assert.strictEqual(response.content, 'pong');
  assert.strictEqual(posted[0].data.name, 'ping');
  assert.deepStrictEqual(posted[0].data.options, [
    { type: ApplicationCommandOptionType.String, name: 'text', value: 'xin chao' },
  ]);

  client.destroy();
});

test('sendSlash bao loi khi thieu option bat buoc', async () => {
  const { client, channel } = makeChannel(SEARCH_RESULT);
  await assert.rejects(() => channel.sendSlash('bot1', 'ping'), /needs at least 1 option/);
  client.destroy();
});

test('sendSlash bao loi khi bot khong co lenh trong kenh', async () => {
  const { client, channel } = makeChannel({ applications: [], application_commands: [] });
  await assert.rejects(() => channel.sendSlash('bot-la', 'ping', 'x'), /has no commands/);
  client.destroy();
});

test('sendSlash long option vao subcommand va subcommand group', async () => {
  const nested = {
    applications: [{ id: 'app1', bot_id: 'bot1' }],
    application_commands: [
      {
        id: 'cmd1',
        application_id: 'app1',
        version: 'v1',
        name: 'role',
        type: 1,
        options: [
          {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'add',
            options: [
              {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'user',
                options: [{ type: ApplicationCommandOptionType.String, name: 'target', required: true }],
              },
            ],
          },
        ],
      },
    ],
  };
  const { client, channel, posted } = makeChannel(nested);

  await channel.sendSlash('bot1', 'role add user', 'ai-do');

  assert.deepStrictEqual(posted[0].data.options, [
    {
      type: ApplicationCommandOptionType.SubcommandGroup,
      name: 'add',
      options: [
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: 'user',
          options: [{ type: ApplicationCommandOptionType.String, name: 'target', value: 'ai-do' }],
        },
      ],
    },
  ]);

  client.destroy();
});

test('sendSlash tu choi duong dan lenh qua sau', async () => {
  const { client, channel } = makeChannel(SEARCH_RESULT);
  await assert.rejects(() => channel.sendSlash('bot1', 'a b c d'), /at most/);
  client.destroy();
});

test('sendSlash bao ro option attachment chua ho tro', async () => {
  const withAttachment = {
    applications: [{ id: 'app1', bot_id: 'bot1' }],
    application_commands: [
      {
        id: 'cmd1',
        application_id: 'app1',
        version: 'v1',
        name: 'upload',
        type: 1,
        options: [{ type: ApplicationCommandOptionType.Attachment, name: 'file', required: true }],
      },
    ],
  };
  const { client, channel } = makeChannel(withAttachment);

  await assert.rejects(() => channel.sendSlash('bot1', 'upload', 'x'), /attachment option, which is not supported/);
  client.destroy();
});
