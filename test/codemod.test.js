'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

let transform;
test('nap codemod', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  assert.strictEqual(typeof transform, 'function');
});

test('doi so sanh literal thanh tham chieu enum', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  const result = transform(`if (channel.type === 'GUILD_TEXT') return;\n`);

  assert.ok(result.code.includes('channel.type === ChannelType.GuildText'));
  assert.ok(result.code.includes("require('discord-api-types/v10')"));
  assert.strictEqual(result.changes[0].to, 'ChannelType.GuildText');
});

test('ap dung bang doi ten cho member bi doi han', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  const result = transform(`if (c.type !== 'GUILD_NEWS') return;\n`);
  assert.ok(result.code.includes('ChannelType.GuildAnnouncement'), result.code);
});

test('bao cho mo ho thay vi doan', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  // 'NONE' có ở nhiều enum, không được tự chọn.
  const result = transform(`if (guild.verificationLevel === 'NONE') return;\n`);

  assert.ok(result.ambiguous.length > 0, 'phai bao mo ho');
  assert.ok(result.code.includes("'NONE'"), 'khong duoc sua khi mo ho');
  assert.ok(result.ambiguous[0].candidates.length > 1);
});

test('doi dinh danh ma compat co tinh khong alias', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  const result = transform(`const { TextInputComponent, SelectMenuInteraction } = require('discordjs-selfbot');\n`);

  assert.ok(result.code.includes('TextInputBuilder'));
  assert.ok(result.code.includes('StringSelectMenuInteraction'));
  assert.ok(!result.code.includes('TextInputComponent'));
});

test('chen import dung kieu module cua file', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));

  const esm = transform(`import x from 'y';\nif (c.type === 'GUILD_TEXT') x();\n`);
  assert.ok(esm.code.includes("import { ChannelType } from 'discord-api-types/v10';"), esm.code);

  const cjs = transform(`const x = require('y');\nif (c.type === 'GUILD_TEXT') x();\n`);
  assert.ok(cjs.code.includes("const { ChannelType } = require('discord-api-types/v10');"), cjs.code);
});

test('chen import sau khoi require dau file chu khong phai dong dau', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  const result = transform(
    `'use strict';\n\nconst a = require('a');\nconst b = require('b');\n\nif (c.type === 'GUILD_TEXT') a();\n`,
  );

  const lines = result.code.split('\n');
  const importIndex = lines.findIndex(line => line.includes('discord-api-types'));
  const lastRequire = lines.findLastIndex(line => line.includes("require('b')"));
  assert.ok(importIndex > lastRequire, 'import phai nam sau khoi require');
});

test('khong sua file khong co gi de sua', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  const source = `const x = 1;\nif (a.type === ChannelType.GuildText) x();\n`;
  const result = transform(source);

  assert.strictEqual(result.changed, false);
  assert.strictEqual(result.code, source);
});

test('khong dung vao chuoi hoa khong phai enum', async () => {
  ({ transform } = await import('../scripts/codemod-v13-to-v14.mjs'));
  const source = `if (res.status === 'INTERNAL_SERVER_ERROR') fail();\n`;
  const result = transform(source);

  assert.strictEqual(result.changed, false);
});
