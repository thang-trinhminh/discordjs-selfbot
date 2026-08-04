[English](./README.md) | **Tiếng Việt**

# Smoke tests

Cần token thật, không chạy trong CI. Token đọc từ biến môi trường, không truyền qua tham số dòng
lệnh (tham số lộ ra trong `ps` và shell history).

    node --env-file=.env scripts/smoke/readonly.mjs

| Script         | Xác nhận                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.mjs`    | P0-P2: REST shim + identify user account + gateway kết nối, `ready` bắn ra, `client.user` đúng                                                                                                            |
| `readonly.mjs` | 15 check chỉ đọc trong **một** phiên login: relationships, guild settings, settings, sessions, notes, profile, thanh toán, lời mời kết bạn, app đã cấp quyền, refresh attachment, tìm application command |

Kết quả từng lần chạy nằm ở [`results.md`](results.md) — mỗi lần chạy một khối, mỗi check một dòng,
chỉ ngày và pass/fail, không có số liệu tài khoản.

Hai check tự skip khi thiếu đầu vào thay vì fail: `refreshAttachmentURL()` cần `SMOKE_ATTACHMENT_URL`
(một link `cdn.discordapp.com` đã hết hạn), và `notes.fetch()` cần có bạn bè trong cache.

Mỗi lần chạy tốn một identify. Discord đánh dấu tài khoản reconnect liên tục, nên `readonly.mjs` gom
cả 15 check vào một phiên và nghỉ `SMOKE_CALL_DELAY_MS` (mặc định 2s) giữa các request — khoảng 35s
một lần chạy. Giãn các lần chạy ra ít nhất 30s.

## Đọc close code khi fail

| Code                               | Nghĩa                                       | Chỗ nhìn đầu tiên                                                                                          |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `4004`                             | Authentication failed                       | Token sai, hoặc `rewriteAuthorization` chưa chạy — kiểm tra header `authorization` không còn prefix `Bot ` |
| `4013` / `4014`                    | Invalid / disallowed intents                | Payload identify vẫn còn `intents` — kiểm tra `patchShardSend` có được gọi trong `spawn()` không           |
| `401` ở REST trước khi tới gateway | Interception `/gateway/bot` không khớp path | Log `url` trong `makeRequest`                                                                              |
