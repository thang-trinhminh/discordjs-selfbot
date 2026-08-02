# discordjs-selfbot-v14 — Foundation (P0–P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng repo `discordjs-selfbot-v14` trên nền `discord.js@14.27.0` sao cho `client.login(userToken)` kết nối được gateway bằng user account và bắn `ready`.

**Architecture:** Bung nguyên `packages/discord.js/{src,typings}` của branch `origin/v14` ra root repo, giữ nguyên upstream. Mọi thứ selfbot-specific nằm trong file mới có tiền tố `Selfbot*` hoặc thư mục riêng, để diff với upstream luôn nhỏ và merge được. Hai điểm chèn: (1) `BaseClient` dùng `createSelfbotREST()` thay `new REST()` — shim này spoof header, sửa `Authorization`, và chặn `/gateway/bot`; (2) `Options.createDefault().ws.buildStrategy` trả `SelfbotShardingStrategy` — subclass của `SimpleShardingStrategy`, patch `shard.send` để viết lại identify payload cho user account.

**Tech Stack:** Node.js >= 20.18, CommonJS, `discord.js@14.27.0` source, `@discordjs/rest`, `@discordjs/ws`, `@discordjs/builders`, `@discordjs/collection`, `@discordjs/formatters`, `@discordjs/util`, `discord-api-types/v10`, `undici`, `zlib-sync`. Test bằng `node:test` + `node:assert` (không thêm framework).

Spec: `docs/superpowers/specs/2026-08-02-selfbot-v14-migration-design.md`

## Global Constraints

- Node.js `>=20.18`. `package.json` phải khai `"engines": { "node": ">=20.18" }`.
- CommonJS (`require`/`module.exports`). Không dùng ESM trong `src/`.
- `@discordjs/rest` và `@discordjs/ws` phải pin **exact version** (không `^`, không `~`). Lý do: shim phụ thuộc chữ ký nội bộ của hai package này.
- Không sửa file upstream trừ khi plan chỉ đích danh. Mọi code selfbot đi vào file mới.
- Base upstream: repo `discord.js`, branch `origin/v14`, commit `8047fe7c5`, version `14.27.0`. Ghi vào `UPSTREAM.md`.
- Repo `discord.js` nằm ở `../discord.js` so với repo này.
- Tên package trong `package.json`: `discordjs-selfbot-v14`.
- Test chạy bằng `node --test test/`. Test không được gọi mạng thật.
- Commit sau mỗi task. Không push (người dùng tự quyết định khi nào push).

---

### Task 1: Scaffold repo từ upstream v14

**Files:**
- Create: `scripts/sync-upstream.sh`
- Create: `UPSTREAM.md`
- Create: `package.json`
- Create: `.gitignore`
- Create: `.eslintrc.json`, `.prettierrc.json`, `.eslintignore`
- Create: `src/**`, `typings/**` (bung từ upstream, không viết tay)
- Test: `test/scaffold.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: cây `src/` load được bằng `require('./src')`; hằng số base upstream trong `UPSTREAM.md`

- [ ] **Step 1: Viết script sync upstream**

Create `scripts/sync-upstream.sh`:

```bash
#!/usr/bin/env bash
# Bung packages/discord.js/{src,typings} từ repo discord.js vào root repo này.
# Dùng cho cả lần đầu lẫn các lần nâng cấp upstream sau này.
#
# Usage: ./scripts/sync-upstream.sh <git-ref>   (mặc định: 8047fe7c5)
set -euo pipefail

REF="${1:-8047fe7c5}"
UPSTREAM_REPO="${UPSTREAM_REPO:-../discord.js}"
DEST="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$UPSTREAM_REPO/.git" ]; then
  echo "Khong tim thay repo discord.js tai $UPSTREAM_REPO" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git -C "$UPSTREAM_REPO" archive "$REF" packages/discord.js/src packages/discord.js/typings \
  | tar -x -C "$TMP"

rm -rf "$DEST/src" "$DEST/typings"
mv "$TMP/packages/discord.js/src" "$DEST/src"
mv "$TMP/packages/discord.js/typings" "$DEST/typings"

echo "Da sync tu $REF"
git -C "$UPSTREAM_REPO" rev-parse "$REF"
```

- [ ] **Step 2: Chạy script, xác nhận file về đúng chỗ**

```bash
chmod +x scripts/sync-upstream.sh
./scripts/sync-upstream.sh 8047fe7c5
find src -name '*.js' | wc -l   # ky vong: > 300
ls typings/index.d.ts
```

- [ ] **Step 3: Ghi UPSTREAM.md**

Create `UPSTREAM.md`:

```markdown
# Upstream base

| | |
|---|---|
| Repo | https://github.com/discordjs/discord.js |
| Branch | `v14` |
| Commit | `8047fe7c5` |
| Version | `14.27.0` |
| Đường dẫn lấy | `packages/discord.js/{src,typings}` |

## Nâng cấp

```sh
./scripts/sync-upstream.sh <ref-mới>
```

Script ghi đè `src/` và `typings/`. Xem `git diff` để biết patch selfbot nào bị mất và apply lại.
Sau khi nâng cấp, cập nhật bảng trên.

## Danh sách file upstream đã bị sửa

Mọi sửa đổi lên file upstream phải ghi vào đây kèm lý do một dòng.

| File | Lý do |
|---|---|
| `src/client/BaseClient.js` | Dùng `createSelfbotREST()` thay `new REST()` |
| `src/util/Options.js` | Thêm default cho user account: `intents: 0`, `ws.properties`, `ws.capabilities`, `ws.client_state`, `ws.buildStrategy`, `captchaSolver`, `captchaRetryLimit` |
```

- [ ] **Step 4: Viết package.json**

Create `package.json`:

```json
{
  "name": "discordjs-selfbot-v14",
  "version": "0.1.0",
  "description": "An unofficial discord.js v14 fork for user accounts",
  "main": "./src/index.js",
  "types": "./typings/index.d.ts",
  "scripts": {
    "test": "node --test test/",
    "lint": "eslint src test scripts",
    "lint:fix": "eslint src test scripts --fix",
    "format": "prettier --write \"src/**/*.js\" \"test/**/*.js\"",
    "test:typescript": "tsc --noEmit"
  },
  "files": ["src", "typings"],
  "engines": { "node": ">=20.18" },
  "license": "Apache-2.0",
  "dependencies": {
    "@discordjs/builders": "^1.11.2",
    "@discordjs/collection": "1.5.3",
    "@discordjs/formatters": "^0.6.1",
    "@discordjs/rest": "2.5.1",
    "@discordjs/util": "^1.1.1",
    "@discordjs/ws": "1.2.3",
    "@sapphire/snowflake": "3.5.5",
    "discord-api-types": "^0.38.50",
    "fast-deep-equal": "3.1.3",
    "lodash.snakecase": "4.1.1",
    "magic-bytes.js": "^1.13.0",
    "tslib": "^2.6.3",
    "undici": "^6.27.0"
  },
  "optionalDependencies": {
    "zlib-sync": "^0.1.9"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "eslint": "^8.39.0",
    "eslint-config-prettier": "^8.8.0",
    "prettier": "^2.8.8",
    "typescript": "^5.5.4"
  }
}
```

Ghi chú: `@discordjs/rest` và `@discordjs/ws` để exact version theo Global Constraints. Các version khác lấy từ `packages/discord.js/package.json` của `origin/v14`; nếu lệch, chạy `git -C ../discord.js show origin/v14:packages/discord.js/package.json` và sửa theo, giữ nguyên hai dòng pin exact.

- [ ] **Step 5: Copy config lint từ selfbot-v13**

```bash
cp ../discord.js-selfbot-v13/.eslintrc.json .
cp ../discord.js-selfbot-v13/.prettierrc.json .
cp ../discord.js-selfbot-v13/.eslintignore .
```

Create `.gitignore`:

```
node_modules/
*.log
.env
```

- [ ] **Step 6: Viết test scaffold (test sẽ fail)**

Create `test/scaffold.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('src/index.js loads', () => {
  const djs = require('../src/index.js');
  assert.strictEqual(typeof djs.Client, 'function');
  assert.strictEqual(typeof djs.Options, 'function');
});

test('upstream version is pinned to 14.27.0', () => {
  const pkg = require('../package.json');
  assert.strictEqual(pkg.dependencies['@discordjs/rest'], '2.5.1');
  assert.strictEqual(pkg.dependencies['@discordjs/ws'], '1.2.3');
  assert.ok(!pkg.dependencies['@discordjs/rest'].startsWith('^'), 'rest phai pin exact');
  assert.ok(!pkg.dependencies['@discordjs/ws'].startsWith('^'), 'ws phai pin exact');
});
```

- [ ] **Step 7: Chạy test, xác nhận fail**

Run: `npm install && node --test test/scaffold.test.js`
Expected: FAIL — `src/index.js` require được nhưng có thể thiếu dependency, hoặc `Cannot find module`.

- [ ] **Step 8: Sửa cho tới khi test pass**

Nếu `require('../src/index.js')` báo thiếu module: thêm đúng package đó vào `dependencies` (lấy version từ `packages/discord.js/package.json` của upstream), chạy lại `npm install`. Lặp tới khi hết.

Nếu báo `Cannot find module '../package.json'` từ trong `src/index.js` (dòng `exports.version = require('../package.json').version`): đó là đường dẫn đúng vì `src/` nằm ở root — không cần sửa.

- [ ] **Step 9: Chạy test, xác nhận pass**

Run: `node --test test/scaffold.test.js`
Expected: PASS, 2 test.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold repo from discord.js v14.27.0 upstream"
```

---

### Task 2: Hằng số selfbot + payload identify

**Files:**
- Create: `src/util/SelfbotDefaults.js`
- Create: `src/util/buildUserIdentify.js`
- Test: `test/buildUserIdentify.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `SelfbotDefaults.DefaultUserAgent: string`
  - `SelfbotDefaults.DefaultSuperProperties: object` (các key KHÔNG có tiền tố `$`)
  - `SelfbotDefaults.DefaultCapabilities: number`
  - `SelfbotDefaults.DefaultClientState: object`
  - `SelfbotDefaults.DefaultCiphers: string[]`
  - `SelfbotDefaults.encodeSuperProperties(properties: object): string` — base64 của JSON
  - `buildUserIdentify({ token, properties, capabilities, clientState, presence }): object` — trả về `d` của payload identify

- [ ] **Step 1: Viết test fail**

Create `test/buildUserIdentify.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const buildUserIdentify = require('../src/util/buildUserIdentify.js');
const { DefaultSuperProperties, DefaultCapabilities, DefaultClientState } = require('../src/util/SelfbotDefaults.js');

const base = {
  token: 'tok',
  properties: DefaultSuperProperties,
  capabilities: DefaultCapabilities,
  clientState: DefaultClientState,
};

test('khong co intents va shard trong payload', () => {
  const d = buildUserIdentify(base);
  assert.ok(!('intents' in d), 'payload user account khong duoc co intents');
  assert.ok(!('shard' in d), 'payload user account khong duoc co shard');
});

test('co token, capabilities, client_state, properties', () => {
  const d = buildUserIdentify(base);
  assert.strictEqual(d.token, 'tok');
  assert.strictEqual(d.capabilities, DefaultCapabilities);
  assert.deepStrictEqual(d.client_state, DefaultClientState);
  assert.strictEqual(d.properties.browser, DefaultSuperProperties.browser);
});

test('strip tien to $ trong properties', () => {
  const d = buildUserIdentify({ ...base, properties: { $os: 'Windows', browser: 'Chrome' } });
  assert.strictEqual(d.properties.os, 'Windows');
  assert.strictEqual(d.properties.browser, 'Chrome');
  assert.ok(!('$os' in d.properties), 'key $os phai bi strip');
});

test('presence chi xuat hien khi duoc truyen', () => {
  assert.ok(!('presence' in buildUserIdentify(base)));
  const withPresence = buildUserIdentify({ ...base, presence: { status: 'online', activities: [] } });
  assert.deepStrictEqual(withPresence.presence, { status: 'online', activities: [] });
});

test('khong mutate object properties dau vao', () => {
  const input = { $os: 'Windows' };
  buildUserIdentify({ ...base, properties: input });
  assert.deepStrictEqual(input, { $os: 'Windows' });
});

test('encodeSuperProperties tra ve base64 cua JSON', () => {
  const { encodeSuperProperties } = require('../src/util/SelfbotDefaults.js');
  const encoded = encodeSuperProperties({ os: 'Windows' });
  assert.strictEqual(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')).os, 'Windows');
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test test/buildUserIdentify.test.js`
Expected: FAIL — `Cannot find module '../src/util/buildUserIdentify.js'`

- [ ] **Step 3: Viết SelfbotDefaults.js**

Create `src/util/SelfbotDefaults.js`:

```js
'use strict';

const { Buffer } = require('node:buffer');

/**
 * User-Agent giả lập Discord desktop app. Phải khớp với `browser_user_agent`
 * trong super properties, nếu không Discord sẽ đánh dấu request bất thường.
 * @type {string}
 */
const DefaultUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/134.0.0.0 Safari/537.36';

/**
 * Super properties gửi kèm mọi request REST (header `x-super-properties`)
 * và trong payload identify của gateway. Key KHÔNG có tiền tố `$` —
 * schema cũ dùng `$os`, Discord đã bỏ.
 * @type {Object}
 */
const DefaultSuperProperties = {
  os: 'Windows',
  browser: 'Chrome',
  device: '',
  system_locale: 'en-US',
  browser_user_agent: DefaultUserAgent,
  browser_version: '134.0.0.0',
  os_version: '10',
  referrer: '',
  referring_domain: '',
  referrer_current: '',
  referring_domain_current: '',
  release_channel: 'stable',
  client_build_number: 384477,
  client_event_source: null,
};

/**
 * Gateway capabilities bitfield.
 * Tham khảo: https://docs.discord.food/topics/gateway#gateway-capabilities
 * @type {number}
 */
const DefaultCapabilities = 161789;

/**
 * Trạng thái cache phía client gửi kèm identify. Client mới thì rỗng hết.
 * @type {Object}
 */
const DefaultClientState = {
  guild_versions: {},
  highest_last_message_id: '0',
  read_state_version: 0,
  user_guild_settings_version: -1,
  user_settings_version: -1,
  private_channels_version: '0',
  api_code_version: 0,
};

/**
 * Danh sách cipher TLS theo thứ tự Chrome dùng. Đặt đúng thứ tự này để
 * TLS fingerprint (JA3) giống browser thay vì giống Node mặc định.
 * @type {string[]}
 */
const DefaultCiphers = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
];

/**
 * Bỏ tiền tố `$` khỏi key của super properties (schema cũ của Discord).
 * Không mutate object đầu vào.
 * @param {Object} properties Super properties thô
 * @returns {Object}
 */
function normalizeSuperProperties(properties) {
  const result = {};
  for (const [key, value] of Object.entries(properties)) {
    result[key.startsWith('$') ? key.slice(1) : key] = value;
  }
  return result;
}

/**
 * Encode super properties thành giá trị header `x-super-properties`.
 * @param {Object} properties Super properties
 * @returns {string} base64
 */
function encodeSuperProperties(properties) {
  return Buffer.from(JSON.stringify(normalizeSuperProperties(properties)), 'utf8').toString('base64');
}

module.exports = {
  DefaultUserAgent,
  DefaultSuperProperties,
  DefaultCapabilities,
  DefaultClientState,
  DefaultCiphers,
  normalizeSuperProperties,
  encodeSuperProperties,
};
```

- [ ] **Step 4: Viết buildUserIdentify.js**

Create `src/util/buildUserIdentify.js`:

```js
'use strict';

const { normalizeSuperProperties } = require('./SelfbotDefaults');

/**
 * Dựng phần `d` của payload identify cho user account.
 *
 * Khác payload của bot ở hai điểm bắt buộc: KHÔNG có `intents` và KHÔNG có
 * `shard`. Gửi kèm hai field đó thì Discord đóng kết nối với code 4013/4004.
 *
 * @param {Object} options Tuỳ chọn
 * @param {string} options.token Token của user
 * @param {Object} options.properties Super properties
 * @param {number} options.capabilities Gateway capabilities bitfield
 * @param {Object} options.clientState Client state
 * @param {Object} [options.presence] Presence ban đầu
 * @returns {Object} payload `d` của op 2
 */
function buildUserIdentify({ token, properties, capabilities, clientState, presence }) {
  const data = {
    token,
    capabilities,
    properties: normalizeSuperProperties(properties),
    client_state: clientState,
    compress: false,
  };

  if (presence) data.presence = presence;

  return data;
}

module.exports = buildUserIdentify;
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `node --test test/buildUserIdentify.test.js`
Expected: PASS, 6 test.

- [ ] **Step 6: Commit**

```bash
git add src/util/SelfbotDefaults.js src/util/buildUserIdentify.js test/buildUserIdentify.test.js
git commit -m "feat: add selfbot defaults and user identify payload builder"
```

---

### Task 3: REST shim — header, authorization, dispatcher

**Files:**
- Create: `src/rest/SelfbotREST.js`
- Modify: `src/client/BaseClient.js` (dòng khai báo `this.rest = new REST(this.options.rest)`)
- Test: `test/selfbotRest.test.js`

**Interfaces:**
- Consumes: `SelfbotDefaults.{DefaultUserAgent,DefaultSuperProperties,DefaultCiphers,encodeSuperProperties}` từ Task 2
- Produces:
  - `createSelfbotREST(clientOptions: object): REST` — instance `REST` của `@discordjs/rest` đã gắn shim
  - `buildSelfbotHeaders(clientOptions: object): Record<string,string>` — export riêng để test được không cần mạng
  - `rewriteAuthorization(headers: object, token: string): object` — bỏ prefix `Bot `/`Bearer `

- [ ] **Step 1: Viết test fail**

Create `test/selfbotRest.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { buildSelfbotHeaders, rewriteAuthorization } = require('../src/rest/SelfbotREST.js');
const { DefaultUserAgent, DefaultSuperProperties } = require('../src/util/SelfbotDefaults.js');

const options = {
  ws: { properties: DefaultSuperProperties },
  http: { headers: {} },
};

test('header co x-super-properties dung base64', () => {
  const headers = buildSelfbotHeaders(options);
  const decoded = JSON.parse(Buffer.from(headers['x-super-properties'], 'base64').toString('utf8'));
  assert.strictEqual(decoded.browser, 'Chrome');
  assert.ok(!('$os' in decoded), 'khong duoc con key co $');
});

test('header co user-agent trung voi browser_user_agent', () => {
  const headers = buildSelfbotHeaders(options);
  assert.strictEqual(headers['user-agent'], DefaultUserAgent);
});

test('header co day du bo sec-ch-ua va origin discord', () => {
  const headers = buildSelfbotHeaders(options);
  for (const key of [
    'accept',
    'accept-language',
    'origin',
    'referer',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'x-discord-locale',
    'x-discord-timezone',
    'x-debug-options',
  ]) {
    assert.ok(key in headers, `thieu header ${key}`);
  }
  assert.strictEqual(headers.origin, 'https://discord.com');
});

test('http.headers cua user ghi de duoc default', () => {
  const headers = buildSelfbotHeaders({
    ...options,
    http: { headers: { 'accept-language': 'vi-VN' } },
  });
  assert.strictEqual(headers['accept-language'], 'vi-VN');
});

test('rewriteAuthorization bo prefix Bot', () => {
  const out = rewriteAuthorization({ authorization: 'Bot abc.def' }, 'abc.def');
  assert.strictEqual(out.authorization, 'abc.def');
});

test('rewriteAuthorization bo prefix Bearer va giu header khac', () => {
  const out = rewriteAuthorization({ Authorization: 'Bearer abc', 'x-keep': '1' }, 'abc');
  assert.strictEqual(out.Authorization, 'abc');
  assert.strictEqual(out['x-keep'], '1');
});

test('rewriteAuthorization khong doi gi khi token da tran', () => {
  const out = rewriteAuthorization({ authorization: 'abc' }, 'abc');
  assert.strictEqual(out.authorization, 'abc');
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test test/selfbotRest.test.js`
Expected: FAIL — `Cannot find module '../src/rest/SelfbotREST.js'`

- [ ] **Step 3: Viết SelfbotREST.js**

Create `src/rest/SelfbotREST.js`:

```js
'use strict';

const { REST, DefaultRestOptions } = require('@discordjs/rest');
const { Agent, ProxyAgent, buildConnector } = require('undici');
const {
  DefaultUserAgent,
  DefaultSuperProperties,
  DefaultCiphers,
  encodeSuperProperties,
} = require('../util/SelfbotDefaults');

/**
 * Header tĩnh mà Discord web client luôn gửi. Thiếu bộ này thì request
 * lộ ra là không phải browser.
 * @param {Object} clientOptions Options của client
 * @returns {Object<string, string>}
 */
function buildSelfbotHeaders(clientOptions) {
  // Fallback vi task nay chay truoc khi Options.createDefault() co ws.properties,
  // va vi user co the truyen ws partial.
  const properties = clientOptions.ws?.properties ?? DefaultSuperProperties;
  const userAgent = properties.browser_user_agent ?? DefaultUserAgent;

  return {
    accept: '*/*',
    'accept-language': 'en-US',
    origin: 'https://discord.com',
    priority: 'u=1, i',
    referer: 'https://discord.com/channels/@me',
    'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': userAgent,
    'x-debug-options': 'bugReporterEnabled',
    'x-discord-locale': 'en-US',
    'x-discord-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'x-super-properties': encodeSuperProperties(properties),
    ...clientOptions.http?.headers,
  };
}

/**
 * `@discordjs/rest` luôn ghép `${authPrefix} ${token}` vào header Authorization.
 * User token gửi trần, không prefix. Sửa tại chỗ trước khi request đi.
 * @param {Object} headers Header của request
 * @param {string} token Token trần
 * @returns {Object} chính object headers đã sửa
 */
function rewriteAuthorization(headers, token) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'authorization') headers[key] = token;
  }
  return headers;
}

/**
 * Dispatcher undici có TLS fingerprint giống Chrome, hoặc proxy nếu được cấu hình.
 * @param {Object} clientOptions Options của client
 * @returns {Dispatcher}
 */
function buildDispatcher(clientOptions) {
  const proxy = clientOptions.http?.agent;
  const ciphers = DefaultCiphers.join(':');

  if (proxy) {
    return new ProxyAgent({ ...(typeof proxy === 'string' ? { uri: proxy } : proxy), ciphers });
  }

  // Agent chu khong phai Client: Client chi phuc vu mot origin, Agent dung
  // duoc cho moi host ma REST co the cham toi.
  return new Agent({ connect: buildConnector({ ciphers }) });
}

/**
 * Tạo instance REST đã gắn shim selfbot.
 * @param {Object} clientOptions Options của client (đã merge default)
 * @returns {REST}
 */
function createSelfbotREST(clientOptions) {
  const dispatcher = buildDispatcher(clientOptions);
  // Token phai lay tai thoi diem request, khong phai luc tao REST.
  let token = null;

  const rest = new REST({
    ...clientOptions.rest,
    headers: buildSelfbotHeaders(clientOptions),
    makeRequest: async (url, init) => {
      if (token) rewriteAuthorization(init.headers, token);
      return DefaultRestOptions.makeRequest(url, { ...init, dispatcher });
    },
  });

  const originalSetToken = rest.setToken.bind(rest);
  rest.setToken = value => {
    token = value;
    return originalSetToken(value);
  };

  return rest;
}

module.exports = { createSelfbotREST, buildSelfbotHeaders, rewriteAuthorization, buildDispatcher };
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `node --test test/selfbotRest.test.js`
Expected: PASS, 7 test.

- [ ] **Step 5: Nối vào BaseClient**

Modify `src/client/BaseClient.js`. Đổi dòng import và dòng khởi tạo `this.rest`:

```js
// truoc:
const { REST } = require('@discordjs/rest');
// sau:
const { createSelfbotREST } = require('../rest/SelfbotREST');
```

```js
// truoc:
this.rest = new REST(this.options.rest);
// sau:
this.rest = createSelfbotREST(this.options);
```

Ghi thêm dòng vào bảng "file upstream đã bị sửa" trong `UPSTREAM.md` nếu chưa có.

- [ ] **Step 6: Thêm test khẳng định BaseClient dùng shim**

Append vào `test/selfbotRest.test.js`:

```js
test('BaseClient dung shim, khong dung REST thuan', () => {
  const BaseClient = require('../src/client/BaseClient.js');
  const client = new BaseClient({ intents: 0 });
  assert.strictEqual(
    typeof client.rest.options.makeRequest,
    'function',
    'makeRequest phai la function do shim gan vao',
  );
  assert.strictEqual(client.rest.options.headers.origin, 'https://discord.com');
  client.destroy();
});
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `node --test test/selfbotRest.test.js`
Expected: PASS, 8 test.

`ws.properties` chưa có trong `Options.createDefault()` ở task này — `buildSelfbotHeaders` đã fallback về `DefaultSuperProperties` nên vẫn chạy. Task 4 sẽ đưa nó vào default.

- [ ] **Step 8: Commit**

```bash
git add src/rest/SelfbotREST.js src/client/BaseClient.js test/selfbotRest.test.js UPSTREAM.md
git commit -m "feat: add selfbot REST shim with browser header spoofing"
```

---

### Task 4: Options mặc định cho user account

**Files:**
- Modify: `src/util/Options.js` (method `createDefault`, khoảng dòng 113-134)
- Test: `test/options.test.js`

**Interfaces:**
- Consumes: `SelfbotDefaults.*` từ Task 2
- Produces: `Options.createDefault()` trả thêm `intents: 0`, `ws.properties`, `ws.capabilities`, `ws.client_state`, `http: { headers: {}, agent: null }`, `captchaSolver: null`, `captchaRetryLimit: 3`

- [ ] **Step 1: Viết test fail**

Create `test/options.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Options = require('../src/util/Options.js');
const { DefaultCapabilities } = require('../src/util/SelfbotDefaults.js');

test('intents mac dinh la 0 nen khong bat user phai truyen', () => {
  assert.strictEqual(Options.createDefault().intents, 0);
});

test('Client khoi tao duoc khong can truyen intents', () => {
  const Client = require('../src/client/Client.js');
  const client = new Client({});
  assert.strictEqual(client.options.intents.bitfield, 0n);
  client.destroy();
});

test('ws co properties, capabilities, client_state', () => {
  const { ws } = Options.createDefault();
  assert.strictEqual(ws.properties.browser, 'Chrome');
  assert.strictEqual(ws.capabilities, DefaultCapabilities);
  assert.strictEqual(typeof ws.client_state, 'object');
});

test('http mac dinh co headers rong va agent null', () => {
  const { http } = Options.createDefault();
  assert.deepStrictEqual(http.headers, {});
  assert.strictEqual(http.agent, null);
});

test('captcha option mac dinh', () => {
  const defaults = Options.createDefault();
  assert.strictEqual(defaults.captchaSolver, null);
  assert.strictEqual(defaults.captchaRetryLimit, 3);
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test test/options.test.js`
Expected: FAIL — `intents` là `undefined`, `ws.properties` là `undefined`.

- [ ] **Step 3: Sửa Options.createDefault**

Modify `src/util/Options.js`. Thêm import ở đầu file, cạnh các require sẵn có:

```js
const {
  DefaultSuperProperties,
  DefaultCapabilities,
  DefaultClientState,
} = require('./SelfbotDefaults');
```

Trong `static createDefault()`, sửa object trả về:

```js
static createDefault() {
  return {
    closeTimeout: 5_000,
    waitGuildTimeout: 15_000,
    shardCount: 1,
    // User account khong dung intents. De 0 de _validateOptions khong nem
    // ClientMissingIntents; gia tri nay bi loai khoi payload identify.
    intents: 0,
    makeCache: this.cacheWithLimits(this.DefaultMakeCacheSettings),
    partials: [],
    failIfNotExists: true,
    enforceNonce: false,
    presence: {},
    sweepers: this.DefaultSweeperSettings,
    ws: {
      large_threshold: 50,
      version: 10,
      properties: { ...DefaultSuperProperties },
      capabilities: DefaultCapabilities,
      client_state: { ...DefaultClientState },
    },
    http: {
      headers: {},
      agent: null,
    },
    captchaSolver: null,
    captchaRetryLimit: 3,
    rest: {
      ...DefaultRestOptions,
      userAgentAppendix: this.userAgentAppendix,
    },
    jsonTransformer: toSnakeCase,
  };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `node --test test/options.test.js`
Expected: PASS, 5 test.

- [ ] **Step 5: Bỏ phần truyền options tay trong test Task 3**

Sửa test `'BaseClient dung shim, khong dung REST thuan'` trong `test/selfbotRest.test.js` thành `new BaseClient({})` (bỏ `{ intents: 0 }`) vì giờ đã có default.

- [ ] **Step 6: Chạy toàn bộ test, xác nhận pass**

Run: `node --test test/`
Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add src/util/Options.js test/options.test.js test/selfbotRest.test.js
git commit -m "feat: add user account defaults to client options"
```

---

### Task 5: Chặn /gateway/bot trong REST shim

**Files:**
- Modify: `src/rest/SelfbotREST.js`
- Test: `test/gatewayRoute.test.js`

**Interfaces:**
- Consumes: `createSelfbotREST` từ Task 3
- Produces: `makeGatewayBotResponse(): ResponseLike` — object có `{ status, statusText, ok, headers, json(), text(), arrayBuffer() }` đủ để `@discordjs/rest` parse

**Bối cảnh:** `@discordjs/ws` gọi `rest.get(Routes.gatewayBot())` = `GET /api/v10/gateway/bot` để lấy gateway URL và session limit. User token bị `401 Unauthorized` ở route này. Shim chặn và trả response tự dựng.

- [ ] **Step 1: Viết test fail**

Create `test/gatewayRoute.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createSelfbotREST, makeGatewayBotResponse } = require('../src/rest/SelfbotREST.js');
const Options = require('../src/util/Options.js');

test('makeGatewayBotResponse tra dung shape @discordjs/ws can', async () => {
  const res = makeGatewayBotResponse();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.ok, true);
  const body = await res.json();
  assert.strictEqual(body.url, 'wss://gateway.discord.gg');
  assert.strictEqual(body.shards, 1);
  assert.strictEqual(body.session_start_limit.max_concurrency, 1);
  assert.strictEqual(typeof body.session_start_limit.reset_after, 'number');
});

test('makeGatewayBotResponse co content-type json', () => {
  const res = makeGatewayBotResponse();
  assert.strictEqual(res.headers.get('content-type'), 'application/json');
});

test('makeRequest chan /gateway/bot truoc khi ra mang', async () => {
  const rest = createSelfbotREST(Options.createDefault());
  // URL tro toi host khong ton tai: neu shim khong chan thi request se loi DNS,
  // nen test pass chung minh duoc la khong co request nao di ra.
  const res = await rest.options.makeRequest('https://invalid.invalid/api/v10/gateway/bot', {
    headers: {},
  });
  const body = await res.json();
  assert.strictEqual(body.url, 'wss://gateway.discord.gg');
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test test/gatewayRoute.test.js`
Expected: FAIL — `makeGatewayBotResponse is not a function`

- [ ] **Step 3: Thêm interception vào SelfbotREST.js**

Thêm hàm này vào `src/rest/SelfbotREST.js`, trên `createSelfbotREST`:

```js
/**
 * `@discordjs/ws` gọi `GET /gateway/bot` để lấy gateway URL và session limit.
 * User token bị 401 ở route đó, nên trả response tự dựng thay vì gọi mạng.
 * Shape phải khớp `RESTGetAPIGatewayBotResult`.
 * @returns {Object} object giống Response đủ cho @discordjs/rest parse
 */
function makeGatewayBotResponse() {
  const body = JSON.stringify({
    url: 'wss://gateway.discord.gg',
    shards: 1,
    session_start_limit: {
      total: 1000,
      remaining: 1000,
      reset_after: 0,
      max_concurrency: 1,
    },
  });

  // Shape phai khop `ResponseLike` cua @discordjs/rest
  // (packages/rest/src/strategies/undiciRequest.ts).
  return {
    body: null,
    bodyUsed: false,
    status: 200,
    statusText: 'OK',
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => JSON.parse(body),
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}
```

Sửa `makeRequest` trong `createSelfbotREST` để chặn trước khi ra mạng:

```js
    makeRequest: async (url, init) => {
      if (new URL(url).pathname.endsWith('/gateway/bot')) {
        return makeGatewayBotResponse();
      }
      if (token) rewriteAuthorization(init.headers, token);
      return DefaultRestOptions.makeRequest(url, { ...init, dispatcher });
    },
```

Thêm `makeGatewayBotResponse` vào `module.exports`.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `node --test test/gatewayRoute.test.js`
Expected: PASS, 3 test.

- [ ] **Step 5: Commit**

```bash
git add src/rest/SelfbotREST.js test/gatewayRoute.test.js
git commit -m "feat: intercept /gateway/bot for user tokens"
```

---

### Task 6: Sharding strategy viết lại identify

**Files:**
- Create: `src/client/websocket/SelfbotShardingStrategy.js`
- Modify: `src/util/Options.js` (thêm `ws.buildStrategy` vào `createDefault`)
- Test: `test/selfbotShardingStrategy.test.js`

**Interfaces:**
- Consumes: `buildUserIdentify` từ Task 2, `Options.createDefault().ws.{properties,capabilities,client_state}` từ Task 4
- Produces:
  - `class SelfbotShardingStrategy extends SimpleShardingStrategy` — constructor `(manager, clientOptions, getToken)`
  - `patchShardSend(shard, clientOptions, getToken): void` — export riêng để test không cần dựng manager thật; `getToken` là hàm không tham số trả về token hiện tại

**Bối cảnh:** `WebSocketShard#identify()` của `@discordjs/ws` dựng payload bot rồi gọi `this.send({ op: GatewayOpcodes.Identify, d })`. Chặn ở `send` là đủ, không phải thay `identify`. Instance-level patch, không đụng prototype toàn cục.

- [ ] **Step 1: Viết test fail**

Create `test/selfbotShardingStrategy.test.js`:

```js
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

test('strategy giu duoc field shards cua upstream', async () => {
  const { Collection } = require('@discordjs/collection');
  const { SimpleShardingStrategy } = require('@discordjs/ws');
  const proto = SimpleShardingStrategy.prototype;
  assert.strictEqual(typeof proto.spawn, 'function', 'upstream doi ten spawn');
  assert.strictEqual(typeof proto.connect, 'function', 'upstream doi ten connect');

  const strategy = new SimpleShardingStrategy({ options: {} });
  assert.ok(strategy.shards instanceof Collection, 'upstream doi ten field shards');
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test test/selfbotShardingStrategy.test.js`
Expected: FAIL — `Cannot find module '../src/client/websocket/SelfbotShardingStrategy.js'`

- [ ] **Step 3: Viết SelfbotShardingStrategy.js**

Create `src/client/websocket/SelfbotShardingStrategy.js`:

```js
'use strict';

const { SimpleShardingStrategy } = require('@discordjs/ws');
const { GatewayOpcodes } = require('discord-api-types/v10');
const buildUserIdentify = require('../../util/buildUserIdentify');

/**
 * Bọc `shard.send` để viết lại payload identify thành dạng user account.
 *
 * `@discordjs/ws` dựng payload cho bot (có `intents`, có `shard`) rồi gọi
 * `this.send(...)`. Discord đóng kết nối nếu user account gửi hai field đó,
 * nên chặn ngay ở `send` — rẻ hơn thay cả method `identify` và không phụ
 * thuộc vào thân hàm `identify` của upstream.
 *
 * Patch ở mức instance, không đụng prototype, nên nhiều client trong cùng
 * process không giẫm lên nhau.
 *
 * @param {WebSocketShard} shard Shard cần patch
 * @param {Object} clientOptions Options của client
 * @param {Function} getToken Hàm trả về token hiện tại
 * @returns {void}
 */
function patchShardSend(shard, clientOptions, getToken) {
  const originalSend = shard.send.bind(shard);

  shard.send = async payload => {
    if (payload?.op !== GatewayOpcodes.Identify) return originalSend(payload);

    return originalSend({
      op: GatewayOpcodes.Identify,
      d: buildUserIdentify({
        token: getToken(),
        properties: clientOptions.ws.properties,
        capabilities: clientOptions.ws.capabilities,
        clientState: clientOptions.ws.client_state,
        presence: payload.d?.presence,
      }),
    });
  };
}

/**
 * Sharding strategy dùng cho user account: giống upstream, chỉ patch thêm
 * `send` của từng shard sau khi spawn.
 * @extends {SimpleShardingStrategy}
 */
class SelfbotShardingStrategy extends SimpleShardingStrategy {
  /**
   * @param {WebSocketManager} manager Manager của @discordjs/ws
   * @param {Object} clientOptions Options của client
   * @param {Function} getToken Hàm trả về token hiện tại
   */
  constructor(manager, clientOptions, getToken) {
    super(manager);
    this.clientOptions = clientOptions;
    this.getToken = getToken;
  }

  async spawn(shardIds) {
    await super.spawn(shardIds);
    for (const shard of this.shards.values()) {
      patchShardSend(shard, this.clientOptions, this.getToken);
    }
  }
}

module.exports = { SelfbotShardingStrategy, patchShardSend };
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `node --test test/selfbotShardingStrategy.test.js`
Expected: PASS, 4 test.

Nếu test cuối fail ở `strategy.shards instanceof Collection`: `@discordjs/ws` đã đổi tên field. Đọc `node_modules/@discordjs/ws/dist/index.js`, tìm tên mới, sửa `spawn()` theo, và ghi lại vào bảng rủi ro trong spec.

- [ ] **Step 5: Thêm chỗ trống cho buildStrategy trong Options**

Modify `src/util/Options.js`. Trong `createDefault()`, thêm vào object `ws`:

```js
    ws: {
      large_threshold: 50,
      version: 10,
      properties: { ...DefaultSuperProperties },
      capabilities: DefaultCapabilities,
      client_state: { ...DefaultClientState },
      buildStrategy: null,
    },
```

Để `null` ở đây vì `buildStrategy` cần tham chiếu tới client, mà `createDefault()` là static. Client sẽ điền ở bước sau.

- [ ] **Step 6: Điền buildStrategy trong Client constructor**

Modify `src/client/Client.js`. Ngay sau dòng `this._validateOptions();` (khoảng dòng 81), trước `this.ws = new WebSocketManager(this);`:

```js
    // `WebSocketManager.js:163` forward option nay sang @discordjs/ws.
    // Dat o day chu khong o Options.createDefault() vi strategy can tham chieu client.
    this.options.ws.buildStrategy ??= manager =>
      new SelfbotShardingStrategy(manager, this.options, () => this.token);
```

Thêm import ở đầu `Client.js`:

```js
const { SelfbotShardingStrategy } = require('./websocket/SelfbotShardingStrategy');
```

- [ ] **Step 7: Thêm test khẳng định Client cắm đúng strategy**

Append vào `test/selfbotShardingStrategy.test.js`:

```js
test('Client cam SelfbotShardingStrategy vao ws.buildStrategy', () => {
  const Client = require('../src/client/Client.js');
  const { SelfbotShardingStrategy } = require('../src/client/websocket/SelfbotShardingStrategy.js');
  const client = new Client({});
  assert.strictEqual(typeof client.options.ws.buildStrategy, 'function');
  const strategy = client.options.ws.buildStrategy({ options: {} });
  assert.ok(strategy instanceof SelfbotShardingStrategy);
  client.destroy();
});
```

- [ ] **Step 8: Chạy toàn bộ test, xác nhận pass**

Run: `node --test test/`
Expected: PASS toàn bộ.

- [ ] **Step 9: Cập nhật UPSTREAM.md**

Thêm dòng vào bảng "file upstream đã bị sửa":

| `src/client/Client.js` | Cắm `SelfbotShardingStrategy` vào `options.ws.buildStrategy` |

- [ ] **Step 10: Commit**

```bash
git add src/client/websocket/SelfbotShardingStrategy.js src/util/Options.js src/client/Client.js test/selfbotShardingStrategy.test.js UPSTREAM.md
git commit -m "feat: rewrite gateway identify payload for user accounts"
```

---

### Task 7: Smoke script login thật

**Files:**
- Create: `scripts/smoke/login.mjs`
- Create: `scripts/smoke/README.md`
- Modify: `package.json` (thêm script `smoke:login`)

**Interfaces:**
- Consumes: toàn bộ Task 1-6
- Produces: cách xác nhận P0-P2 xong bằng token thật

**Lưu ý bảo mật:** script đọc token từ biến môi trường `DISCORD_TOKEN`, không nhận qua tham số dòng lệnh (tham số lộ ra trong `ps` và shell history). Không log token. Không commit token.

- [ ] **Step 1: Viết smoke script**

Create `scripts/smoke/login.mjs`:

```js
// Smoke test P0-P2: login bang user token that va cho su kien ready.
// Chay: DISCORD_TOKEN=... node scripts/smoke/login.mjs
// Khong chay trong CI.
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { Client } = require('../../src/index.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Thieu bien moi truong DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({});
const timeout = setTimeout(() => {
  console.error('FAIL: khong nhan duoc ready sau 30s');
  process.exit(1);
}, 30_000);

client.on('debug', message => console.log('[debug]', message));
client.on('error', error => {
  console.error('FAIL:', error);
  process.exit(1);
});

client.on('ready', () => {
  clearTimeout(timeout);
  console.log('PASS');
  console.log('  user   :', client.user.tag);
  console.log('  id     :', client.user.id);
  console.log('  guilds :', client.guilds.cache.size);
  client.destroy();
  process.exit(0);
});

await client.login(token);
```

- [ ] **Step 2: Viết README cho smoke**

Create `scripts/smoke/README.md`:

```markdown
# Smoke tests

Cần token thật, không chạy trong CI. Token đọc từ biến môi trường, không truyền qua tham số.

```sh
DISCORD_TOKEN='...' node scripts/smoke/login.mjs
```

| Script | Xác nhận |
|---|---|
| `login.mjs` | P0-P2: REST shim + identify user account + gateway kết nối, `ready` bắn ra, `client.user` đúng |
```

- [ ] **Step 3: Thêm script vào package.json**

Trong `"scripts"`, thêm:

```json
    "smoke:login": "node scripts/smoke/login.mjs",
```

- [ ] **Step 4: Chạy smoke với token thật**

Run: `DISCORD_TOKEN='<token>' npm run smoke:login`
Expected: in `PASS` kèm tag, id, số guild.

Nếu đóng kết nối với close code:
- `4004 Authentication failed` → token sai, hoặc `rewriteAuthorization` chưa chạy. Kiểm tra header `authorization` không còn prefix `Bot `.
- `4013 Invalid intent(s)` / `4014 Disallowed intent(s)` → payload identify vẫn còn `intents`. Kiểm tra `patchShardSend` có được gọi không (log trong `spawn`).
- `401` ở REST trước khi tới gateway → interception `/gateway/bot` chưa khớp path. Log `url` trong `makeRequest`.

- [ ] **Step 5: Chạy toàn bộ test và lint**

Run: `npm run lint && node --test test/`
Expected: cả hai sạch.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke package.json
git commit -m "feat: add login smoke test script"
```

---

## Hoàn thành P0–P2 khi

- [ ] `node --test test/` pass toàn bộ
- [ ] `npm run lint` sạch
- [ ] `DISCORD_TOKEN=... npm run smoke:login` in `PASS` kèm đúng username và số guild
- [ ] `UPSTREAM.md` liệt kê đủ 3 file upstream đã sửa: `BaseClient.js`, `Options.js`, `Client.js`

Ba file đó là toàn bộ divergence với upstream ở giai đoạn này. Con số này sẽ tăng ở P3; giữ nó thấp nhất có thể là tiêu chí thiết kế, không phải mong muốn.

## Phần cố tình để lại cho phase sau

| Thứ | Phase |
|---|---|
| Captcha solver + retry | P1 phần còn lại, làm cùng lúc với các endpoint hay dính captcha |
| Cookie jar (`fetch-cookie` + `tough-cookie`) | Cùng captcha |
| Proxy cho WebSocket (REST đã có) | P2 phần còn lại, khi có nhu cầu thật |
| `READY.js` xử lý field riêng của user account | P3 |
| Structures/managers user-only | P3 |
| Compat layer | P7 |
