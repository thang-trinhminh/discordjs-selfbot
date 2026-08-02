# Smoke tests

Cần token thật, không chạy trong CI. Token đọc từ biến môi trường, không truyền qua tham số dòng
lệnh (tham số lộ ra trong `ps` và shell history).

    DISCORD_TOKEN='...' node scripts/smoke/login.mjs

| Script | Xác nhận |
|---|---|
| `login.mjs` | P0-P2: REST shim + identify user account + gateway kết nối, `ready` bắn ra, `client.user` đúng |

## Đọc close code khi fail

| Code | Nghĩa | Chỗ nhìn đầu tiên |
|---|---|---|
| `4004` | Authentication failed | Token sai, hoặc `rewriteAuthorization` chưa chạy — kiểm tra header `authorization` không còn prefix `Bot ` |
| `4013` / `4014` | Invalid / disallowed intents | Payload identify vẫn còn `intents` — kiểm tra `patchShardSend` có được gọi trong `spawn()` không |
| `401` ở REST trước khi tới gateway | Interception `/gateway/bot` không khớp path | Log `url` trong `makeRequest` |
