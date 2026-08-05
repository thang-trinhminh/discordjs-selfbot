# DAVE E2EE cho voice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voice của tài khoản người dùng nói được DAVE (E2EE) để Discord không đóng websocket bằng close code 4017 nữa, và audio gửi/nhận được mã hoá đầu cuối thật.

**Architecture:** Bọc `@snazzah/davey` (binding native mà `@discordjs/voice` dùng) trong một lớp `DAVESession` mới. `VoiceWebSocket` học nói frame nhị phân và khai `max_dave_protocol_version` trong IDENTIFY. `VoiceConnection` giữ vòng đời session và làm cầu nối giữa websocket với session. Dispatcher và PacketHandler cắm thêm một lớp mã hoá **bên trong** lớp transport encryption đã có.

**Tech Stack:** Node 20.18+, CommonJS, `node --test`, `@snazzah/davey`, `discord-api-types/voice/v8`, `ws`.

**Spec:** `docs/superpowers/specs/2026-08-04-dave-voice-e2ee-design.md`

## Global Constraints

- Node `>=20.18`. CommonJS (`'use strict';` đầu file, `require`, `module.exports`).
- Test chạy bằng `node --test`. Không thêm test framework, không thêm fixture library.
- Tên test viết tiếng Việt **không dấu**, theo đúng kiểu đang có trong `test/voice.test.js`.
- Comment trong `src/` viết tiếng Việt **có dấu**, giải thích _vì sao_, không thuật lại code.
- `@snazzah/davey` nằm trong `optionalDependencies`. Không được `require` trần ở top level bất kỳ file nào nằm trên đường `require('../src/index.js')` — phải bọc try/catch.
- Prettier chạy tự động qua lint-staged khi commit. Đừng chống lại nó.
- `npm test` phải xanh sau **mỗi** task. Baseline hiện tại: 283 test pass.
- Không sửa `scripts/smoke/results.md` cho tới Task 8.

## File Structure

| File                                            | Trách nhiệm                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/voice/networking/DAVESession.js`    | **Tạo mới.** Bọc davey: session MLS, máy trạng thái transition/epoch, đếm decrypt hỏng, `encrypt`/`decrypt`. Không biết gì về websocket. |
| `src/client/voice/util/VoiceConstants.js`       | Sửa. Thêm opcode 11 và 21–31.                                                                                                            |
| `src/client/voice/util/VoiceWebSocketShim.js`   | Sửa. Framing nhị phân.                                                                                                                   |
| `src/client/voice/networking/VoiceWebSocket.js` | Sửa. IDENTIFY, routing frame nhị phân, `sendBinary`, `connectedClients`.                                                                 |
| `src/client/voice/VoiceConnection.js`           | Sửa. Vòng đời session, cầu nối ws ↔ session, `identifyExtras`.                                                                           |
| `src/client/voice/dispatcher/BaseDispatcher.js` | Sửa. E2EE encrypt trước transport encrypt.                                                                                               |
| `src/client/voice/receiver/PacketHandler.js`    | Sửa. E2EE decrypt sau transport decrypt.                                                                                                 |
| `src/client/voice/ClientVoiceManager.js`        | Sửa. Ném lỗi rõ khi thiếu davey.                                                                                                         |
| `test/voice.test.js`                            | Sửa. Toàn bộ test mới thêm vào file này.                                                                                                 |
| `package.json`                                  | Sửa. `optionalDependencies`.                                                                                                             |

---

### Task 1: Opcode DAVE trong VoiceConstants

**Files:**

- Modify: `src/client/voice/util/VoiceConstants.js:78-93`
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: không có.
- Produces: `VoiceOpcodes.CLIENTS_CONNECT` (11), `VoiceOpcodes.DAVE_PREPARE_TRANSITION` (21), `DAVE_EXECUTE_TRANSITION` (22), `DAVE_TRANSITION_READY` (23), `DAVE_PREPARE_EPOCH` (24), `DAVE_MLS_EXTERNAL_SENDER` (25), `DAVE_MLS_KEY_PACKAGE` (26), `DAVE_MLS_PROPOSALS` (27), `DAVE_MLS_COMMIT_WELCOME` (28), `DAVE_MLS_ANNOUNCE_COMMIT_TRANSITION` (29), `DAVE_MLS_WELCOME` (30), `DAVE_MLS_INVALID_COMMIT_WELCOME` (31).

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `Expected values to be strictly equal: undefined !== 11`

- [ ] **Step 3: Thêm opcode**

Trong `src/client/voice/util/VoiceConstants.js`, thay object `VoiceOpcodes` bằng:

```js
const VoiceOpcodes = {
  IDENTIFY: 0,
  SELECT_PROTOCOL: 1,
  READY: 2,
  HEARTBEAT: 3,
  SESSION_DESCRIPTION: 4,
  SPEAKING: 5,
  HEARTBEAT_ACK: 6,
  RESUME: 7,
  HELLO: 8,
  RESUMED: 9,
  // Discord gửi cả danh sách người đang trong kênh qua opcode này. DAVE cần nó
  // để `processProposals` biết ai là người mới, nên bản port thiếu 11 là thiếu thật.
  CLIENTS_CONNECT: 11,
  SOURCES: 12,
  CLIENT_CONNECT: 12,
  CLIENT_DISCONNECT: 13,
  DAVE_PREPARE_TRANSITION: 21,
  DAVE_EXECUTE_TRANSITION: 22,
  DAVE_TRANSITION_READY: 23,
  DAVE_PREPARE_EPOCH: 24,
  DAVE_MLS_EXTERNAL_SENDER: 25,
  DAVE_MLS_KEY_PACKAGE: 26,
  DAVE_MLS_PROPOSALS: 27,
  DAVE_MLS_COMMIT_WELCOME: 28,
  DAVE_MLS_ANNOUNCE_COMMIT_TRANSITION: 29,
  DAVE_MLS_WELCOME: 30,
  DAVE_MLS_INVALID_COMMIT_WELCOME: 31,
};
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/voice/util/VoiceConstants.js test/voice.test.js
git commit -m "feat(voice): name the DAVE opcodes the voice gateway speaks"
```

---

### Task 2: Framing nhị phân trong shim

**Files:**

- Modify: `src/client/voice/util/VoiceWebSocketShim.js:37-48`
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: không có.
- Produces:
  - `unpack(data)` — `data` là `string` thì trả object JSON như cũ; là `Buffer`/`ArrayBuffer` thì trả `{ op: number, seq: number, payload: Buffer }`.
  - `packBinary(op, payload)` → `Buffer` — một byte opcode rồi payload, **không** có seq.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
test('shim doc duoc frame nhi phan cua DAVE', () => {
  const WebSocketShim = require('../src/client/voice/util/VoiceWebSocketShim.js');

  // seq uint16BE, op uint8, roi payload.
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `SyntaxError: Unexpected token` từ `JSON.parse`, và `WebSocketShim.packBinary is not a function`

- [ ] **Step 3: Sửa shim**

Trong `src/client/voice/util/VoiceWebSocketShim.js`, thay `unpack` và thêm `packBinary`:

```js
  /**
   * Giải mã một gói nhận được.
   *
   * `ws` trả frame text dưới dạng chuỗi và frame nhị phân dưới dạng `Buffer`, nên
   * kiểu của `data` chính là thứ phân biệt hai loại. DAVE là loại thứ hai, và bản
   * port cũ `JSON.parse` mọi thứ nên frame nhị phân đầu tiên làm nó ném lỗi.
   * @param {string|Buffer|ArrayBuffer} data Dữ liệu thô
   * @returns {Object}
   */
  unpack(data) {
    if (typeof data === 'string') return JSON.parse(data);

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return {
      seq: buffer.readUInt16BE(0),
      op: buffer.readUInt8(2),
      payload: buffer.subarray(3),
    };
  },

  /**
   * Đóng gói một frame nhị phân để gửi đi. Chiều gửi không mang `seq`.
   * @param {number} op Opcode
   * @param {Buffer} payload Nội dung
   * @returns {Buffer}
   */
  packBinary(op, payload) {
    return Buffer.concat([Uint8Array.from([op]), payload]);
  },
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/voice/util/VoiceWebSocketShim.js test/voice.test.js
git commit -m "feat(voice): teach the voice websocket shim binary frames"
```

---

### Task 3: Lớp bọc DAVESession

**Files:**

- Create: `src/client/voice/networking/DAVESession.js`
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: `Silence.SILENCE_FRAME` từ `src/client/voice/util/Silence.js`.
- Produces, `module.exports = { DAVESession, DAVE_PROTOCOL_VERSION, MISSING_DAVEY }`:
  - `DAVE_PROTOCOL_VERSION: number` — `1` khi có davey, `0` khi thiếu.
  - `MISSING_DAVEY: string` — câu thông báo thiếu davey.
  - `class DAVESession extends EventEmitter`
    - `constructor(protocolVersion, userId, channelId, options = {})`, `options.decryptionFailureTolerance` mặc định `36`
    - `createSession(): object` — điểm để test thay bằng stub
    - `get voicePrivacyCode(): ?string`
    - `reinit(): void` — phát event `keyPackage` với `Buffer`
    - `setExternalSender(buffer): void`
    - `prepareTransition({ transition_id, protocol_version }): boolean` — `true` nghĩa là phải gửi opcode 23
    - `executeTransition(transitionId): boolean`
    - `prepareEpoch({ epoch, protocol_version }): void`
    - `processProposals(payload, connectedClients): ?Buffer` — trả payload cho opcode 28, hoặc `undefined`
    - `processCommit(payload): { transitionId, success }`
    - `processWelcome(payload): { transitionId, success }`
    - `encrypt(packet): Buffer`
    - `decrypt(packet, userId): ?Buffer` — `null` nghĩa là bỏ gói
    - `destroy(): void`
  - Event: `debug(message)`, `keyPackage(buffer)`, `invalidateTransition(transitionId)`

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `Cannot find module '../src/client/voice/networking/DAVESession.js'`

- [ ] **Step 3: Viết DAVESession**

Tạo `src/client/voice/networking/DAVESession.js`:

```js
'use strict';

const EventEmitter = require('node:events');
const Silence = require('../util/Silence');

// `@snazzah/davey` là optionalDependency: nó là binding native, và người chỉ dùng
// REST không có lý do gì phải build nó. Thiếu thì `ClientVoiceManager#joinChannel`
// chặn từ trước, chứ không để rơi xuống close code 4017 chẳng nói cho ai biết gì.
let Davey = null;
try {
  Davey = require('@snazzah/davey');
} catch {
  Davey = null;
}

/**
 * Phiên bản DAVE cao nhất bọc được. `0` nghĩa là không có davey.
 * @type {number}
 */
const DAVE_PROTOCOL_VERSION = Davey ? Davey.DAVE_PROTOCOL_VERSION : 0;

/**
 * @type {string}
 */
const MISSING_DAVEY = [
  'Voice requires the DAVE end-to-end encryption protocol, which Discord has enforced',
  'for every non-stage voice call since March 2026. Without it the voice gateway closes',
  'the connection with 4017.',
  '',
  'Install it: npm i @snazzah/davey',
].join('\n');

/**
 * Số giây một transition cũ còn được coi là hợp lệ.
 * @type {number}
 */
const TRANSITION_EXPIRY = 10;

/**
 * Hạ cấp mất khoảng 3 giây, nhưng kết nối chậm thì lâu hơn. 24 giây là khoảng đệm
 * để gói còn trên đường không bị vứt oan.
 * @type {number}
 */
const TRANSITION_EXPIRY_PENDING_DOWNGRADE = 24;

/**
 * Vào phiên mới thường có vài gói cũ lọt qua và giải mã hỏng. Chỉ khi hỏng liên
 * tiếp quá ngưỡng này mới coi là phiên hỏng thật.
 * @type {number}
 */
const DEFAULT_DECRYPTION_FAILURE_TOLERANCE = 36;

/**
 * `Davey.MediaType.AUDIO`. Viết thẳng số vì đó là `const enum` của NAPI, không đọc
 * được khi davey vắng mặt.
 * @type {number}
 */
const MEDIA_TYPE_AUDIO = 0;

/**
 * Quản lý phiên MLS của giao thức DAVE.
 *
 * Là bản port sang JS của `packages/voice/src/networking/DAVESession.ts` trong
 * discord.js. Giữ nguyên ngữ nghĩa để còn đối chiếu được khi upstream sửa.
 * @extends {EventEmitter}
 * @private
 */
class DAVESession extends EventEmitter {
  constructor(protocolVersion, userId, channelId, options = {}) {
    super();

    /**
     * Phiên bản giao thức đang dùng.
     * @type {number}
     */
    this.protocolVersion = protocolVersion;

    /**
     * @type {Snowflake}
     */
    this.userId = userId;

    /**
     * @type {Snowflake}
     */
    this.channelId = channelId;

    /**
     * Transition cuối cùng đã thi hành.
     * @type {?number}
     */
    this.lastTransitionId = null;

    /**
     * Transition đã báo trước nhưng chưa thi hành, khoá là id và giá trị là phiên bản.
     * @type {Map<number, number>}
     * @private
     */
    this.pendingTransitions = new Map();

    /**
     * Phiên này đã từng bị hạ cấp chưa.
     * @type {boolean}
     * @private
     */
    this.downgraded = false;

    /**
     * @type {number}
     * @private
     */
    this.consecutiveFailures = 0;

    /**
     * @type {number}
     * @private
     */
    this.failureTolerance = options.decryptionFailureTolerance ?? DEFAULT_DECRYPTION_FAILURE_TOLERANCE;

    /**
     * Đang khởi tạo lại vì một transition hỏng.
     * @type {boolean}
     */
    this.reinitializing = false;

    /**
     * Phiên davey bên dưới.
     * @type {?Object}
     */
    this.session = null;
  }

  /**
   * Tạo phiên davey. Tách riêng để test thay được bằng stub.
   * @returns {Object}
   */
  createSession() {
    if (!Davey) throw new Error(MISSING_DAVEY);
    return new Davey.DAVESession(this.protocolVersion, this.userId, this.channelId);
  }

  /**
   * Mã xác thực quyền riêng tư của phiên, `null` khi chưa có phiên.
   * @type {?string}
   * @readonly
   */
  get voicePrivacyCode() {
    if (this.protocolVersion === 0 || !this.session?.voicePrivacyCode) return null;
    return this.session.voicePrivacyCode;
  }

  /**
   * Khởi tạo, hoặc khởi tạo lại, phiên bên dưới.
   */
  reinit() {
    if (this.protocolVersion > 0) {
      if (this.session) {
        this.session.reinit(this.protocolVersion, this.userId, this.channelId);
        this.emit('debug', `Session reinitialized for protocol version ${this.protocolVersion}`);
      } else {
        this.session = this.createSession();
        this.emit('debug', `Session initialized for protocol version ${this.protocolVersion}`);
      }
      this.emit('keyPackage', this.session.getSerializedKeyPackage());
    } else if (this.session) {
      this.session.reset();
      this.session.setPassthroughMode(true, TRANSITION_EXPIRY);
      this.emit('debug', 'Session reset');
    }
  }

  /**
   * @param {Buffer} externalSender Dữ liệu external sender
   */
  setExternalSender(externalSender) {
    if (!this.session) throw new Error('No session available');
    this.session.setExternalSender(externalSender);
    this.emit('debug', 'Set MLS external sender');
  }

  /**
   * @param {Object} data Payload của opcode 21
   * @returns {boolean} Có phải báo lại cho voice server là đã sẵn sàng không
   */
  prepareTransition(data) {
    this.emit('debug', `Preparing for transition (${data.transition_id}, v${data.protocol_version})`);
    this.pendingTransitions.set(data.transition_id, data.protocol_version);

    // Transition id 0 là khởi tạo, thi hành ngay và không cần báo lại.
    if (data.transition_id === 0) {
      this.executeTransition(data.transition_id);
      return false;
    }

    if (data.protocol_version === 0) {
      this.session?.setPassthroughMode(true, TRANSITION_EXPIRY_PENDING_DOWNGRADE);
    }
    return true;
  }

  /**
   * @param {number} transitionId Transition cần thi hành
   * @returns {boolean}
   */
  executeTransition(transitionId) {
    this.emit('debug', `Executing transition (${transitionId})`);
    if (!this.pendingTransitions.has(transitionId)) {
      this.emit('debug', `Received execute transition, but we don't have a pending transition for ${transitionId}`);
      return false;
    }

    const oldVersion = this.protocolVersion;
    this.protocolVersion = this.pendingTransitions.get(transitionId);

    if (oldVersion !== this.protocolVersion && this.protocolVersion === 0) {
      this.downgraded = true;
      this.emit('debug', 'Session downgraded');
    } else if (transitionId > 0 && this.downgraded) {
      this.downgraded = false;
      this.session?.setPassthroughMode(true, TRANSITION_EXPIRY);
      this.emit('debug', 'Session upgraded');
    }

    this.reinitializing = false;
    this.lastTransitionId = transitionId;
    this.emit('debug', `Transition executed (v${oldVersion} -> v${this.protocolVersion}, id: ${transitionId})`);

    this.pendingTransitions.delete(transitionId);
    return true;
  }

  /**
   * @param {Object} data Payload của opcode 24
   */
  prepareEpoch(data) {
    this.emit('debug', `Preparing for epoch (${data.epoch})`);
    if (data.epoch === 1) {
      this.protocolVersion = data.protocol_version;
      this.reinit();
    }
  }

  /**
   * Khởi tạo lại sau một transition hỏng.
   * @param {number} transitionId Transition cần huỷ
   */
  recoverFromInvalidTransition(transitionId) {
    if (this.reinitializing) return;
    this.emit('debug', `Invalidating transition ${transitionId}`);
    this.reinitializing = true;
    this.consecutiveFailures = 0;
    this.emit('invalidateTransition', transitionId);
    this.reinit();
  }

  /**
   * @param {Buffer} payload Payload nhị phân của opcode 27
   * @param {Set<Snowflake>} connectedClients Ai đang trong kênh
   * @returns {?Buffer} Payload cho opcode 28, hoặc `undefined` nếu không có commit
   */
  processProposals(payload, connectedClients) {
    if (!this.session) throw new Error('No session available');

    // Byte đầu là kiểu thao tác (0 append, 1 revoke), phần còn lại mới là proposals.
    const optype = payload.readUInt8(0);
    const { commit, welcome } = this.session.processProposals(
      optype,
      payload.subarray(1),
      Array.from(connectedClients),
    );
    this.emit('debug', 'MLS proposals processed');

    if (!commit) return undefined;
    return welcome ? Buffer.concat([commit, welcome]) : commit;
  }

  /**
   * @param {Buffer} payload Payload nhị phân của opcode 29
   * @returns {{ transitionId: number, success: boolean }}
   */
  processCommit(payload) {
    if (!this.session) throw new Error('No session available');

    const transitionId = payload.readUInt16BE(0);
    try {
      this.session.processCommit(payload.subarray(2));
      this._acceptTransition(transitionId);
      this.emit('debug', `MLS commit processed (transition id: ${transitionId})`);
      return { transitionId, success: true };
    } catch (error) {
      this.emit('debug', `MLS commit errored from transition ${transitionId}: ${error}`);
      this.recoverFromInvalidTransition(transitionId);
      return { transitionId, success: false };
    }
  }

  /**
   * @param {Buffer} payload Payload nhị phân của opcode 30
   * @returns {{ transitionId: number, success: boolean }}
   */
  processWelcome(payload) {
    if (!this.session) throw new Error('No session available');

    const transitionId = payload.readUInt16BE(0);
    try {
      this.session.processWelcome(payload.subarray(2));
      this._acceptTransition(transitionId);
      this.emit('debug', `MLS welcome processed (transition id: ${transitionId})`);
      return { transitionId, success: true };
    } catch (error) {
      this.emit('debug', `MLS welcome errored from transition ${transitionId}: ${error}`);
      this.recoverFromInvalidTransition(transitionId);
      return { transitionId, success: false };
    }
  }

  /**
   * @param {number} transitionId Transition vừa nhận được
   * @private
   */
  _acceptTransition(transitionId) {
    if (transitionId === 0) {
      this.reinitializing = false;
      this.lastTransitionId = transitionId;
    } else {
      this.pendingTransitions.set(transitionId, this.protocolVersion);
    }
  }

  /**
   * @param {Buffer} packet Gói opus
   * @returns {Buffer}
   */
  encrypt(packet) {
    if (this.protocolVersion === 0 || !this.session?.ready || packet.equals(Silence.SILENCE_FRAME)) return packet;
    return this.session.encryptOpus(packet);
  }

  /**
   * @param {Buffer} packet Gói opus đã qua giải mã transport
   * @param {Snowflake} userId Người gửi
   * @returns {?Buffer} `null` nghĩa là bỏ gói này
   */
  decrypt(packet, userId) {
    const canDecrypt = this.session?.ready && (this.protocolVersion !== 0 || this.session?.canPassthrough(userId));
    if (packet.equals(Silence.SILENCE_FRAME) || !canDecrypt || !this.session) return packet;

    try {
      const buffer = this.session.decrypt(userId, MEDIA_TYPE_AUDIO, packet);
      this.consecutiveFailures = 0;
      return buffer;
    } catch (error) {
      if (this.reinitializing) {
        this.emit('debug', 'Failed to decrypt a packet (reinitializing session)');
      } else if (this.pendingTransitions.size > 0) {
        this.emit('debug', `Failed to decrypt a packet (${this.pendingTransitions.size} pending transition[s])`);
      } else {
        this.consecutiveFailures++;
        this.emit('debug', `Failed to decrypt a packet (${this.consecutiveFailures} consecutive fails)`);
        if (this.consecutiveFailures > this.failureTolerance) {
          // Upstream kiểm `if (this.lastTransitionId)`, nên transition 0 — chính là
          // transition khởi tạo, trường hợp thường gặp nhất — rơi vào nhánh ném lỗi
          // thay vì nhánh phục hồi. So với `null` để 0 vẫn phục hồi được.
          if (this.lastTransitionId === null) throw error;
          this.recoverFromInvalidTransition(this.lastTransitionId);
        }
      }
    }

    return null;
  }

  destroy() {
    try {
      this.session?.reset();
    } catch {
      // Phiên đã chết rồi thì không có gì để dọn.
    }
  }
}

module.exports = { DAVESession, DAVE_PROTOCOL_VERSION, MISSING_DAVEY };
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 5: Chạy cả bộ test**

Run: `npm test`
Expected: PASS. Test `moi file trong stack voice nap duoc` phải nạp được file mới mà không ném — đó là chỗ chứng minh `require` davey đã bọc đúng.

- [ ] **Step 6: Commit**

```bash
git add src/client/voice/networking/DAVESession.js test/voice.test.js
git commit -m "feat(voice): wrap @snazzah/davey in a DAVE session"
```

---

### Task 4: VoiceWebSocket nói DAVE

**Files:**

- Modify: `src/client/voice/networking/VoiceWebSocket.js:33-51` (constructor), `:112-121` (`send`), `:136-164` (`onOpen`, `onMessage`), `:198-263` (`onPacket`)
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: `VoiceOpcodes.*` (Task 1), `WebSocket.packBinary`/`unpack` (Task 2), `DAVE_PROTOCOL_VERSION` (Task 3), `connection.identifyExtras` (Task 5 — trong task này chỉ đọc, `undefined` thì spread ra rỗng).
- Produces:
  - `websocket.connectedClients: Set<Snowflake>`
  - `websocket.sendBinary(op, payload): Promise<void>`
  - Event `daveMessage({ op, d })` cho opcode 21, 22, 24
  - Event `daveBinary({ op, payload })` cho mọi frame nhị phân

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `packet.d.max_dave_protocol_version` là `undefined`, `websocket.connectedClients` là `undefined`, `websocket.sendBinary is not a function`

- [ ] **Step 3: Sửa VoiceWebSocket**

Thêm import ở đầu `src/client/voice/networking/VoiceWebSocket.js`, ngay dưới dòng `const { Opcodes, VoiceOpcodes } = require('../util/VoiceConstants');`:

```js
const { DAVE_PROTOCOL_VERSION } = require('./DAVESession');
```

Trong constructor, ngay trước `this.dead = false;`, thêm:

```js
/**
 * Ai đang trong kênh. DAVE cần danh sách này để kiểm người mới khi xử lý proposals.
 * @type {Set<Snowflake>}
 */
this.connectedClients = new Set();
```

Thay `send` để nó nhận mô tả riêng cho frame nhị phân:

```js
  /**
   * Sends data to the WebSocket if it is open.
   * @param {string|Buffer} data The data to send to the WebSocket
   * @param {string} [description] Mô tả cho log, vì Buffer in ra thì vô nghĩa
   * @returns {Promise<string>}
   */
  send(data, description = data) {
    this.emit('debug', `[WS] >> ${description}`);
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WS_NOT_OPEN', data);
      this.ws.send(data, null, error => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }

  /**
   * Gửi một frame nhị phân của DAVE.
   * @param {number} op Opcode
   * @param {Buffer} payload Nội dung
   * @returns {Promise<string>}
   */
  sendBinary(op, payload) {
    return this.send(WebSocket.packBinary(op, payload), `binary op ${op}, ${payload.length} bytes`);
  }
```

Thay `onOpen`:

```js
  onOpen() {
    this.emit('debug', `[WS] opened at gateway ${this.connection.authentication.endpoint}`);
    this.sendPacket({
      op: VoiceOpcodes.IDENTIFY,
      d: {
        server_id: this.connection.serverId || this.connection.channel.guild?.id || this.connection.channel.id,
        user_id: this.client.user.id,
        token: this.connection.authentication.token,
        session_id: this.connection.authentication.sessionId,
        // Khai 0, hoặc bỏ trống, thì Discord đóng bằng 4017. Đây chính là lý do
        // voice của bản port chưa bao giờ vào được kênh.
        max_dave_protocol_version: DAVE_PROTOCOL_VERSION,
        // `streams` và `video` là payload riêng của Go Live. Chỉ `StreamConnection`
        // khai, xem `VoiceConnection#identifyExtras`.
        ...this.connection.identifyExtras,
      },
    }).catch(() => {
      this.emit('error', new Error('VOICE_JOIN_SOCKET_CLOSED'));
    });
  }
```

Thay `onMessage`:

```js
  onMessage(event) {
    try {
      const packet = WebSocket.unpack(event.data);
      // `ws` trả chuỗi cho frame text và Buffer cho frame nhị phân. DAVE là loại thứ hai.
      return typeof event.data === 'string' ? this.onPacket(packet) : this.onBinaryPacket(packet);
    } catch (error) {
      return this.onError(error);
    }
  }

  /**
   * Called whenever a binary DAVE frame is received.
   * @param {Object} frame The parsed frame
   */
  onBinaryPacket({ op, seq, payload }) {
    if (seq) this._sequenceNumber = seq;
    this.emit('debug', `[WS] << binary op ${op}, ${payload.length} bytes`);
    /**
     * Emitted whenever a binary DAVE frame is received.
     * @param {Object} frame
     * @event VoiceWebSocket#daveBinary
     */
    this.emit('daveBinary', { op, payload });
  }
```

Trong `onPacket`, thêm các case sau ngay trước `default:`:

```js
      case VoiceOpcodes.CLIENTS_CONNECT:
        for (const id of packet.d.user_ids) this.connectedClients.add(id);
        break;
      case VoiceOpcodes.DAVE_PREPARE_TRANSITION:
      case VoiceOpcodes.DAVE_EXECUTE_TRANSITION:
      case VoiceOpcodes.DAVE_PREPARE_EPOCH:
        /**
         * Emitted whenever a JSON DAVE packet is received.
         * @param {Object} packet
         * @event VoiceWebSocket#daveMessage
         */
        this.emit('daveMessage', packet);
        break;
```

Trong case `VoiceOpcodes.CLIENT_DISCONNECT`, thêm dòng đầu tiên:

```js
this.connectedClients.delete(packet.d.user_id);
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 5: Chạy cả bộ test**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/client/voice/networking/VoiceWebSocket.js test/voice.test.js
git commit -m "feat(voice): declare DAVE support in the voice IDENTIFY"
```

---

### Task 5: Vòng đời session trong VoiceConnection

**Files:**

- Modify: `src/client/voice/VoiceConnection.js:115-121` (state), `:536-551` (`connect`), `:557-568` (`onSessionDescription`), `:501-520` (`cleanup`), `:917` (`StreamConnection`)
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: `DAVESession` (Task 3), event `daveMessage`/`daveBinary` và `sendBinary`/`connectedClients` (Task 4).
- Produces:
  - `connection.dave: ?DAVESession`
  - `connection.identifyExtras: Object` — `{}` trên `VoiceConnection`, payload Go Live trên `StreamConnection`
  - `module.exports.StreamConnection` — hiện `StreamConnection` là lớp riêng của module, không test được từ ngoài. Task này gắn nó lên `module.exports`.
  - `connection.createDaveSession(protocolVersion): ?DAVESession`
  - `connection.onDaveMessage(packet): void`
  - `connection.onDaveBinary({ op, payload }): void`

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
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
  connection.client = { user: { id: '111' } };
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

test('identifyExtras rong o voice thuong, co payload Go Live o StreamConnection', () => {
  const VoiceConnection = require('../src/client/voice/VoiceConnection.js');
  const { StreamConnection } = VoiceConnection;

  assert.deepStrictEqual(Object.create(VoiceConnection.prototype).identifyExtras, {});

  const extras = Object.create(StreamConnection.prototype).identifyExtras;
  assert.strictEqual(extras.video, true);
  assert.strictEqual(extras.streams[0].type, 'screen');
  assert.strictEqual(extras.streams[0].rid, '100');
  assert.strictEqual(extras.streams[0].quality, 100);
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `connection.createDaveSession is not a function`, `identifyExtras` là `undefined`

- [ ] **Step 3: Sửa VoiceConnection**

Thêm import ở đầu `src/client/voice/VoiceConnection.js`, cạnh `const VoiceWebSocket = require('./networking/VoiceWebSocket');`:

```js
const { DAVESession } = require('./networking/DAVESession');
```

Trong constructor, ngay sau `this.ssrcMap = new Map();`, thêm:

```js
/**
 * Phiên DAVE của kết nối này, `null` khi voice server khai phiên bản 0.
 * @type {?DAVESession}
 */
this.dave = null;
```

Thêm getter và các hàm xử lý vào `VoiceConnection` (đặt ngay trước `onStartSpeaking`):

```js
  /**
   * Field riêng nhét thêm vào IDENTIFY.
   *
   * Voice thường không có gì. `StreamConnection` mới cần `streams` và `video`, và
   * bản port cũ gửi chúng trong mọi IDENTIFY — Discord không hề đòi thứ đó cho một
   * kết nối voice bình thường.
   * @type {Object}
   * @readonly
   * @private
   */
  get identifyExtras() {
    return {};
  }

  /**
   * Tạo phiên DAVE theo phiên bản voice server khai trong SESSION_DESCRIPTION.
   * @param {number} protocolVersion Phiên bản giao thức
   * @returns {?DAVESession}
   * @private
   */
  createDaveSession(protocolVersion) {
    if (!protocolVersion) return null;

    const dave = new DAVESession(protocolVersion, this.client.user.id, this.channel.id);
    dave.on('debug', message => this.emit('debug', `[DAVE] ${message}`));
    dave.on('error', error => this.emit('error', error));
    dave.on('keyPackage', keyPackage =>
      this.sockets.ws?.sendBinary(VoiceOpcodes.DAVE_MLS_KEY_PACKAGE, keyPackage).catch(() => null),
    );
    dave.on('invalidateTransition', transitionId =>
      this.sockets.ws
        ?.sendPacket({
          op: VoiceOpcodes.DAVE_MLS_INVALID_COMMIT_WELCOME,
          d: { transition_id: transitionId },
        })
        .catch(() => null),
    );
    return dave;
  }

  /**
   * Xử lý opcode DAVE dạng JSON.
   * @param {Object} packet Gói nhận được
   * @private
   */
  onDaveMessage(packet) {
    if (!this.dave) return;

    if (packet.op === VoiceOpcodes.DAVE_PREPARE_TRANSITION) {
      if (this.dave.prepareTransition(packet.d)) this._sendTransitionReady(packet.d.transition_id);
    } else if (packet.op === VoiceOpcodes.DAVE_EXECUTE_TRANSITION) {
      this.dave.executeTransition(packet.d.transition_id);
    } else if (packet.op === VoiceOpcodes.DAVE_PREPARE_EPOCH) {
      this.dave.prepareEpoch(packet.d);
    }
  }

  /**
   * Xử lý frame DAVE dạng nhị phân.
   * @param {Object} frame Frame nhận được
   * @private
   */
  onDaveBinary({ op, payload }) {
    if (!this.dave) return;

    if (op === VoiceOpcodes.DAVE_MLS_EXTERNAL_SENDER) {
      this.dave.setExternalSender(payload);
    } else if (op === VoiceOpcodes.DAVE_MLS_PROPOSALS) {
      const response = this.dave.processProposals(payload, this.sockets.ws.connectedClients);
      if (response) this.sockets.ws.sendBinary(VoiceOpcodes.DAVE_MLS_COMMIT_WELCOME, response).catch(() => null);
    } else if (op === VoiceOpcodes.DAVE_MLS_ANNOUNCE_COMMIT_TRANSITION) {
      const { transitionId, success } = this.dave.processCommit(payload);
      if (success && transitionId !== 0) this._sendTransitionReady(transitionId);
    } else if (op === VoiceOpcodes.DAVE_MLS_WELCOME) {
      const { transitionId, success } = this.dave.processWelcome(payload);
      if (success && transitionId !== 0) this._sendTransitionReady(transitionId);
    }
  }

  /**
   * @param {number} transitionId Transition đã sẵn sàng
   * @private
   */
  _sendTransitionReady(transitionId) {
    this.sockets.ws
      ?.sendPacket({ op: VoiceOpcodes.DAVE_TRANSITION_READY, d: { transition_id: transitionId } })
      .catch(() => null);
  }
```

Trong `connect()`, sau dòng `ws.on('startStreaming', this.onStartStreaming.bind(this));`, thêm:

```js
ws.on('daveMessage', this.onDaveMessage.bind(this));
ws.on('daveBinary', this.onDaveBinary.bind(this));
```

Trong `onSessionDescription(data)`, ngay sau `Object.assign(this.authentication, data);`, thêm:

```js
// Voice server khai phiên bản DAVE ở đây, cạnh `mode` và `secret_key` — không
// phải ở READY.
this.dave?.destroy();
this.dave = this.createDaveSession(data.dave_protocol_version);
```

Trong `cleanup()`, ngay sau `this.emit('debug', 'Connection clean up');`, thêm:

```js
this.dave?.destroy();
this.dave = null;
```

Và trong `cleanup()`, thêm hai dòng vào khối `if (ws) { ... }`:

```js
ws.removeAllListeners('daveMessage');
ws.removeAllListeners('daveBinary');
```

Thêm getter vào `StreamConnection` (đặt ngay sau constructor của nó):

```js
  /**
   * Go Live khai luồng ngay trong IDENTIFY. Đây là nơi duy nhất payload đó thuộc về.
   * @type {Object}
   * @readonly
   * @private
   */
  get identifyExtras() {
    return {
      streams: [{ type: 'screen', rid: '100', quality: 100 }],
      video: true,
    };
  }
```

Cuối file, thay dòng export bằng:

```js
module.exports = VoiceConnection;
// `StreamConnection` vốn là lớp riêng của module. Gắn ra ngoài để test khoá được
// phần IDENTIFY của Go Live, thứ dễ hỏng nhất khi tách `streams` khỏi voice thường.
module.exports.StreamConnection = StreamConnection;
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 5: Chạy cả bộ test**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/client/voice/VoiceConnection.js test/voice.test.js
git commit -m "feat(voice): drive the DAVE handshake from the voice connection"
```

---

### Task 6: Mã hoá đầu cuối cho audio

**Files:**

- Modify: `src/client/voice/dispatcher/BaseDispatcher.js:348-393`
- Modify: `src/client/voice/receiver/PacketHandler.js:231-245`
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: `connection.dave` (Task 5).
- Produces:
  - `dispatcher._daveEncrypt(buffer): Buffer`
  - `packetHandler._daveDecrypt(packet, userId): ?Object`

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
test('audio duoc E2EE truoc khi ma hoa transport, video thi khong', () => {
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `dispatcher._daveEncrypt is not a function`, `handler._daveDecrypt is not a function`

- [ ] **Step 3: Cắm vào dispatcher**

Trong `src/client/voice/dispatcher/BaseDispatcher.js`, thêm hàm ngay trước `_createPacket`:

```js
  /**
   * Mã hoá đầu cuối một gói opus.
   *
   * Lớp này nằm **trong** lớp mã hoá transport: Discord vẫn giải được lớp ngoài để
   * định tuyến, nhưng không đọc được nội dung.
   * @param {Buffer} buffer Gói opus
   * @returns {Buffer}
   * @private
   */
  _daveEncrypt(buffer) {
    const { dave } = this.player.voiceConnection;
    return dave ? dave.encrypt(buffer) : buffer;
  }
```

Trong `_createPacket`, thay dòng `return` cuối:

```js
// Chỉ audio. Video chưa được DAVE hoá trong bản này.
const payload = this.getTypeDispatcher() === 'video' ? buffer : this._daveEncrypt(buffer);
return Buffer.concat([rtpHeader, ...this._encrypt(payload, rtpHeader)]);
```

- [ ] **Step 4: Cắm vào PacketHandler**

Trong `src/client/voice/receiver/PacketHandler.js`, thêm hàm ngay trước `push`:

```js
  /**
   * Giải mã đầu cuối phần payload của một gói đã qua giải mã transport.
   * @param {Object|Error} packet Gói đã parse
   * @param {Snowflake} userId Người gửi
   * @returns {?Object} `null` nghĩa là bỏ gói này
   * @private
   */
  _daveDecrypt(packet, userId) {
    const { dave } = this.receiver.connection;
    if (!dave || packet instanceof Error || !packet.payload) return packet;
    if (packet.header.payloadType !== getPayloadType('opus')) return packet;

    const payload = dave.decrypt(packet.payload, userId);
    if (payload === null) return null;

    packet.payload = payload;
    return packet;
  }
```

Trong `push`, thay nhánh audio:

```js
    if (this.connection.ssrcMap.has(ssrc)) {
      userStat = this.connection.ssrcMap.get(ssrc); // Audio_ssrc
      packet = this._daveDecrypt(this.parseBuffer(buffer), userStat.userId);
      if (packet === null) return;
      this.audioReceiver(ssrc, userStat, packet);
      this.audioReceiverForStream(ssrc, userStat, packet);
    } else if (this.connection.ssrcMap.has(ssrc - 1)) {
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 6: Chạy cả bộ test**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/client/voice/dispatcher/BaseDispatcher.js src/client/voice/receiver/PacketHandler.js test/voice.test.js
git commit -m "feat(voice): end-to-end encrypt the audio that actually travels"
```

---

### Task 7: Dependency và thông báo khi thiếu davey

**Files:**

- Modify: `package.json`
- Modify: `src/client/voice/ClientVoiceManager.js:103-116`
- Test: `test/voice.test.js`

**Interfaces:**

- Consumes: `DAVE_PROTOCOL_VERSION`, `MISSING_DAVEY` (Task 3).
- Produces: `joinChannel` ném `Error(MISSING_DAVEY)` khi `DAVE_PROTOCOL_VERSION === 0`.

- [ ] **Step 1: Viết test hỏng**

Thêm vào cuối `test/voice.test.js`:

```js
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
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `node --test test/voice.test.js`
Expected: FAIL — `joinChannel` không ném gì về davey (nó ném lỗi khác, hoặc treo ở bước resolve kênh)

- [ ] **Step 3: Cài dependency**

Run:

```bash
npm i --save-optional @snazzah/davey
```

Kiểm tra `package.json` có:

```json
  "optionalDependencies": {
    "@snazzah/davey": "^0.1.12",
    "zlib-sync": "^0.1.9"
  }
```

- [ ] **Step 4: Chặn sớm trong joinChannel**

Trong `src/client/voice/ClientVoiceManager.js`, thêm import cạnh `const VoiceConnection = require('./VoiceConnection');`:

```js
const DAVESessionModule = require('./networking/DAVESession');
```

Đừng destructure ở đây: destructure khoá giá trị ngay lúc nạp module, và test ở Step 1 cần thay được `DAVE_PROTOCOL_VERSION` lúc chạy.

Trong `joinChannel`, đặt ngay dòng đầu tiên của thân hàm, **trước** `channel = this.client.channels.resolve(channel);`:

```js
// Không có davey thì voice gateway đóng bằng 4017 sau vài giây, và 4017 không
// nói cho ai biết phải cài gì. Chặn ở đây để câu lỗi còn dùng được.
if (DAVESessionModule.DAVE_PROTOCOL_VERSION === 0) throw new Error(DAVESessionModule.MISSING_DAVEY);
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `node --test test/voice.test.js`
Expected: PASS

- [ ] **Step 6: Chạy cả bộ test**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/client/voice/ClientVoiceManager.js test/voice.test.js
git commit -m "feat(voice): fail loudly when the DAVE binding is missing"
```

---

### Task 8: Chạy smoke thật và ghi lại kết quả

**Files:**

- Modify: `scripts/smoke/results.md`
- Modify: `scripts/smoke/README.md`, `scripts/smoke/README.vi.md`
- Modify: `docs/API.md`, `docs/API.vi.md`

**Interfaces:**

- Consumes: toàn bộ Task 1–7.
- Produces: không có code mới.

- [ ] **Step 1: Kiểm tra toàn bộ trước khi chạm mạng**

Run: `npm test && npm run lint`
Expected: PASS cả hai. Đếm số test và ghi lại con số.

- [ ] **Step 2: Chạy smoke voice thật**

Cần `.env` có `DISCORD_TOKEN` và `SMOKE_VOICE_CHANNEL_ID` trỏ vào một voice channel vắng mà tài khoản có quyền Connect và Speak.

Run:

```bash
SMOKE_ALLOW_WRITE=1 npm run smoke:voice
```

Expected: không còn dòng `4017`. Trong log debug phải thấy `SESSION_DESCRIPTION` kèm `dave_protocol_version`, và các dòng `[DAVE]`.

- [ ] **Step 3: Ghi kết quả thật, không ghi kết quả mong muốn**

Cập nhật bảng ở cuối `scripts/smoke/results.md` bằng đúng những gì Step 2 in ra. `joinChannel` PASS thì ghi PASS. Nếu lộ ra lớp lỗi mới ở UDP hay RTP thì ghi FAIL kèm câu lỗi thật — đó là tiến bộ, không phải thất bại, vì lớp đó cũng chưa từng chạy.

Viết lại đoạn văn xuôi về voice trong `scripts/smoke/results.md` (hiện ở khoảng dòng 88–113): bỏ phần nói 4017 là bức tường không vượt được, thay bằng cái đã làm và cái còn lại. Giữ nguyên giọng văn của phần còn lại của tài liệu.

- [ ] **Step 4: Cập nhật tài liệu**

- `scripts/smoke/README.md` và `scripts/smoke/README.vi.md`: thêm `@snazzah/davey` vào phần chuẩn bị cho `smoke:voice`.
- `docs/API.md` và `docs/API.vi.md`: sửa phần voice — bỏ mô tả DAVE là blocker, thêm ghi chú `@snazzah/davey` là optionalDependency bắt buộc phải có nếu muốn dùng voice, và video/Go Live vẫn chưa có E2EE.

- [ ] **Step 5: Kiểm tra lần cuối**

Run: `npm test && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke/results.md scripts/smoke/README.md scripts/smoke/README.vi.md docs/API.md docs/API.vi.md
git commit -m "docs(voice): record what DAVE support actually unblocked"
```

---

## Ghi chú cho người thi hành

- Nếu Step 2 của Task 8 vẫn ra 4017, đừng đoán. Bật log debug của connection (`client.on('debug', console.log)` trong `scripts/smoke/voice.mjs`) và đọc payload IDENTIFY thật sự gửi đi. Khả năng cao nhất là `identifyExtras` bị spread nhầm chỗ.
- Nếu ra một close code khác 4017, đó là bằng chứng DAVE đã qua. Ghi lại mã đó rồi báo lại, đừng tự mở rộng phạm vi.
- Đừng thêm `sodium` hay `libsodium-wrappers`. `aead_aes256_gcm_rtpsize` đã chạy bằng `node:crypto`, và `SUPPORTED_MODES` đã ưu tiên nó.
