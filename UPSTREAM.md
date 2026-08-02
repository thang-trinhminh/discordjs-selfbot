# Upstream base

| | |
|---|---|
| Repo | https://github.com/discordjs/discord.js |
| Branch | `v14` |
| Commit | `8047fe7c55d99ed01dfe82b4a260be45081baf26` |
| Version | `14.27.0` |
| Đường dẫn lấy | `packages/discord.js/{src,typings}` |

## Nâng cấp

    ./scripts/sync-upstream.sh <ref-mới>

Script ghi đè `src/` và `typings/`. Xem `git diff` để biết patch selfbot nào bị mất và apply lại.
Sau khi nâng cấp, cập nhật bảng trên.

## Danh sách file upstream đã bị sửa

Mọi sửa đổi lên file upstream phải ghi vào đây kèm lý do một dòng.

| File | Lý do |
|---|---|
| `src/client/BaseClient.js` | Dùng `createSelfbotREST()` thay `new REST()` |
| `src/util/Options.js` | Thêm default cho user account: `intents: 0`, `ws.properties`, `ws.capabilities`, `ws.client_state`, `ws.buildStrategy`, `http`, `captchaSolver`, `captchaRetryLimit` |
| `src/client/Client.js` | Cắm `SelfbotShardingStrategy` vào `options.ws.buildStrategy`; thêm manager `relationships`, `sessions`, `notes`, `settings`; trộn `ClientActions` vào prototype (một dòng) |
| `src/client/websocket/handlers/index.js` | Đăng ký handler `RELATIONSHIP_*`, `USER_NOTE_UPDATE`, `USER_SETTINGS_UPDATE`, `USER_GUILD_SETTINGS_UPDATE`, `CALL_*`, `CHANNEL_RECIPIENT_*` |
| `src/client/websocket/handlers/READY.js` | Guard `data.application` (user token không nhận field này); seed relationships, notes, session hash, user settings, guild settings |
| `src/structures/ClientPresence.js` | `_parse` đẩy nguyên payload của builder selfbot và giữ `emoji`; upstream chỉ giữ `type/name/state/url` vì bot không phát được emoji, asset, button, party |
| `src/structures/ClientUser.js` | Trộn `ClientUserActions` vào prototype (một dòng `Object.assign`); ghi đè `edit` vì bản upstream destructure đúng `{ username, avatar, banner }` nên vứt im lặng `password`, `bio`, `pronouns`, `global_name`, `accent_color` |
| `src/structures/Guild.js` | Thêm manager `settings` (setting thông báo của client user cho guild) |
| `src/util/Channels.js` | `createChannel` dựng `GroupDMChannel` thay `PartialGroupDMChannel` (user account dùng group DM đầy đủ) |
| `src/util/Events.js` | Thêm `RelationshipAdd/Remove/Update`, `UserNoteUpdate`, `CallCreate/Update/Delete`, `ChannelRecipientAdd/Remove` |
| `src/index.js` | Export phần selfbot: `RelationshipType`, `Session`, `UserRoutes`, các manager mới |
