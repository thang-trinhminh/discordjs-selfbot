# Kết quả smoke test

Chạy tay với token thật, không có trong CI. File này chỉ ghi **ngày và pass/fail** — giá trị trả về
(tag tài khoản, số guild, số bạn bè, setting) chỉ hiện trên console lúc chạy rồi mất.

Giờ UTC. Script tự nối thêm dòng sau mỗi lần chạy.

| Thời điểm        | Bộ       | Kết quả | Check fail                     |
| ---------------- | -------- | ------- | ------------------------------ |
| 2026-08-03 09:50 | readonly | 7/8     | users.fetch(chinh minh, force) |
| 2026-08-03 09:55 | readonly | 8/8     | —                              |

Trước hai lần trên, cùng ngày, `login.mjs` chạy hai lượt: lượt đầu fail (handler READY vỡ khi gặp
`user_guild_settings` dạng object), lượt sau pass sau khi vá. Script đó không tự ghi log.

Hai lỗi mà đợt test này lộ ra đã vá xong, mỗi lỗi kèm một test không cần mạng:

- `READY.js` — `user_guild_settings` về dạng `{ version, partial, entries }`, không phải mảng.
- `UserManager.js` — `GET /users/:id` là route bot-only, token người dùng ăn 403 code 40001.
