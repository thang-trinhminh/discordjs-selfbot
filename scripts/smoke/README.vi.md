[English](./README.md) | **Tiếng Việt**

# Smoke tests

Cần token thật, không chạy trong CI. Token đọc từ biến môi trường, không truyền qua tham số dòng
lệnh (tham số lộ ra trong `ps` và shell history).

    node --env-file=.env scripts/smoke/readonly.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/write.mjs

| Script         | Xác nhận                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.mjs`    | P0-P2: REST shim + identify user account + gateway kết nối, `ready` bắn ra, `client.user` đúng                                                                                                            |
| `write.mjs`    | 14 check có ghi trong **một** phiên login. Mỗi check chụp giá trị hiện tại, ghi, đọc lại, trả lại, rồi đọc lại lần nữa. Trả lại thất bại thì dừng cả script và in giá trị gốc ra                          |
| `readonly.mjs` | 15 check chỉ đọc trong **một** phiên login: relationships, guild settings, settings, sessions, notes, profile, thanh toán, lời mời kết bạn, app đã cấp quyền, refresh attachment, tìm application command |

Kết quả nằm ở [`results.md`](results.md) — một bảng duy nhất, mỗi check một dòng kèm ngày chạy gần
nhất. Chỉ có tên check, ngày và pass/fail, không có số liệu tài khoản.

`write.mjs` không chạy nếu thiếu `SMOKE_ALLOW_WRITE=1`, vì nó sửa hồ sơ thật. Nó không đụng vào thứ
không trả lại được: username, email và mật khẩu cần mật khẩu tài khoản và Discord chỉ cho đổi 2
lần/giờ; HypeSquad để lại badge công khai; đổi Nitro và cấp quyền app thì mất tiền hoặc không hoàn
tác được. Check lời mời kết bạn tự skip trừ khi tài khoản đang có đúng 0 lời mời, vì cách dọn duy
nhất là `revokeAllFriendInvites()` và nó xoá cả những lời mời có từ trước.

`SKIP` nghĩa là check không chạy được, không phải là pass. Ngoài chốt lời mời kết bạn ở trên,
`refreshAttachmentURL()` cần `SMOKE_ATTACHMENT_URL` (một link `cdn.discordapp.com` đã hết hạn),
`notes.fetch()` cần có bạn bè trong cache, và 4 check ghi hồ sơ cần cấu hình `captchaSolver` cho
client — `PATCH /users/@me` trả về thử thách hCaptcha.

Mỗi lần chạy tốn một identify. Discord đánh dấu tài khoản reconnect liên tục, nên mỗi script gom hết
check vào một phiên và nghỉ giữa các request: `SMOKE_CALL_DELAY_MS` (2s) cho bản chỉ đọc, khoảng 35s
một lần chạy; `SMOKE_WRITE_DELAY_MS` (3s) cho bản có ghi, mỗi check 5 request nên mất khoảng 4 phút.
Giãn các lần chạy ra ít nhất 30s.

## Đọc close code khi fail

| Code                               | Nghĩa                                       | Chỗ nhìn đầu tiên                                                                                          |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `4004`                             | Authentication failed                       | Token sai, hoặc `rewriteAuthorization` chưa chạy — kiểm tra header `authorization` không còn prefix `Bot ` |
| `4013` / `4014`                    | Invalid / disallowed intents                | Payload identify vẫn còn `intents` — kiểm tra `patchShardSend` có được gọi trong `spawn()` không           |
| `401` ở REST trước khi tới gateway | Interception `/gateway/bot` không khớp path | Log `url` trong `makeRequest`                                                                              |
