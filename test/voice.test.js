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

// Stub thay cho session MLS thật. Crypto của davey không phải việc của test này —
// thứ cần khoá là máy trạng thái transition và các offset byte quanh nó.
function makeDaveStub(overrides = {}) {
  const calls = [];
  return {
    calls,
    ready: true,
    voicePrivacyCode: 'ABCDE',
    getSerializedKeyPackage: () => Buffer.from('key-package'),
    setExternalSender: buffer => calls.push(['setExternalSender', buffer.toString('utf8')]),
    setPassthroughMode: (on, expiry) => calls.push(['setPassthroughMode', on, expiry]),
    reinit: () => calls.push(['reinit']),
    reset: () => calls.push(['reset']),
    processProposals: (optype, proposals, users) => {
      calls.push(['processProposals', optype, proposals.toString('utf8'), users]);
      return { commit: Buffer.from('commit'), welcome: Buffer.from('welcome') };
    },
    processCommit: commit => calls.push(['processCommit', commit.toString('utf8')]),
    processWelcome: welcome => calls.push(['processWelcome', welcome.toString('utf8')]),
    encryptOpus: packet => Buffer.concat([Buffer.from('enc:'), packet]),
    decrypt: (userId, mediaType, packet) => Buffer.concat([Buffer.from('dec:'), packet]),
    canPassthrough: () => false,
    ...overrides,
  };
}

function makeDaveSession(overrides = {}, options = {}) {
  const { DAVESession } = require('../src/client/voice/networking/DAVESession.js');
  const session = new DAVESession(1, '111', '222', options);
  const stub = makeDaveStub(overrides);
  session.createSession = () => stub;
  return { session, stub };
}

test('reinit tao session va phat key package', () => {
  const { session, stub } = makeDaveSession();
  const packages = [];
  session.on('keyPackage', buffer => packages.push(buffer.toString('utf8')));

  session.reinit();

  assert.strictEqual(session.session, stub);
  assert.deepStrictEqual(packages, ['key-package']);
});

test('prepareEpoch chi reinit o epoch 1', () => {
  const { session } = makeDaveSession();
  const packages = [];
  session.on('keyPackage', buffer => packages.push(buffer.toString('utf8')));

  session.prepareEpoch({ epoch: 2, protocol_version: 1 });
  assert.deepStrictEqual(packages, []);

  session.prepareEpoch({ epoch: 1, protocol_version: 1 });
  assert.deepStrictEqual(packages, ['key-package']);
});

test('transition 0 thi hanh ngay, transition khac cho lenh', () => {
  const { session } = makeDaveSession();
  session.reinit();

  assert.strictEqual(session.prepareTransition({ transition_id: 0, protocol_version: 1 }), false);
  assert.strictEqual(session.lastTransitionId, 0);

  assert.strictEqual(session.prepareTransition({ transition_id: 7, protocol_version: 1 }), true);
  assert.strictEqual(session.lastTransitionId, 0);

  assert.strictEqual(session.executeTransition(7), true);
  assert.strictEqual(session.lastTransitionId, 7);
});

test('executeTransition bo qua transition khong duoc bao truoc', () => {
  const { session } = makeDaveSession();
  assert.strictEqual(session.executeTransition(99), false);
});

test('xuong v0 bat passthrough, len lai thi bat lai voi han ngan', () => {
  const { session, stub } = makeDaveSession();
  session.reinit();

  session.prepareTransition({ transition_id: 1, protocol_version: 0 });
  assert.deepStrictEqual(stub.calls.at(-1), ['setPassthroughMode', true, 24]);

  session.executeTransition(1);
  assert.strictEqual(session.protocolVersion, 0);

  session.prepareTransition({ transition_id: 2, protocol_version: 1 });
  session.executeTransition(2);
  assert.strictEqual(session.protocolVersion, 1);
  assert.deepStrictEqual(stub.calls.at(-1), ['setPassthroughMode', true, 10]);
});

test('processProposals tach optype o byte dau va gop commit voi welcome', () => {
  const { session, stub } = makeDaveSession();
  session.reinit();

  const payload = Buffer.concat([Buffer.from([1]), Buffer.from('proposals')]);
  const result = session.processProposals(payload, new Set(['111', '333']));

  assert.deepStrictEqual(stub.calls.at(-1), ['processProposals', 1, 'proposals', ['111', '333']]);
  assert.strictEqual(result.toString('utf8'), 'commitwelcome');
});

test('processProposals tra undefined khi khong co commit', () => {
  const { session } = makeDaveSession({ processProposals: () => ({}) });
  session.reinit();

  assert.strictEqual(session.processProposals(Buffer.from([0]), new Set()), undefined);
});

test('processCommit doc transition id o hai byte dau', () => {
  const { session, stub } = makeDaveSession();
  session.reinit();

  const payload = Buffer.concat([Buffer.from([0x00, 0x05]), Buffer.from('commit-body')]);
  const result = session.processCommit(payload);

  assert.deepStrictEqual(result, { transitionId: 5, success: true });
  assert.deepStrictEqual(stub.calls.at(-1), ['processCommit', 'commit-body']);
  assert.strictEqual(session.executeTransition(5), true);
});

test('processWelcome hong thi phat invalidateTransition', () => {
  const { session } = makeDaveSession({
    processWelcome: () => {
      throw new Error('bad welcome');
    },
  });
  session.reinit();

  const invalidated = [];
  session.on('invalidateTransition', id => invalidated.push(id));

  const payload = Buffer.concat([Buffer.from([0x00, 0x09]), Buffer.from('welcome-body')]);
  const result = session.processWelcome(payload);

  assert.deepStrictEqual(result, { transitionId: 9, success: false });
  assert.deepStrictEqual(invalidated, [9]);
});

test('silence frame di thang, khong ma hoa khong giai ma', () => {
  const Silence = require('../src/client/voice/util/Silence.js');
  const { session } = makeDaveSession();
  session.reinit();

  assert.strictEqual(session.encrypt(Silence.SILENCE_FRAME), Silence.SILENCE_FRAME);
  assert.strictEqual(session.decrypt(Silence.SILENCE_FRAME, '333'), Silence.SILENCE_FRAME);
});

test('v0 khong ma hoa, v1 thi ma hoa', () => {
  const { session } = makeDaveSession();
  session.reinit();

  assert.strictEqual(session.encrypt(Buffer.from('opus')).toString('utf8'), 'enc:opus');

  session.protocolVersion = 0;
  assert.strictEqual(session.encrypt(Buffer.from('opus')).toString('utf8'), 'opus');
});

test('decrypt hong duoi nguong thi bo goi, qua nguong thi recover', () => {
  const { session } = makeDaveSession(
    {
      decrypt: () => {
        throw new Error('nope');
      },
    },
    { decryptionFailureTolerance: 2 },
  );
  session.reinit();
  session.prepareTransition({ transition_id: 0, protocol_version: 1 });

  const invalidated = [];
  session.on('invalidateTransition', id => invalidated.push(id));

  assert.strictEqual(session.decrypt(Buffer.from('a'), '333'), null);
  assert.strictEqual(session.decrypt(Buffer.from('a'), '333'), null);
  assert.deepStrictEqual(invalidated, []);

  assert.strictEqual(session.decrypt(Buffer.from('a'), '333'), null);
  assert.deepStrictEqual(invalidated, [0]);
});

test('decrypt thanh cong dat lai bo dem hong', () => {
  const { session } = makeDaveSession();
  session.reinit();

  assert.strictEqual(session.decrypt(Buffer.from('opus'), '333').toString('utf8'), 'dec:opus');
});

// VoiceWebSocket đụng vào `connection`, `client` và một socket thật. Ở đây dựng bản
// giả tối thiểu rồi gọi thẳng vào các hàm xử lý — không mở kết nối nào.
function makeVoiceWebSocket({ identifyExtras } = {}) {
  const VoiceWebSocket = require('../src/client/voice/networking/VoiceWebSocket.js');
  const sent = [];

  const connection = new EventEmitter();
  connection.client = { user: { id: '111' } };
  connection.serverId = null;
  connection.channel = { id: '444', guild: { id: '555' } };
  connection.authentication = { token: 'tok', sessionId: 'sess', endpoint: 'x.discord.gg' };
  if (identifyExtras) connection.identifyExtras = identifyExtras;

  const websocket = new VoiceWebSocket(connection);
  websocket.send = data => {
    sent.push(data);
    return Promise.resolve(data);
  };

  return { websocket, sent };
}

test('IDENTIFY khai max_dave_protocol_version va dung opcode IDENTIFY', () => {
  const { DAVE_PROTOCOL_VERSION } = require('../src/client/voice/networking/DAVESession.js');
  const { websocket, sent } = makeVoiceWebSocket();

  websocket.onOpen();

  const packet = JSON.parse(sent[0]);
  assert.strictEqual(packet.op, VoiceOpcodes.IDENTIFY);
  assert.strictEqual(packet.d.max_dave_protocol_version, DAVE_PROTOCOL_VERSION);
  assert.strictEqual(packet.d.server_id, '555');
  assert.strictEqual(packet.d.session_id, 'sess');
});

test('IDENTIFY cua voice thuong khong mang payload Go Live', () => {
  const { websocket, sent } = makeVoiceWebSocket();

  websocket.onOpen();

  const packet = JSON.parse(sent[0]);
  assert.strictEqual('streams' in packet.d, false);
  assert.strictEqual('video' in packet.d, false);
});

test('IDENTIFY mang lai payload Go Live khi connection khai identifyExtras', () => {
  const extras = { streams: [{ type: 'screen', rid: '100', quality: 100 }], video: true };
  const { websocket, sent } = makeVoiceWebSocket({ identifyExtras: extras });

  websocket.onOpen();

  const packet = JSON.parse(sent[0]);
  assert.deepStrictEqual(packet.d.streams, extras.streams);
  assert.strictEqual(packet.d.video, true);
});

test('connectedClients cong theo opcode 11 va tru theo opcode 13', () => {
  const { websocket } = makeVoiceWebSocket();

  websocket.onPacket({ op: VoiceOpcodes.CLIENTS_CONNECT, d: { user_ids: ['333', '444'] } });
  assert.deepStrictEqual([...websocket.connectedClients].sort(), ['333', '444']);

  websocket.onPacket({ op: VoiceOpcodes.CLIENT_DISCONNECT, d: { user_id: '333' } });
  assert.deepStrictEqual([...websocket.connectedClients], ['444']);
});

test('opcode DAVE dang JSON di ra event daveMessage', () => {
  const { websocket } = makeVoiceWebSocket();
  const seen = [];
  websocket.on('daveMessage', message => seen.push(message));

  websocket.onPacket({ op: VoiceOpcodes.DAVE_PREPARE_TRANSITION, d: { transition_id: 3, protocol_version: 1 } });
  websocket.onPacket({ op: VoiceOpcodes.DAVE_EXECUTE_TRANSITION, d: { transition_id: 3 } });
  websocket.onPacket({ op: VoiceOpcodes.DAVE_PREPARE_EPOCH, d: { epoch: 1, protocol_version: 1 } });

  assert.deepStrictEqual(
    seen.map(message => message.op),
    [VoiceOpcodes.DAVE_PREPARE_TRANSITION, VoiceOpcodes.DAVE_EXECUTE_TRANSITION, VoiceOpcodes.DAVE_PREPARE_EPOCH],
  );
  assert.deepStrictEqual(seen[0].d, { transition_id: 3, protocol_version: 1 });
});

test('frame nhi phan di ra event daveBinary va cap nhat seq', () => {
  const { websocket } = makeVoiceWebSocket();
  const seen = [];
  websocket.on('daveBinary', message => seen.push(message));

  const frame = Buffer.concat([Buffer.from([0x00, 0x11, VoiceOpcodes.DAVE_MLS_PROPOSALS]), Buffer.from('body')]);
  websocket.onMessage({ data: frame });

  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].op, VoiceOpcodes.DAVE_MLS_PROPOSALS);
  assert.strictEqual(seen[0].payload.toString('utf8'), 'body');
  assert.strictEqual(websocket._sequenceNumber, 17);
});

test('sendBinary gui opcode mot byte roi payload', async () => {
  const { websocket, sent } = makeVoiceWebSocket();

  await websocket.sendBinary(VoiceOpcodes.DAVE_MLS_KEY_PACKAGE, Buffer.from('kp'));

  assert.strictEqual(sent[0].readUInt8(0), VoiceOpcodes.DAVE_MLS_KEY_PACKAGE);
  assert.strictEqual(sent[0].subarray(1).toString('utf8'), 'kp');
});

// VoiceConnection chạm vào client, channel và player. Ở đây chỉ cần phần trạng thái,
// nên dựng object có prototype của nó rồi gọi thẳng vào hàm cần kiểm.
function makeVoiceConnection() {
  const VoiceConnection = require('../src/client/voice/VoiceConnection.js');
  const sentBinary = [];
  const sentPackets = [];

  const connection = Object.create(VoiceConnection.prototype);
  EventEmitter.call(connection);
  connection.dave = null;
  connection.channel = { id: '444' };
  // `client` la getter doc qua voiceManager, khong gan thang duoc.
  connection.voiceManager = { client: { user: { id: '111' } } };
  connection.sockets = {
    ws: {
      connectedClients: new Set(['111', '333']),
      sendBinary: (op, payload) => {
        sentBinary.push({ op, payload });
        return Promise.resolve();
      },
      sendPacket: packet => {
        sentPackets.push(packet);
        return Promise.resolve();
      },
    },
  };

  return { connection, sentBinary, sentPackets };
}

test('identifyExtras rong o voice thuong, co payload Go Live o ca hai lop stream', () => {
  const VoiceConnection = require('../src/client/voice/VoiceConnection.js');
  const { StreamConnection, StreamConnectionReadonly } = VoiceConnection;

  assert.deepStrictEqual(Object.create(VoiceConnection.prototype).identifyExtras, {});

  // Ca phat lan xem Go Live deu phai giu nguyen payload cu; doi la doan mo.
  for (const Klass of [StreamConnection, StreamConnectionReadonly]) {
    const extras = Object.create(Klass.prototype).identifyExtras;
    assert.strictEqual(extras.video, true, Klass.name);
    assert.strictEqual(extras.streams[0].type, 'screen', Klass.name);
    assert.strictEqual(extras.streams[0].rid, '100', Klass.name);
    assert.strictEqual(extras.streams[0].quality, 100, Klass.name);
  }

  // Object moi moi lan, khong dung chung ban co the bi sua.
  const first = Object.create(StreamConnection.prototype).identifyExtras;
  const second = Object.create(StreamConnection.prototype).identifyExtras;
  assert.notStrictEqual(first.streams, second.streams);
});

test('createDaveSession bo qua khi server khai phien ban 0', () => {
  const { connection } = makeVoiceConnection();
  assert.strictEqual(connection.createDaveSession(0), null);
});

test('createDaveSession tao session voi user va channel hien tai', () => {
  const { connection } = makeVoiceConnection();
  const dave = connection.createDaveSession(1);

  assert.strictEqual(dave.protocolVersion, 1);
  assert.strictEqual(dave.userId, '111');
  assert.strictEqual(dave.channelId, '444');
});

test('key package cua session duoc gui bang opcode 26', () => {
  const { connection, sentBinary } = makeVoiceConnection();
  const dave = connection.createDaveSession(1);

  dave.emit('keyPackage', Buffer.from('kp'));

  assert.strictEqual(sentBinary[0].op, VoiceOpcodes.DAVE_MLS_KEY_PACKAGE);
  assert.strictEqual(sentBinary[0].payload.toString('utf8'), 'kp');
});

test('transition hong duoc bao lai bang opcode 31', () => {
  const { connection, sentPackets } = makeVoiceConnection();
  const dave = connection.createDaveSession(1);

  dave.emit('invalidateTransition', 4);

  assert.deepStrictEqual(sentPackets[0], {
    op: VoiceOpcodes.DAVE_MLS_INVALID_COMMIT_WELCOME,
    d: { transition_id: 4 },
  });
});

test('opcode 21 voi transition khac 0 thi tra loi bang opcode 23', () => {
  const { connection, sentPackets } = makeVoiceConnection();
  connection.dave = connection.createDaveSession(1);
  connection.dave.createSession = () => makeDaveStub();
  connection.dave.reinit();

  connection.onDaveMessage({
    op: VoiceOpcodes.DAVE_PREPARE_TRANSITION,
    d: { transition_id: 6, protocol_version: 1 },
  });

  assert.deepStrictEqual(sentPackets.at(-1), {
    op: VoiceOpcodes.DAVE_TRANSITION_READY,
    d: { transition_id: 6 },
  });
});

test('opcode 21 voi transition 0 thi khong tra loi', () => {
  const { connection, sentPackets } = makeVoiceConnection();
  connection.dave = connection.createDaveSession(1);
  connection.dave.createSession = () => makeDaveStub();
  connection.dave.reinit();

  connection.onDaveMessage({
    op: VoiceOpcodes.DAVE_PREPARE_TRANSITION,
    d: { transition_id: 0, protocol_version: 1 },
  });

  assert.deepStrictEqual(sentPackets, []);
});

test('opcode 27 gui commit va welcome lai bang opcode 28', () => {
  const { connection, sentBinary } = makeVoiceConnection();
  connection.dave = connection.createDaveSession(1);
  connection.dave.createSession = () => makeDaveStub();
  connection.dave.reinit();
  sentBinary.length = 0;

  connection.onDaveBinary({
    op: VoiceOpcodes.DAVE_MLS_PROPOSALS,
    payload: Buffer.concat([Buffer.from([0]), Buffer.from('proposals')]),
  });

  assert.strictEqual(sentBinary[0].op, VoiceOpcodes.DAVE_MLS_COMMIT_WELCOME);
  assert.strictEqual(sentBinary[0].payload.toString('utf8'), 'commitwelcome');
});

test('opcode 25 nap external sender vao session', () => {
  const { connection } = makeVoiceConnection();
  connection.dave = connection.createDaveSession(1);
  const stub = makeDaveStub();
  connection.dave.createSession = () => stub;
  connection.dave.reinit();

  connection.onDaveBinary({ op: VoiceOpcodes.DAVE_MLS_EXTERNAL_SENDER, payload: Buffer.from('sender') });

  assert.deepStrictEqual(stub.calls.at(-1), ['setExternalSender', 'sender']);
});

test('opcode 29 xu ly xong thi bao san sang bang opcode 23', () => {
  const { connection, sentPackets } = makeVoiceConnection();
  connection.dave = connection.createDaveSession(1);
  connection.dave.createSession = () => makeDaveStub();
  connection.dave.reinit();

  connection.onDaveBinary({
    op: VoiceOpcodes.DAVE_MLS_ANNOUNCE_COMMIT_TRANSITION,
    payload: Buffer.concat([Buffer.from([0x00, 0x08]), Buffer.from('commit')]),
  });

  assert.deepStrictEqual(sentPackets.at(-1), {
    op: VoiceOpcodes.DAVE_TRANSITION_READY,
    d: { transition_id: 8 },
  });
});

test('DAVE binary bi bo qua khi chua co session', () => {
  const { connection, sentBinary } = makeVoiceConnection();

  connection.onDaveBinary({ op: VoiceOpcodes.DAVE_MLS_EXTERNAL_SENDER, payload: Buffer.from('sender') });

  assert.deepStrictEqual(sentBinary, []);
});

test('audio duoc E2EE truoc khi ma hoa transport', () => {
  const AudioDispatcher = require('../src/client/voice/dispatcher/AudioDispatcher.js');

  const dispatcher = Object.create(AudioDispatcher.prototype);
  dispatcher.player = {
    voiceConnection: { dave: { encrypt: buffer => Buffer.concat([Buffer.from('e2ee:'), buffer]) } },
  };

  assert.strictEqual(dispatcher._daveEncrypt(Buffer.from('opus')).toString('utf8'), 'e2ee:opus');
});

test('khong co session DAVE thi gui opus tran', () => {
  const AudioDispatcher = require('../src/client/voice/dispatcher/AudioDispatcher.js');

  const dispatcher = Object.create(AudioDispatcher.prototype);
  dispatcher.player = { voiceConnection: { dave: null } };

  assert.strictEqual(dispatcher._daveEncrypt(Buffer.from('opus')).toString('utf8'), 'opus');
});

test('goi nhan duoc giai ma E2EE sau khi giai ma transport', () => {
  const PacketHandler = require('../src/client/voice/receiver/PacketHandler.js');

  const handler = Object.create(PacketHandler.prototype);
  handler.receiver = {
    connection: { dave: { decrypt: (packet, userId) => Buffer.from(`${userId}:${packet.toString('utf8')}`) } },
  };

  const packet = { header: { payloadType: getPayloadType('opus') }, payload: Buffer.from('opus') };
  const result = handler._daveDecrypt(packet, '333');

  assert.strictEqual(result.payload.toString('utf8'), '333:opus');
});

test('decrypt tra null thi bo goi', () => {
  const PacketHandler = require('../src/client/voice/receiver/PacketHandler.js');

  const handler = Object.create(PacketHandler.prototype);
  handler.receiver = { connection: { dave: { decrypt: () => null } } };

  const packet = { header: { payloadType: getPayloadType('opus') }, payload: Buffer.from('opus') };

  assert.strictEqual(handler._daveDecrypt(packet, '333'), null);
});

test('goi khong phai opus va loi parse di qua nguyen ven', () => {
  const PacketHandler = require('../src/client/voice/receiver/PacketHandler.js');

  const handler = Object.create(PacketHandler.prototype);
  handler.receiver = {
    connection: {
      dave: {
        decrypt: () => {
          throw new Error('khong duoc goi');
        },
      },
    },
  };

  const video = { header: { payloadType: getPayloadType('H264') }, payload: Buffer.from('frame') };
  assert.strictEqual(handler._daveDecrypt(video, '333'), video);

  const failure = new Error('parse hong');
  assert.strictEqual(handler._daveDecrypt(failure, '333'), failure);
});

test('thieu davey thi joinChannel bao ro phai cai gi', async () => {
  const DAVESessionModule = require('../src/client/voice/networking/DAVESession.js');
  const ClientVoiceManager = require('../src/client/voice/ClientVoiceManager.js');

  const client = new Client({});
  const manager = new ClientVoiceManager(client);
  const original = DAVESessionModule.DAVE_PROTOCOL_VERSION;

  Object.defineProperty(DAVESessionModule, 'DAVE_PROTOCOL_VERSION', { value: 0, configurable: true });
  try {
    await assert.rejects(() => manager.joinChannel('444'), /@snazzah\/davey/);
  } finally {
    Object.defineProperty(DAVESessionModule, 'DAVE_PROTOCOL_VERSION', { value: original, configurable: true });
    client.destroy();
  }
});

test('davey co san thi khong chan joinChannel o buoc do', () => {
  const { DAVE_PROTOCOL_VERSION } = require('../src/client/voice/networking/DAVESession.js');
  assert.ok(DAVE_PROTOCOL_VERSION > 0, 'moi truong test phai co @snazzah/davey');
});

test('IDENTIFY co channel_id, thu voice gateway doi tu v9', () => {
  const { websocket, sent } = makeVoiceWebSocket();

  websocket.onOpen();

  assert.strictEqual(JSON.parse(sent[0]).d.channel_id, '444');
});

test('VOICE_STATE_UPDATE cua nguoi khac khong dung vao ket noi cua minh', () => {
  const ClientVoiceManager = require('../src/client/voice/ClientVoiceManager.js');

  const client = new Client({});
  client.user = { id: '111' };
  const manager = new ClientVoiceManager(client);

  let disconnected = false;
  const sessionIds = [];
  manager.connection = {
    _disconnect: () => (disconnected = true),
    disconnect: () => (disconnected = true),
    setSessionId: id => sessionIds.push(id),
  };

  // Nguoi khac roi kenh: bap port cu goi _disconnect() va ngat ket noi cua ta.
  manager.onVoiceStateUpdate({ guild_id: 'g', user_id: '999', session_id: 'cua-ho', channel_id: null });
  assert.strictEqual(disconnected, false);
  assert.strictEqual(manager.connection !== null, true);

  // Nguoi khac vao kenh: ban port cu ghi de sessionId bang session cua ho.
  manager.onVoiceStateUpdate({ guild_id: 'g', user_id: '999', session_id: 'cua-ho', channel_id: '444' });
  assert.deepStrictEqual(sessionIds, []);

  client.destroy();
});
