'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');

const RAW_SETTINGS = {
  locale: 'vi',
  theme: 'dark',
  message_display_compact: true,
  developer_mode: true,
  afk_timeout: 600,
  explicit_content_filter: 2,
  animate_stickers: 1,
  show_current_game: false,
  restricted_guilds: ['111', '222'],
};

function makeClient() {
  const client = new Client({});
  client.rest.patch = async (route, options) => options.body;
  return client;
}

test('_patch anh xa snake_case sang thuoc tinh camelCase', () => {
  const client = makeClient();
  client.settings._patch(RAW_SETTINGS);
  const { settings } = client;

  assert.strictEqual(settings.locale, 'vi');
  assert.strictEqual(settings.theme, 'dark');
  assert.strictEqual(settings.compactMode, true);
  assert.strictEqual(settings.developerMode, true);
  assert.strictEqual(settings.afkTimeout, 600);
  assert.strictEqual(settings.DMScanLevel, 2);
  assert.strictEqual(settings.stickerAnimationMode, 1);
  assert.strictEqual(settings.activityDisplay, false);

  client.destroy();
});

test('raw gom du lieu qua nhieu lan patch', () => {
  const client = makeClient();
  client.settings._patch({ theme: 'dark' });
  client.settings._patch({ locale: 'vi' });

  assert.deepStrictEqual(client.settings.raw, { theme: 'dark', locale: 'vi' });

  client.destroy();
});

test('restricted_guilds thanh Collection, guild chua cache thi null', () => {
  const client = makeClient();
  client.settings._patch(RAW_SETTINGS);

  assert.deepStrictEqual([...client.settings.disableDMfromGuilds.keys()], ['111', '222']);
  assert.strictEqual(client.settings.disableDMfromGuilds.get('111'), null);

  client.destroy();
});

test('setTheme tu choi gia tri sai', () => {
  const client = makeClient();
  assert.throws(() => client.settings.setTheme('blue'), /dark \| light/);
  client.destroy();
});

test('setTheme goi dung route va body', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push([route, options]);
    return options.body;
  };

  await client.settings.setTheme('light');
  assert.deepStrictEqual(calls, [['/users/@me/settings', { body: { theme: 'light' } }]]);
  assert.strictEqual(client.settings.theme, 'light');

  client.destroy();
});

test('toggleCompactMode dao gia tri hien tai', async () => {
  const client = makeClient();
  client.settings._patch({ message_display_compact: true });

  await client.settings.toggleCompactMode();
  assert.strictEqual(client.settings.compactMode, false);

  await client.settings.toggleCompactMode();
  assert.strictEqual(client.settings.compactMode, true);

  client.destroy();
});

test('setCustomStatus voi gia tri khong phai object thi xoa status', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push(options.body);
    return options.body;
  };

  await client.settings.setCustomStatus(null);
  assert.deepStrictEqual(calls, [{ custom_status: null }]);

  client.destroy();
});

test('setCustomStatus gop status vao cung mot request', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push(options.body);
    return {};
  };

  await client.settings.setCustomStatus({ text: 'ban roi', status: 'dnd' });

  // Bản v13 bắn hai request nối nhau; ở đây phải đúng một.
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].status, 'dnd');
  assert.strictEqual(calls[0].custom_status.text, 'ban roi');

  client.destroy();
});

test('setCustomStatus tu choi text qua 128 ky tu', async () => {
  const client = makeClient();
  await assert.rejects(() => client.settings.setCustomStatus({ text: 'a'.repeat(129) }), /128/);
  client.destroy();
});

test('setCustomStatus tu choi expires trong qua khu', async () => {
  const client = makeClient();
  await assert.rejects(() => client.settings.setCustomStatus({ expires: Date.now() - 1000 }), /future/);
  client.destroy();
});

test('addRestrictedGuild va removeRestrictedGuild dung cache hien tai', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push(options.body);
    return options.body;
  };
  client.settings._patch({ restricted_guilds: ['111'] });

  await client.settings.addRestrictedGuild('222');
  assert.deepStrictEqual(calls[0], { restricted_guilds: ['111', '222'] });

  await client.settings.removeRestrictedGuild('111');
  assert.deepStrictEqual(calls[1], { restricted_guilds: ['222'] });

  client.destroy();
});

test('addRestrictedGuild nem loi khi guild da bi chan', async () => {
  const client = makeClient();
  client.settings._patch({ restricted_guilds: ['111'] });
  assert.throws(() => client.settings.addRestrictedGuild('111'), /already restricted/);
  client.destroy();
});

test('removeRestrictedGuild nem loi khi guild chua bi chan', async () => {
  const client = makeClient();
  client.settings._patch({ restricted_guilds: [] });
  assert.throws(() => client.settings.removeRestrictedGuild('999'), /not restricted/);
  client.destroy();
});

test('restrictedGuilds(true) gui toan bo guild dang cache', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push(options.body);
    return {};
  };
  client.guilds.cache.set('a', { id: 'a' });
  client.guilds.cache.set('b', { id: 'b' });

  await client.settings.restrictedGuilds(true);
  assert.deepStrictEqual(calls[0], { default_guilds_restricted: true, restricted_guilds: ['a', 'b'] });

  await client.settings.restrictedGuilds(false);
  assert.deepStrictEqual(calls[1], { default_guilds_restricted: false, restricted_guilds: [] });

  client.destroy();
});

test('GuildSettingManager anh xa field va mute_config', () => {
  const client = new Client({});
  const guild = { id: '111', client };
  const GuildSettingManager = require('../src/managers/GuildSettingManager.js');
  const settings = new GuildSettingManager(guild);

  settings._patch({
    suppress_everyone: true,
    message_notifications: 1,
    muted: true,
    mute_config: { end_time: '2024-05-01T00:00:00.000Z', selected_time_window: 3600 },
  });

  assert.strictEqual(settings.suppressEveryone, true);
  assert.strictEqual(settings.messageNotifications, 1);
  assert.strictEqual(settings.muted, true);
  assert.strictEqual(settings.muteConfig.endTime.toISOString(), '2024-05-01T00:00:00.000Z');
  assert.strictEqual(settings.muteConfig.selectedTimeWindow, 3600);

  // Mute_config null phải xoá cấu hình cũ.
  settings._patch({ mute_config: null });
  assert.strictEqual(settings.muteConfig, null);

  client.destroy();
});

test('GuildSettingManager#edit goi route guild chu khong phai setting toan cuc', async () => {
  const client = new Client({});
  const calls = [];
  client.rest.patch = async (route, options) => {
    calls.push([route, options]);
    return options.body;
  };
  const GuildSettingManager = require('../src/managers/GuildSettingManager.js');
  const settings = new GuildSettingManager({ id: '111', client });

  await settings.edit({ muted: true });
  assert.deepStrictEqual(calls, [['/users/@me/guilds/111/settings', { body: { muted: true } }]]);

  client.destroy();
});

test('handler USER_SETTINGS_UPDATE va USER_GUILD_SETTINGS_UPDATE', () => {
  const client = new Client({});
  const userHandler = require('../src/client/websocket/handlers/USER_SETTINGS_UPDATE.js');
  const guildHandler = require('../src/client/websocket/handlers/USER_GUILD_SETTINGS_UPDATE.js');

  userHandler(client, { d: { theme: 'light' } });
  assert.strictEqual(client.settings.theme, 'light');

  // Guild chưa cache thì không được ném.
  assert.doesNotThrow(() => guildHandler(client, { d: { guild_id: 'khong-ton-tai', muted: true } }));

  client.destroy();
});

test('READY nap user_settings va user_guild_settings', () => {
  const client = new Client({});
  const ready = require('../src/client/websocket/handlers/READY.js');
  const { Guild } = require('../src/structures/Guild.js');
  const guild = new Guild(client, { id: '111', unavailable: false });
  client.guilds.cache.set('111', guild);

  ready(
    client,
    {
      d: {
        user: { id: '10', username: 'me', discriminator: '0', global_name: 'me' },
        guilds: [],
        user_settings: { theme: 'dark' },
        user_guild_settings: [{ guild_id: '111', muted: true }],
      },
    },
    { id: 0, checkReady() {} },
  );

  assert.strictEqual(client.settings.theme, 'dark');
  assert.strictEqual(guild.settings.muted, true);

  client.destroy();
});
