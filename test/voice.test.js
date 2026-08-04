'use strict';

const assert = require('node:assert');
const { Buffer } = require('node:buffer');
const EventEmitter = require('node:events');
const { test } = require('node:test');
const { setTimeout: sleep } = require('node:timers/promises');
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

test('joinChannel nap member cua chinh minh truoc khi hoi joinable', async () => {
  const client = new Client({});
  let fetched = null;
  let joinable = false;

  // Tai khoan nguoi dung khong duoc READY seed member cua chinh no, nen
  // `members.me` la null va `joinable` false — moi lan vao voice channel trong
  // guild deu bi chan ngay o cong nay.
  const guild = {
    members: {
      me: null,
      fetch: async id => {
        fetched = id;
        guild.members.me = { id };
        joinable = true;
        return guild.members.me;
      },
    },
  };

  const channel = {
    id: '900',
    guild,
    get joinable() {
      return joinable;
    },
  };

  client.channels.resolve = () => channel;
  client.user = { id: '1' };

  // Chi quan tam den cong kiem tra quyen: cho no vao toi buoc dung voice thi thoi.
  await assert.rejects(client.voice.joinChannel(channel), error => error.message !== 'VOICE_JOIN_CHANNEL');

  assert.strictEqual(fetched, '1');
  assert.strictEqual(joinable, true);

  client.destroy();
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

test('websocket voice khong reconnect vo ich khi ma dong la vinh vien', async () => {
  const VoiceWebSocket = require('../src/client/voice/networking/VoiceWebSocket.js');
  const socket = Object.create(VoiceWebSocket.prototype);
  EventEmitter.call(socket);
  socket.dead = false;
  socket.attempts = 1;

  let reconnects = 0;
  socket.connect = () => reconnects++;

  const errors = [];
  socket.on('error', error => errors.push(error));
  socket.on('debug', () => {});

  // 4017 la Discord doi DAVE (E2EE). Thu lai bao nhieu lan cung the, va ban port
  // chi `debug` nen caller ngoi cho toi VOICE_CONNECTION_TIMEOUT.
  socket.onClose({ code: 4017, reason: 'E2EE/DAVE protocol required' });
  assert.strictEqual(reconnects, 0);
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0].message, /4017/);

  // 4014 la bi ngat khoi kenh — binh thuong, dung thu lai nhung dung nem loi.
  socket.onClose({ code: 4014, reason: 'Disconnected' });
  assert.strictEqual(reconnects, 0);
  assert.strictEqual(errors.length, 1);

  // Ma la nhat thoi thi van thu lai. Lich reconnect chay qua setTimeout nen phai
  // nhuong mot nhip; de attempts = 0 cho do treu hen gio.
  socket.attempts = 0;
  socket.onClose({ code: 1006, reason: '' });
  await sleep(20);
  assert.strictEqual(reconnects, 1);
});

test('opcode DAVE khop voi discord-api-types', () => {
  const { VoiceOpcodes: ApiVoiceOpcodes } = require('discord-api-types/voice/v8');

  assert.strictEqual(VoiceOpcodes.CLIENTS_CONNECT, ApiVoiceOpcodes.ClientsConnect);
  assert.strictEqual(VoiceOpcodes.DAVE_PREPARE_TRANSITION, ApiVoiceOpcodes.DavePrepareTransition);
  assert.strictEqual(VoiceOpcodes.DAVE_EXECUTE_TRANSITION, ApiVoiceOpcodes.DaveExecuteTransition);
  assert.strictEqual(VoiceOpcodes.DAVE_TRANSITION_READY, ApiVoiceOpcodes.DaveTransitionReady);
  assert.strictEqual(VoiceOpcodes.DAVE_PREPARE_EPOCH, ApiVoiceOpcodes.DavePrepareEpoch);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_EXTERNAL_SENDER, ApiVoiceOpcodes.DaveMlsExternalSender);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_KEY_PACKAGE, ApiVoiceOpcodes.DaveMlsKeyPackage);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_PROPOSALS, ApiVoiceOpcodes.DaveMlsProposals);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_COMMIT_WELCOME, ApiVoiceOpcodes.DaveMlsCommitWelcome);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_ANNOUNCE_COMMIT_TRANSITION, ApiVoiceOpcodes.DaveMlsAnnounceCommitTransition);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_WELCOME, ApiVoiceOpcodes.DaveMlsWelcome);
  assert.strictEqual(VoiceOpcodes.DAVE_MLS_INVALID_COMMIT_WELCOME, ApiVoiceOpcodes.DaveMlsInvalidCommitWelcome);
});

test('shim doc duoc frame nhi phan cua DAVE', () => {
  const WebSocketShim = require('../src/client/voice/util/VoiceWebSocketShim.js');

  // Seq uint16BE, op uint8, roi payload.
  const frame = Buffer.concat([Buffer.from([0x00, 0x2a, 25]), Buffer.from('mls', 'utf8')]);
  const { op, seq, payload } = WebSocketShim.unpack(frame);

  assert.strictEqual(seq, 42);
  assert.strictEqual(op, 25);
  assert.strictEqual(payload.toString('utf8'), 'mls');
});

test('shim van doc JSON dang chuoi nhu cu', () => {
  const WebSocketShim = require('../src/client/voice/util/VoiceWebSocketShim.js');

  assert.deepStrictEqual(WebSocketShim.unpack('{"op":8,"d":{"heartbeat_interval":41250}}'), {
    op: 8,
    d: { heartbeat_interval: 41250 },
  });
});

test('packBinary gan opcode mot byte, khong gan seq', () => {
  const WebSocketShim = require('../src/client/voice/util/VoiceWebSocketShim.js');

  const packed = WebSocketShim.packBinary(26, Buffer.from('key', 'utf8'));

  assert.strictEqual(packed.length, 4);
  assert.strictEqual(packed.readUInt8(0), 26);
  assert.strictEqual(packed.subarray(1).toString('utf8'), 'key');
});
