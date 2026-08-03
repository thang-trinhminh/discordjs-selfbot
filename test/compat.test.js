'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { ChannelType, GuildVerificationLevel, ActivityType, PermissionFlagsBits } = require('discord-api-types/v10');
const { toScreamingSnake, buildLegacyMap } = require('../src/compat/legacyNames.js');
const djs = require('../src/index.js');

test('toScreamingSnake gop chuoi viet hoa lien tiep thanh mot token', () => {
  assert.strictEqual(toScreamingSnake('GuildText'), 'GUILD_TEXT');
  assert.strictEqual(toScreamingSnake('GuildStageVoice'), 'GUILD_STAGE_VOICE');
  assert.strictEqual(toScreamingSnake('GroupDM'), 'GROUP_DM');
  assert.strictEqual(toScreamingSnake('DM'), 'DM');
  // Không được ra USE_V_A_D.
  assert.strictEqual(toScreamingSnake('UseVAD'), 'USE_VAD');
});

test('buildLegacyMap bo qua khoa dang so cua enum hai chieu', () => {
  const map = buildLegacyMap(ChannelType);
  assert.strictEqual(map.GUILD_TEXT, ChannelType.GuildText);
  assert.ok(!Object.keys(map).some(key => /^\d+$/.test(key)));
});

test('buildLegacyMap ap dung override cho ten bi doi', () => {
  const map = buildLegacyMap(ChannelType, { GUILD_NEWS: 'GuildAnnouncement' });
  assert.strictEqual(map.GUILD_NEWS, ChannelType.GuildAnnouncement);
});

test('alias tro thang toi lop v14, khong phai lop boc', () => {
  assert.strictEqual(djs.MessageEmbed, djs.EmbedBuilder);
  assert.strictEqual(djs.MessageAttachment, djs.AttachmentBuilder);
  assert.strictEqual(djs.MessageActionRow, djs.ActionRowBuilder);
  assert.strictEqual(djs.MessageButton, djs.ButtonBuilder);
  assert.strictEqual(djs.MessageSelectMenu, djs.StringSelectMenuBuilder);
  assert.strictEqual(djs.Modal, djs.ModalBuilder);
  assert.strictEqual(djs.Channel, djs.BaseChannel);
  assert.strictEqual(djs.Permissions, djs.PermissionsBitField);
  assert.strictEqual(djs.Intents, djs.IntentsBitField);
});

test('alias interaction chi lam duoc chieu khong va ten', () => {
  // V13 BaseCommandInteraction = v14 CommandInteraction: alias duoc.
  assert.strictEqual(djs.BaseCommandInteraction, Object.getPrototypeOf(djs.ChatInputCommandInteraction));
  assert.strictEqual(djs.ContextMenuInteraction, djs.ContextMenuCommandInteraction);
});

test('ten ton tai o ca hai phien ban thi giu nghia cua v14', () => {
  const { UNALIASABLE } = require('../src/compat/aliases.js');
  // Cả ba tên này ở v13 và v14 chỉ hai thứ khác nhau, alias đè sẽ phá code v14.
  assert.deepStrictEqual(UNALIASABLE, ['TextInputComponent', 'CommandInteraction', 'SelectMenuInteraction']);

  // V14 CommandInteraction là lớp cha, không phải interaction slash command.
  assert.notStrictEqual(djs.CommandInteraction, djs.ChatInputCommandInteraction);
  assert.strictEqual(djs.CommandInteraction, Object.getPrototypeOf(djs.ChatInputCommandInteraction));
  assert.notStrictEqual(djs.TextInputComponent, djs.TextInputBuilder);
});

test('khong che mat enum cua discord-api-types', () => {
  // Ở v13 những tên này là lớp BitField, ở v14 là enum của API. Alias đè lên sẽ
  // hỏng nhiều hơn cứu, nên phải giữ nguyên enum.
  for (const name of ['MessageFlags', 'UserFlags', 'ActivityFlags', 'ChannelFlags', 'RoleFlags']) {
    assert.strictEqual(typeof djs[name], 'object', `${name} phai la enum, khong phai lop`);
  }
});

test('BitField nhan ten co kieu v13', () => {
  assert.strictEqual(djs.PermissionsBitField.resolve('SEND_MESSAGES'), PermissionFlagsBits.SendMessages);
  assert.strictEqual(djs.PermissionsBitField.resolve('SendMessages'), PermissionFlagsBits.SendMessages);
  assert.strictEqual(djs.IntentsBitField.resolve('GUILD_MESSAGES'), 1 << 9);
});

test('BitField nhan mang tron lan hai cach viet', () => {
  const expected = PermissionFlagsBits.SendMessages | PermissionFlagsBits.ManageGuild;
  assert.strictEqual(djs.PermissionsBitField.resolve(['SEND_MESSAGES', 'ManageGuild']), expected);
});

test('ten co bi doi han duoc map bang bang override', () => {
  assert.strictEqual(
    djs.PermissionsBitField.resolve('MANAGE_EMOJIS_AND_STICKERS'),
    PermissionFlagsBits.ManageGuildExpressions,
  );
  assert.strictEqual(djs.PermissionsBitField.resolve('USE_VAD'), PermissionFlagsBits.UseVAD);
  assert.strictEqual(djs.PermissionsBitField.resolve('USE_PUBLIC_THREADS'), PermissionFlagsBits.CreatePublicThreads);
});

test('toArray khong tra trung sau khi them ten cu', () => {
  // Đây là lý do phải ghi đè `resolve` thay vì nhét thêm khoá vào `Flags`.
  const bits = new djs.PermissionsBitField(['SEND_MESSAGES', 'ManageGuild']);
  assert.deepStrictEqual(bits.toArray().sort(), ['ManageGuild', 'SendMessages']);
});

test('ten co khong ton tai van nem loi nhu cu', () => {
  assert.throws(() => djs.PermissionsBitField.resolve('KHONG_CO_CO_NAY'));
});

test('Constants mang hinh dang v13', () => {
  assert.strictEqual(djs.Constants.ChannelTypes.GUILD_TEXT, ChannelType.GuildText);
  assert.strictEqual(djs.Constants.ChannelTypes.GUILD_NEWS, ChannelType.GuildAnnouncement);
  assert.strictEqual(djs.Constants.ChannelTypes.GUILD_PUBLIC_THREAD, ChannelType.PublicThread);
  assert.strictEqual(djs.Constants.VerificationLevels.VERY_HIGH, GuildVerificationLevel.VeryHigh);
  assert.strictEqual(djs.Constants.ActivityTypes.LISTENING, ActivityType.Listening);
  // Giá trị event của v14 trùng chuỗi của v13.
  assert.strictEqual(djs.Constants.Events.MessageCreate, 'messageCreate');
});

test('addField cua v13 map sang addFields', () => {
  const embed = new djs.EmbedBuilder().addField('Ten', 'Gia tri', true);
  assert.deepStrictEqual(embed.data.fields, [{ name: 'Ten', value: 'Gia tri', inline: true }]);
});

test('isText va isVoice map sang isTextBased va isVoiceBased', () => {
  assert.strictEqual(typeof djs.BaseChannel.prototype.isText, 'function');
  assert.strictEqual(typeof djs.BaseChannel.prototype.isVoice, 'function');
});

test('coerce chuoi enum o GuildChannelManager#create', async () => {
  const client = new djs.Client({});
  const guild = new (require('../src/structures/Guild.js').Guild)(client, { id: 'g1', unavailable: false });
  const bodies = [];
  client.rest.post = async (route, options) => {
    bodies.push(options.body);
    return { id: 'c1', type: ChannelType.GuildText, guild_id: 'g1', name: 'x', permission_overwrites: [] };
  };

  await guild.channels.create({ name: 'x', type: 'GUILD_TEXT' });
  assert.strictEqual(bodies[0].type, ChannelType.GuildText);

  // Giá trị v14 vẫn đi qua nguyên vẹn.
  await guild.channels.create({ name: 'y', type: ChannelType.GuildVoice });
  assert.strictEqual(bodies[1].type, ChannelType.GuildVoice);

  client.destroy();
});

test('coerce khong lam hong gia tri khong phai enum', async () => {
  const client = new djs.Client({});
  const guild = new (require('../src/structures/Guild.js').Guild)(client, { id: 'g1', unavailable: false });
  const bodies = [];
  client.rest.post = async (route, options) => {
    bodies.push(options.body);
    return { id: 'c1', type: ChannelType.GuildText, guild_id: 'g1', name: 'x', permission_overwrites: [] };
  };

  await guild.channels.create({ name: 'ten-kenh', type: 'KHONG_PHAI_ENUM' });
  // Không dịch được thì để nguyên cho API tự báo lỗi, không tự ý đổi thành undefined.
  assert.strictEqual(bodies[0].type, 'KHONG_PHAI_ENUM');
  assert.strictEqual(bodies[0].name, 'ten-kenh');

  client.destroy();
});

test('coerce chuoi ActivityType qua ClientPresence#_parse', () => {
  const client = new djs.Client({});
  const packet = client.presence._parse({ activities: [{ name: 'nhac', type: 'LISTENING' }] });

  assert.strictEqual(packet.activities[0].type, ActivityType.Listening);
  client.destroy();
});

test('applyCompat goi nhieu lan khong chong them lop bao', () => {
  const { applyCompat } = require('../src/compat/index.js');
  applyCompat();
  applyCompat();
  // Vẫn dịch đúng một lần, không lồng nhau.
  assert.strictEqual(djs.PermissionsBitField.resolve('SEND_MESSAGES'), PermissionFlagsBits.SendMessages);
});
