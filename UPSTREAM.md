# Upstream base

|               |                                            |
| ------------- | ------------------------------------------ |
| Repo          | https://github.com/discordjs/discord.js    |
| Branch        | `v14`                                      |
| Commit        | `8047fe7c55d99ed01dfe82b4a260be45081baf26` |
| Version       | `14.27.0`                                  |
| Đường dẫn lấy | `packages/discord.js/{src,typings}`        |

## Nâng cấp

    ./scripts/sync-upstream.sh <ref-mới>

Script ghi đè `src/` và `typings/`. Xem `git diff` để biết patch selfbot nào bị mất và apply lại.
Sau khi nâng cấp, cập nhật bảng trên.

## Danh sách file upstream đã bị sửa

Mọi sửa đổi lên file upstream phải ghi vào đây kèm lý do một dòng.

| File                                                                                                             | Lý do                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/BaseClient.js`                                                                                       | Dùng `createSelfbotREST()` thay `new REST()`                                                                                                                                                                                  |
| `src/util/Options.js`                                                                                            | Thêm default cho user account: `intents: 0`, `ws.properties`, `ws.capabilities`, `ws.client_state`, `ws.buildStrategy`, `http`, `captchaSolver`, `captchaRetryLimit`                                                          |
| `src/client/Client.js`                                                                                           | Cắm `SelfbotShardingStrategy` vào `options.ws.buildStrategy`; thêm manager `relationships`, `sessions`, `notes`, `settings`, `billing`; trộn `ClientActions` vào prototype (một dòng)                                         |
| `src/client/websocket/handlers/index.js`                                                                         | Đăng ký handler `RELATIONSHIP_*`, `USER_NOTE_UPDATE`, `USER_SETTINGS_UPDATE`, `USER_GUILD_SETTINGS_UPDATE`, `CALL_*`, `CHANNEL_RECIPIENT_*`, `INTERACTION_MODAL_CREATE`                                                       |
| `src/client/websocket/handlers/READY.js`                                                                         | Guard `data.application` (user token không nhận field này); seed relationships, notes, session hash, user settings, guild settings                                                                                            |
| `src/structures/ClientPresence.js`                                                                               | `_parse` đẩy nguyên payload của builder selfbot và giữ `emoji`; upstream chỉ giữ `type/name/state/url` vì bot không phát được emoji, asset, button, party                                                                     |
| `src/structures/ClientUser.js`                                                                                   | Trộn `ClientUserActions` vào prototype (một dòng `Object.assign`); ghi đè `edit` vì bản upstream destructure đúng `{ username, avatar, banner }` nên vứt im lặng `password`, `bio`, `pronouns`, `global_name`, `accent_color` |
| `src/structures/MessageReaction.js`, `BaseInteraction.js`, `CommandInteraction.js`, `AutocompleteInteraction.js` | Guard `client.application` — tài khoản người dùng không có, upstream giả định luôn có                                                                                                                                         |
| `src/client/actions/Entitlement{Create,Update,Delete}.js`, `handlers/SUBSCRIPTION_{CREATE,UPDATE,DELETE}.js`     | Bỏ qua event khi không có application, thay vì ném                                                                                                                                                                            |
| `src/structures/Guild.js`                                                                                        | Thêm manager `settings` (setting thông báo của client user cho guild)                                                                                                                                                         |
| `src/util/Channels.js`                                                                                           | `createChannel` dựng `GroupDMChannel` thay `PartialGroupDMChannel` (user account dùng group DM đầy đủ)                                                                                                                        |
| `src/managers/UserManager.js`                                                                                    | `fetch` đi qua `/users/:id/profile`; `GET /users/:id` là route bot-only, token người dùng ăn 403 code 40001                                                                                                                   |
| `src/structures/Message.js`                                                                                      | Trộn `MessageInteractionActions` vào prototype (một dòng)                                                                                                                                                                     |
| `src/structures/interfaces/TextBasedChannel.js`                                                                  | `applyToClass` gắn thêm `ChannelInteractionActions`                                                                                                                                                                           |
| `src/client/voice/**`                                                                                            | Thay toàn bộ bằng stack voice kiểu v12 của selfbot-v13; v14 không có voice trong core                                                                                                                                         |
| `src/util/Events.js`                                                                                             | Thêm `GuildMemberSpeaking`, `RelationshipAdd/Remove/Update`, `UserNoteUpdate`, `CallCreate/Update/Delete`, `ChannelRecipientAdd/Remove`, `InteractionModalCreate`                                                             |
| `typings/index.d.ts`                                                                                             | `intents` thành optional; nối thêm khối `//#region Selfbot` ở cuối file dùng declaration merging, nên phần thêm không đụng vào nơi khai báo gốc                                                                               |
| `src/index.js`                                                                                                   | Bật compat layer ở cuối file; export phần selfbot: `RelationshipType`, `Session`, `UserRoutes`, các manager mới                                                                                                               |
