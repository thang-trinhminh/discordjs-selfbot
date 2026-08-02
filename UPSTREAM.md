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
| `src/client/Client.js` | Cắm `SelfbotShardingStrategy` vào `options.ws.buildStrategy` |
