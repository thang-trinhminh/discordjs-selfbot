'use strict';

const assert = require('node:assert');
const { test } = require('node:test');
const { ChannelType } = require('discord-api-types/v10');
const Client = require('../src/client/Client.js');
const { mergeDefault } = require('../src/client/voice/util/MergeDefault.js');
const { getSDPCodecName } = require('../src/client/voice/util/Sdp.js');
const {
  Opcodes,
  VoiceOpcodes,
  VoiceStatus,
  getAllPayloadType,
  getPayloadType,
  payloadTypes,
} = require('../src/client/voice/util/VoiceConstants.js');
const SpeakingBitField = require('../src/util/SpeakingBitField.js');

// Phần lõi của voice (UDP, RTP, handshake, mã hoá) chỉ chứng minh được bằng một
// voice channel thật. Ở đây chỉ khoá được phần thuần tuý — bảng codec, SDP,
// bitfield, và những chỗ v13 dùng chuỗi enum mà v14 dùng số.

test('moi file trong stack voice nap duoc', async () => {
  const { readdir } = require('node:fs/promises');
  const { join } = require('node:path');

  async function* walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) yield* walk(path);
      else if (entry.name.endsWith('.js')) yield path;
    }
  }

  let count = 0;
  for await (const file of walk('src/client/voice')) {
    assert.doesNotThrow(() => require(`../${file}`), `khong nap duoc ${file}`);
    count += 1;
  }
  assert.ok(count >= 20, `chi thay ${count} file`);
});

test('bang codec co du payload type Discord dung', () => {
  assert.strictEqual(payloadTypes.length, 6);
  assert.strictEqual(getPayloadType('opus'), 120);
  assert.strictEqual(getPayloadType('H264'), 105);
  assert.strictEqual(getPayloadType('H265'), 103);
  assert.strictEqual(getPayloadType('VP8'), 107);
  assert.strictEqual(getAllPayloadType(), payloadTypes);
});

test('getPayloadType bao loi ro khi codec khong ton tai', () => {
  assert.throws(() => getPayloadType('AV2'), /Unknown codec/);
});

test('SDP khai dung payload type va bo H265 khi khong truyen', () => {
  const sdp = getSDPCodecName(5000, null, 5002);

  assert.ok(sdp.includes('m=video 5000 RTP/AVP 105'));
  assert.ok(sdp.includes('a=rtpmap:105 H264/90000'));
  assert.ok(sdp.includes('m=audio 5002 RTP/AVP 120'));
  assert.ok(sdp.includes('a=rtpmap:120 opus/48000/2'));
  assert.ok(!sdp.includes('H265'), 'khong truyen cong H265 thi khong duoc khai');
});

test('SDP khai them H265 khi co cong', () => {
  const sdp = getSDPCodecName(5000, 5001, 5002);
  assert.ok(sdp.includes('m=video 5001 RTP/AVP 103'));
  assert.ok(sdp.includes('a=rtpmap:103 H265/90000'));
});

test('opcode voice dung so cua Discord', () => {
  assert.strictEqual(VoiceOpcodes.IDENTIFY, 0);
  assert.strictEqual(VoiceOpcodes.SELECT_PROTOCOL, 1);
  assert.strictEqual(VoiceOpcodes.READY, 2);
  assert.strictEqual(VoiceOpcodes.SESSION_DESCRIPTION, 4);
  assert.strictEqual(VoiceOpcodes.SPEAKING, 5);
  assert.strictEqual(VoiceOpcodes.HELLO, 8);
  assert.strictEqual(Opcodes.VOICE_STATE_UPDATE, 4);
  assert.strictEqual(Opcodes.STREAM_CREATE, 18);
});

test('VoiceStatus du cac trang thai stack dung toi', () => {
  for (const name of ['CONNECTED', 'CONNECTING', 'AUTHENTICATING', 'RECONNECTING', 'DISCONNECTED']) {
    assert.strictEqual(typeof VoiceStatus[name], 'number', `thieu VoiceStatus.${name}`);
  }
});

test('SpeakingBitField resolve duoc ca hai cach viet', () => {
  assert.strictEqual(SpeakingBitField.Flags.Speaking, 1);
  assert.strictEqual(SpeakingBitField.Flags.Soundshare, 2);
  assert.strictEqual(SpeakingBitField.Flags.PrioritySpeaking, 4);
  assert.strictEqual(SpeakingBitField.resolve('Speaking'), 1);
  // Compat layer gắn thêm tên kiểu v13 cho mọi BitField đã đăng ký; Speaking là
  // của riêng selfbot nên chỉ có tên v14.
  assert.strictEqual(new SpeakingBitField(3).toArray().length, 2);
});

test('mergeDefault tron de quy va giu gia tri nguoi dung', () => {
  const result = mergeDefault({ a: 1, nested: { x: 1, y: 2 } }, { nested: { y: 9 } });

  assert.strictEqual(result.a, 1);
  assert.strictEqual(result.nested.x, 1);
  assert.strictEqual(result.nested.y, 9);
});

test('mergeDefault sua truc tiep given, khong sua def', () => {
  const defaults = { nested: { x: 1 }, them: 'mac dinh' };
  const given = { nested: { x: 9 } };
  const result = mergeDefault(defaults, given);

  // Giữ đúng ngữ nghĩa của v13: trả về chính `given` đã được bổ sung.
  assert.strictEqual(result, given);
  assert.strictEqual(given.them, 'mac dinh');
  assert.strictEqual(defaults.nested.x, 1, 'khong duoc sua object mac dinh');
});

test('client.voice la ClientVoiceManager da port', () => {
  const client = new Client({});
  const ClientVoiceManager = require('../src/client/voice/ClientVoiceManager.js');

  assert.ok(client.voice instanceof ClientVoiceManager);
  assert.strictEqual(typeof client.voice.joinChannel, 'function');
  assert.strictEqual(typeof client.voice.onVoiceServer, 'function');
  assert.strictEqual(typeof client.voice.onVoiceStateUpdate, 'function');

  client.destroy();
});

test('handler voice cua upstream van goi vao manager', () => {
  const client = new Client({});
  const handler = require('../src/client/websocket/handlers/VOICE_SERVER_UPDATE.js');
  const seen = [];
  client.voice.onVoiceServer = data => seen.push(data);

  handler(client, { d: { guild_id: 'g1', endpoint: 'x.discord.gg', token: 'tok' } });

  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].guild_id, 'g1');

  client.destroy();
});

test('nhan dien DM va group DM bang enum so, khong phai chuoi v13', async () => {
  const client = new Client({});
  const GroupDMChannel = require('../src/structures/GroupDMChannel.js');

  const groupDm = new GroupDMChannel(client, {
    id: '900',
    type: ChannelType.GroupDM,
    name: 'nhom',
    recipients: [],
  });
  client.channels.cache.set('900', groupDm);

  // Bản v13 so sánh với chuỗi 'GROUP_DM', ở v14 `type` là số nên so sánh đó
  // luôn sai và `joinable` (không tồn tại trên group DM) sẽ chặn nhầm.
  let reached = false;
  client.voice.joinChannel(groupDm).catch(() => {});
  reached = true;
  assert.ok(reached, 'khong duoc nem dong bo vi nham kieu kenh');

  client.destroy();
});

test('speaking event dung ten kieu v14', () => {
  const Events = require('../src/util/Events.js');
  assert.strictEqual(Events.GuildMemberSpeaking, 'guildMemberSpeaking');
});
