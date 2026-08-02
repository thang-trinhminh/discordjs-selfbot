# Design: discordjs-selfbot-v14

Ngày: 2026-08-02
Trạng thái: đã duyệt phần 1 (base & chiến lược), chờ duyệt toàn bộ

## 1. Bối cảnh

`discord.js-selfbot-v13@3.7.1` (fork của `discord.js@13.17.1`, có backport một phần `discord.js@14.21`)
đã được maintainer archive. Mục tiêu: dựng lại thư viện trên nền `discord.js@14` để còn merge
được fix từ upstream, đồng thời giữ code consumer hiện tại chạy được với chi phí sửa thấp nhất.

Repo đích: `git@github.com:trickstarcandina/discordjs-selfbot-v14.git` (hiện trống, 0 commit).

### Ràng buộc đã chốt với người dùng

| Ràng buộc | Quyết định |
|---|---|
| API surface | Giữ tương thích v13 tối đa, compat layer bật mặc định |
| Quy mô consumer | Lớn / nhiều project → cần compat + test parity |
| Voice / Video | Port nguyên stack (bao gồm Go Live, screen share) |

### Concern đã nêu (người dùng đã xác nhận vẫn tiếp tục)

Selfbot hỏng chủ yếu do Discord đổi gateway/API, không phải do discord.js cũ. Nền v14 mua
được: merge upstream fix, `discord-api-types` mới, REST/undici hiện đại. Không mua được:
miễn nhiễm với việc Discord đổi API.

## 2. Số liệu khảo sát

Đo bằng cách bung `discord.js@13.17.1` (tag có sẵn trong repo `discord.js`) rồi `diff -r` với
`discord.js-selfbot-v13/src`:

- 290 file upstream v13, 357 file trong selfbot
- **173 file y hệt upstream** (không đụng gì)
- **112 file bị sửa**
- **57 file/thư mục mới**, 5 file bị xoá
- Tổng diff thô ~9.2k dòng trên 50k dòng source

Kết luận: delta selfbot bounded, khả thi để re-apply lên nền v14.

### Phân loại 57 file mới sau khi đối chiếu với `origin/v14`

| Nhóm | Số file | Chi tiết |
|---|---|---|
| **v14 đã có sẵn → khỏi port** | ~20 | `Poll`, `PollAnswer`, `ForumChannel`, `MediaChannel`, `ThreadOnlyChannel`, `VoiceChannelEffect`, `DirectoryChannel`, components v2 (`Container`, `Section`, `Separator`, `TextDisplay`, `Thumbnail`, `MediaGallery`, `MediaGalleryItem`, `UnfurledMediaItem`, `File`), handler `MESSAGE_POLL_VOTE_*` |
| structures user-only | 5 | `CallState`, `GroupDMChannel`, `GuildBoost`, `Session`, `WebEmbed` |
| managers user-only | 7 | `RelationshipManager`, `ClientUserSettingManager`, `GuildSettingManager`, `SessionManager`, `UserNoteManager`, `BillingManager`, `InteractionManager` |
| WS handlers user-only | 17 | `CALL_CREATE/UPDATE/DELETE`, `CHANNEL_RECIPIENT_ADD/REMOVE`, `RELATIONSHIP_ADD/UPDATE/REMOVE`, `USER_SETTINGS_UPDATE`, `USER_GUILD_SETTINGS_UPDATE`, `USER_NOTE_UPDATE`, `USER_REQUIRED_ACTION_UPDATE`, `VOICE_CHANNEL_STATUS_UPDATE`, `INTERACTION_MODAL_CREATE`, `APPLICATION_COMMAND_CREATE/UPDATE/DELETE` |
| util user-only | 6 | `APITypes`, `InviteFlags`, `PremiumUsageFlags`, `PurchasedFlags`, `RemoteAuth`, `Speaking` |
| voice stack | ~30 | `src/client/voice/**` |
| còn lại | ~20 | Chỉ là tên cũ của v13 (`MessageEmbed`, `MessageActionRow`, `BaseCommandInteraction`, `Channel`, `StoreChannel`, `Modal`…) → thuộc compat layer, không phải core |

### File v14 sẽ phải sửa (top theo độ lớn diff v13→selfbot)

`Presence.js` (947 dòng), `interfaces/Application.js` (668), `interfaces/TextBasedChannel.js` (568),
`Client.js` (553), `Message.js` (425), `util/Constants.js` (338), `util/Util.js` (309),
`ClientUser.js` (291), `User.js` (284), `MessageManager.js` (210), `Guild.js` (152),
`GuildMemberManager.js` (136), `DMChannel.js` (132), `rest/*` (~210), `READY.js` (106),
`Options.js` (102), `GuildMember.js` (101), `RoleManager.js` (108).

## 3. Kiến trúc

### 3.1 Base

- Nguồn: branch **`origin/v14`** của repo `discord.js`, hiện ở **14.27.0** (commit `8047fe7c5`).
- Lấy `packages/discord.js/{src,typings}` bung ra root repo, giữ layout giống `discord.js-selfbot-v13`.
- Ghim base vào `UPSTREAM.md`: tên branch + tag + commit SHA.

**Vì sao `origin/v14` chứ không `main`:** `main` đã là v15-dev — API surface đang đổi, xa v13 hơn
nữa, và chưa release. Branch `v14` là dòng ổn định, còn nhận fix. Cả hai branch đều đã dùng
`@discordjs/ws` (xem mục 3.3), nên đây không phải tiêu chí chọn.

**Quy trình nâng cấp upstream về sau** (không dùng `git merge`, vì layout monorepo khác):

```sh
git -C ../discord.js archive <tag-mới> packages/discord.js | tar -x -C /tmp/upstream
diff -r /tmp/upstream-base/src ./src     # patch của mình
diff -r /tmp/upstream-base/src /tmp/upstream/src   # đổi gì ở upstream
```

Ghi thành `scripts/upstream-diff.sh`. Cách này đã được kiểm chứng khi khảo sát delta v13.

### 3.2 REST — dùng `@discordjs/rest` + shim, không vendor

`discord.js-selfbot-v13` patch thẳng `src/rest/APIRequest.js` để: spoof TLS ciphers (JA3),
gắn `x-super-properties` / `sec-ch-ua` / `x-discord-locale` / `x-debug-options`, proxy qua
`undici.ProxyAgent`, retry khi gặp captcha, giữ cookie jar.

v14 không còn `src/rest/` — nó dùng package `@discordjs/rest` (TypeScript, ~2.5k dòng).
Kiểm tra `origin/v14:packages/rest/src/lib/utils/types.ts` xác nhận package này hở đủ hook:

- `makeRequest(url, init)` — override toàn bộ transport
- `headers: Record<string,string>` — static headers spoof
- `agent: Dispatcher | null` — proxy
- `authPrefix` — có option nhưng type chỉ nhận `'Bearer' | 'Bot'`

**Quyết định:** viết `src/rest/SelfbotREST.js` (~250 dòng) thay vì vendor:

- Tạo `undici.Client('https://discord.com', { connect: buildConnector({ ciphers }) })` hoặc
  `ProxyAgent` nếu user cấu hình proxy, đưa vào `makeRequest`.
- Trong `makeRequest`: viết lại header `authorization` thành token trần (bỏ prefix `Bot `),
  gắn headers động (`x-super-properties` base64 từ `client.options.ws.properties`,
  `x-discord-timezone` từ `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Bắt response `400` có `captcha_key` / `captcha_sitekey` → gọi hook `client.options.captchaSolver`
  → gửi lại request kèm `x-captcha-key` / `x-captcha-rqtoken`. Với `@discordjs/rest` đây vẫn là
  một lần gọi HTTP nên rate-limit accounting không lệch.
- Cookie jar (`fetch-cookie` + `tough-cookie`) bọc quanh `makeRequest`.

**Rủi ro:** phụ thuộc chữ ký `makeRequest` của `@discordjs/rest`.
**Giảm thiểu:** pin **exact version** (không dùng `^`), thêm smoke test khẳng định shim còn được gọi.

### 3.3 Gateway

**Đính chính so với bản nháp đầu:** `discord.js@14.27.0` KHÔNG còn WebSocket nội bộ.
Commit `a9e0de428` (`refactor(WebSocketManager): use /ws package internally`, v14.9) đã chuyển sang
package `@discordjs/ws`. File `src/client/websocket/WebSocketShard.js` của v14 chỉ còn 234 dòng
wrapper, không chứa logic `identify`. Bản v14 cuối còn WS nội bộ là ~14.8 (2023) — quá cũ, dùng
sẽ mất 2 năm fix upstream.

**Cách xử lý — không fork `@discordjs/ws`.** Đã verify trên source `origin/v14`:

- `WebSocketShard#send` khai báo `public async send(payload)` (`packages/ws/src/ws/WebSocketShard.ts:430`)
  → patch được ở mức từng instance, không cần đụng prototype toàn cục
- `identify()` build payload rồi gọi `this.send({ op: GatewayOpcodes.Identify, d })`
  (`WebSocketShard.ts:490-551`) → chặn ở `send` là đủ, không phải thay cả `identify`
- `WebSocketManagerOptions.buildStrategy` là option công khai và `SimpleShardingStrategy` được
  export từ `@discordjs/ws` → subclass, override `spawn()`, patch từng shard sau khi `super.spawn()`
- `packages/discord.js/src/client/websocket/WebSocketManager.js:163` **đã** forward
  `ws.buildStrategy` sang `WSWebSocketManager` → không phải sửa file này

Payload identify cho user account: bỏ `intents`, bỏ `shard`; thêm `capabilities`, `client_state`,
`properties` giả lập browser; strip prefix `$` trong `properties`.

**Chặn thứ hai — `/gateway/bot`.** `@discordjs/ws` gọi `Routes.gatewayBot()`
(`WebSocketManager.ts:279`), user token bị 401. REST shim chặn đúng route đó và trả response tự
dựng: `{ url: 'wss://gateway.discord.gg', shards: 1, session_start_limit: { total: 1000,
remaining: 1000, reset_after: 0, max_concurrency: 1 } }`.

**Chặn thứ ba — `intents` bắt buộc.** `Client._validateOptions` (`Client.js:541`) ném
`ClientMissingIntents` khi `options.intents === undefined`. Đặt mặc định `intents: 0` trong
`Options.createDefault()`; giá trị này bị bỏ khỏi payload identify nên vô hại.

`Options.js`: thêm `ws.properties`, `ws.capabilities`, `ws.client_state`, `ws.buildStrategy` mặc
định, `http.headers`, `captchaSolver`, `captchaRetryLimit`, `intents: 0`.

**Rủi ro còn lại:** subclass `SimpleShardingStrategy` truy cập field `shards` (khai báo
`private readonly` trong TS — chỉ là compile-time, runtime vẫn public). Nếu upstream đổi tên field
thì gãy. Giảm thiểu: unit test khẳng định `strategy.shards` là `Collection` sau `spawn()`, gãy sẽ
báo ngay chứ không âm thầm.

### 3.4 Voice / Video

Port nguyên `src/client/voice/**` từ selfbot-v13 (~30 file): `VoiceConnection`,
`ClientVoiceManager`, `dispatcher/{Audio,Video,AnnexB,VPx,Base}`, `networking/{VoiceUDPClient,VoiceWebSocket}`,
`player/MediaPlayer` + `processing/{AnnexBNalSplitter,IvfSplitter,PCMInsertSilence}`,
`receiver/{PacketHandler,Receiver,Recorder}`, `util/{Secretbox,Silence,Socket,PlayInterface,Function}`.

Stack này gần như độc lập với core, chỉ chạm `Client`, `VoiceState`, `Constants`, `Util`.
Việc cần làm chủ yếu là nối dây, không phải viết lại:

- Đổi import `Constants` → enum `discord-api-types` ở chỗ nào v14 đã đổi
- `Util` → `@discordjs/util` cho các hàm đã dời
- Gắn `client.voice = new ClientVoiceManager(client)` trong `Client.js`
- Handler `VOICE_STATE_UPDATE` / `VOICE_SERVER_UPDATE` route về voice manager
- Giữ dependency: `prism-media`, `werift-rtp`, `ws`

### 3.5 Compat layer

Đặt ở `src/compat/`, export mặc định từ `src/index.js`. Ba phần:

**(a) Alias tên class** — file `src/compat/aliases.js`:

| Tên v13 | Map sang v14 |
|---|---|
| `MessageEmbed` | `EmbedBuilder` |
| `MessageAttachment` | `AttachmentBuilder` |
| `MessageActionRow` | `ActionRowBuilder` |
| `MessageButton` | `ButtonBuilder` |
| `MessageSelectMenu` | `StringSelectMenuBuilder` |
| `Modal` | `ModalBuilder` |
| `TextInputComponent` | `TextInputBuilder` |
| `Channel` | `BaseChannel` |
| `CommandInteraction` | `ChatInputCommandInteraction` |
| `BaseCommandInteraction` | `CommandInteraction` |
| `SelectMenuInteraction` | `StringSelectMenuInteraction` |
| `ContextMenuInteraction` | `ContextMenuCommandInteraction` |
| `Permissions` | `PermissionsBitField` |
| `Intents` | shim rỗng (selfbot không dùng intents) |

Kèm method aliases đã bị bỏ ở v14: `MessageEmbed#addField` → `addFields`,
`Channel#isText` → `isTextBased`, `Formatters.*` → hàm từ `@discordjs/formatters`.

**(b) Input coercion** — file `src/compat/coerce.js`: nhận chuỗi SCREAMING_SNAKE của v13 ở các
điểm nhận input rồi đổi sang enum số. Áp cho: `ChannelType`, `ActivityType`, `ButtonStyle`,
`TextInputStyle`, `ApplicationCommandType`, `ApplicationCommandOptionType`,
`GuildDefaultMessageNotifications`, `GuildExplicitContentFilter`, `GuildVerificationLevel`,
`GuildNSFWLevel`, `GuildScheduledEvent{Status,PrivacyLevel,EntityType}`,
`StageInstancePrivacyLevel`, `StickerFormatType`, `WebhookType`, `InviteTargetType`,
`IntegrationExpireBehavior`, `AutoModerationRule*`.

Riêng permission: v13 dùng `SEND_MESSAGES`, v14 dùng `SendMessages` → bảng map riêng trong
`src/compat/permissions.js`, hook vào `PermissionsBitField.resolve`.

**(c) `Constants` shape v13** — `src/compat/constants.js` export `Constants.ChannelTypes.GUILD_TEXT`,
`Constants.MessageTypes`, `Constants.Events`… đúng hình dạng v13 để code cũ so sánh qua hằng số
vẫn chạy.

#### Giới hạn đã biết — không shim được

So sánh literal ở **read side** (`if (channel.type === 'GUILD_TEXT')`) không giữ được.
Lý do: muốn giữ thì phải ép internals v14 quay lại string enum, tức sửa 99 tham chiếu
`ChannelType` trên 18 file, 84 `AuditLogEvent`, 70 `MessageType`, 65 `ComponentType` — divergence
đó phá luôn khả năng merge upstream, tức phá lý do migrate.

**Xử lý thay thế:** `scripts/codemod-v13-to-v14.mjs` — chạy một lần trên từng repo consumer,
rewrite các literal ở vị trí so sánh đã biết. Chạy trên bản copy, in diff, không ghi đè trực tiếp.
Ghi rõ giới hạn này ở đầu `MIGRATION.md`.

### 3.6 Typings

`typings/index.d.ts` của v14 (~7k dòng) + phần selfbot + khai báo compat. Cùng nguồn sự thật với
JS, kiểm bằng `tsc --noEmit` và `tsd`. Compat aliases khai báo kèm `@deprecated` để IDE nhắc user
dời dần sang tên v14.

### 3.7 Cây thư mục đích

```
discordjs-selfbot-v14/
├── src/
│   ├── client/          # từ v14, patch Client.js + websocket/
│   │   └── voice/       # port nguyên từ selfbot-v13
│   ├── managers/        # v14 + 7 manager user-only
│   ├── structures/      # v14 + 5 structure user-only
│   ├── util/            # v14 + 6 util user-only
│   ├── rest/            # SelfbotREST.js (shim quanh @discordjs/rest)
│   ├── compat/          # aliases / coerce / permissions / constants
│   └── index.js
├── typings/
├── scripts/
│   ├── upstream-diff.sh
│   └── codemod-v13-to-v14.mjs
├── examples/            # port từ selfbot-v13
├── docs/
├── UPSTREAM.md          # ghim base branch/tag/SHA
└── MIGRATION.md
```

## 4. Kế hoạch theo phase

Mỗi phase có tiêu chí xong đo được. Không sang phase sau khi phase trước chưa đạt.

### P0 — Scaffold

Bung `origin/v14` `packages/discord.js/{src,typings}` ra root. Viết `package.json`
(deps: `@discordjs/rest` pin exact, `@discordjs/builders`, `@discordjs/collection`,
`@discordjs/formatters`, `@discordjs/util`, `discord-api-types`, `undici`, `ws`, `prism-media`,
`werift-rtp`, `otplib`, `qrcode`, `tough-cookie`, `fetch-cookie`, `find-process`, `tree-kill`).
Copy config lint/prettier từ selfbot-v13. Ghi `UPSTREAM.md`. CI lint + `tsc --noEmit`.

**Xong khi:** `node -e "require('./src')"` chạy không lỗi; `npm run lint` sạch.

### P1 — REST selfbot

`src/rest/SelfbotREST.js`: undici dispatcher + ciphers, header spoof, sửa authorization,
proxy, cookie jar, captcha retry. Nối vào `Client`.

**Xong khi:** script smoke `GET /users/@me` bằng token thật trả về đúng user; unit test (không
network) khẳng định header sinh ra khớp snapshot và authorization không có prefix `Bot `.

### P2 — Gateway

`SelfbotShardingStrategy` (subclass `SimpleShardingStrategy`, patch `shard.send` để viết lại
identify payload), `Options.js` (`ws.properties` / `capabilities` / `client_state` /
`buildStrategy` / `intents: 0`), chặn `/gateway/bot` trong REST shim, `READY.js`.

**Xong khi:** `client.login(token)` phát `ready`, `client.user` đúng, guild cache có dữ liệu.

### P3 — Structures & managers user-only

5 structure + 7 manager + 17 WS handler + 6 util. Sửa các file v14 bị đụng
(`User`, `ClientUser`, `Presence` gồm `CustomStatus` / `RichPresence` / `SpotifyRPC` /
`RichPresenceAssets`, `Message`, `TextBasedChannel`, `Application`, `Guild`, `GuildMember`,
`MessageManager`, `GuildMemberManager`, `RoleManager`, `DMChannel`).

Method của `Client` phải có lại: `QRLogin`, `passLogin`, `logout`, `refreshAttachmentURL`,
`acceptInvite`, `redeemNitro`, `authorizeURL`, `installUserApps`, `deauthorize`,
`authorizedApplications`.

Method của `ClientUser` phải có lại: `edit`, `setUsername`, `setAvatar`, `setBanner`,
`setHypeSquad`, `setAccentColor`, `setAboutMe`, `setGlobalName`, `setPronouns`,
`createFriendInvite`, `getAllFriendInvites`, `revokeAllFriendInvites`, `setSamsungActivity`,
`stopRinging`, `fetchBurstCredit`.

**Xong khi:** smoke script đọc được relationships, settings, sessions, notes; gửi và sửa được
message; set được custom status.

### P4 — Interactions

`InteractionManager` — gửi slash command / click button / chọn select menu / submit modal với tư
cách user. Handler `INTERACTION_MODAL_CREATE`, `APPLICATION_COMMAND_*`.

**Xong khi:** smoke script gọi được một slash command của bot khác và nhận về response.

### P5 — Voice / Video

Port `src/client/voice/**`, nối vào `Client` và các voice handler.

**Xong khi:** join được voice channel, phát được audio; Go Live phát được video.

### P6 — Auth phụ

`RemoteAuth` (đăng nhập QR), TOTP 2FA (`otplib`), captcha handler hoàn chỉnh.

**Xong khi:** flow QR sinh được ảnh QR và hoàn tất login; login có 2FA vượt được.

### P7 — Compat, typings, docs

`src/compat/**`, hoàn thiện `typings/`, `scripts/codemod-v13-to-v14.mjs`, `MIGRATION.md`,
port `examples/` từ selfbot-v13.

**Xong khi:** test parity của compat pass; `tsc --noEmit` và `tsd` sạch; ít nhất một project
consumer thật chạy được sau khi chạy codemod.

## 5. Chiến lược test

Selfbot không test end-to-end tự động được nếu không có token thật. Ba tầng:

1. **Static** — `eslint`, `prettier --check`, `tsc --noEmit`, `tsd`. Chạy trong CI, mọi commit.
2. **Unit, không network** — chỗ nào logic thuần thì test thuần:
   - `compat/coerce` — mọi string v13 map ra đúng enum số (bảng parity, đây là test quan trọng
     nhất vì consumer lớn)
   - `compat/permissions` — `SEND_MESSAGES` ↔ `SendMessages`
   - `SelfbotREST` — header sinh ra khớp snapshot; authorization không prefix; captcha retry gọi
     đúng số lần rồi dừng ở `captchaRetryLimit`
   - identify payload — snapshot, khẳng định không có `intents` / `shard`
   Dùng `node:test` + `assert`, không thêm framework.
3. **Smoke thủ công** — `scripts/smoke/*.mjs`, đọc token từ env, mỗi phase một script như mô tả ở
   phần tiêu chí. Không chạy trong CI.

## 6. Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| `@discordjs/rest` đổi chữ ký `makeRequest` | REST shim gãy khi update | Pin exact version; unit test khẳng định shim được gọi |
| `@discordjs/ws` đổi `WebSocketShard#send` hoặc field `shards` của `SimpleShardingStrategy` | Identify patch gãy | Pin exact version; unit test khẳng định `send` là function và `shards` là `Collection` sau `spawn()` |
| Read-side string comparison không shim được | Code consumer cần sửa | Codemod script + ghi rõ trong `MIGRATION.md` |
| Voice stack kiểu v12 lệch với cấu trúc v14 | P5 kéo dài | Stack độc lập, chỉ chạm 4 điểm; nếu bí thì tách thành package phụ |
| Discord đổi API giữa chừng | Toàn bộ lib | Không tránh được — đây là bản chất selfbot; đã nêu với người dùng |
| Fork lệch upstream dần | Mất lý do migrate | Cấm chỉnh internals chỉ để chiều API v13; mọi tương thích phải nằm trong `src/compat/` |

## 7. Ngoài phạm vi

- Không hỗ trợ bot token (lib này chỉ cho user account)
- Không dựng docs website (docgen) ở các phase trên
- Không publish npm; dùng qua git URL cho tới khi ổn định
- Không sửa các repo consumer ngoài việc cung cấp codemod và `MIGRATION.md`
