[English](./README.md) | **Tiếng Việt**

# Smoke tests

Cần token thật, không chạy trong CI. Token đọc từ biến môi trường, không truyền qua tham số dòng
lệnh (tham số lộ ra trong `ps` và shell history).

    node --env-file=.env scripts/smoke/readonly.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/write.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/message.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/voice.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/interaction.mjs
    SMOKE_ALLOW_WRITE=1 node --env-file=.env scripts/smoke/groupdm.mjs

| Script            | Xác nhận                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.mjs`       | P0-P2: REST shim + identify user account + gateway kết nối, `ready` bắn ra, `client.user` đúng                                                                                                                       |
| `write.mjs`       | 20 check có ghi trong **một** phiên login. Mỗi check chụp giá trị hiện tại, ghi, đọc lại, trả lại, rồi đọc lại lần nữa. Trả lại thất bại thì dừng cả script và in giá trị gốc ra                                     |
| `message.mjs`     | 16 check trong một group DM dùng một lần: gửi, fetch, sửa, trả lời, reaction, typing, ghim, đính kèm file, refresh attachment, collector, WebEmbed unfurl, xoá, và các thao tác quản lý kênh mà chủ nhóm tự làm được |
| `voice.mjs`       | Vào voice channel, phát audio, Go Live, nhận tiếng, rời kênh. Hiện tại nó chỉ chứng minh được Discord chặn fork ở đâu — xem ghi chú dưới                                                                             |
| `interaction.mjs` | Chạy slash command của bot khác với tư cách user: tìm lệnh, gửi, bấm nút, chọn select menu                                                                                                                           |
| `readonly.mjs`    | 16 check chỉ đọc trong **một** phiên login: relationships, guild settings, settings, sessions, notes, profile, thanh toán, lời mời kết bạn, app đã cấp quyền, refresh attachment, tìm application command            |

Kết quả nằm ở [`results.md`](results.md) — một bảng duy nhất, mỗi check một dòng kèm ngày chạy gần
nhất. Chỉ có tên check, ngày và pass/fail, không có số liệu tài khoản.

`write.mjs` không chạy nếu thiếu `SMOKE_ALLOW_WRITE=1`, vì nó sửa hồ sơ thật. Nó không đụng vào thứ
không trả lại được: username, email và mật khẩu cần mật khẩu tài khoản và Discord chỉ cho đổi 2
lần/giờ; HypeSquad để lại badge công khai; đổi Nitro và cấp quyền app thì mất tiền hoặc không hoàn
tác được. Check lời mời kết bạn tự skip trừ khi tài khoản đang có đúng 0 lời mời, vì cách dọn duy
nhất là `revokeAllFriendInvites()` và nó xoá cả những lời mời có từ trước.

`message.mjs` không cần kênh nào của bạn. Nó tự tạo một group DM rỗng (`POST /users/@me/channels` với
`recipients: []`), không có ai khác trong đó, chạy hết check ở đấy rồi xoá kênh — kể cả khi giữa chừng
có check ném lỗi. DM với chính mình thì không dùng được, Discord trả `400`. Check WebEmbed đẩy chuỗi
marker qua dịch vụ render bên thứ ba ghi trong `WebEmbed.DEFAULT_BASE_URL`; đặt `SMOKE_SKIP_WEBEMBED=1`
để bỏ check đó.

`voice.mjs` cần `SMOKE_VOICE_CHANNEL_ID`, `ffmpeg` trong `PATH`, và một binding Opus (ở đây `opusscript`
là devDependency; bản thân lib không bundle cái nào, vì đó là lựa chọn của người dùng). Vào voice
channel là **cả server nhìn thấy**, khác mọi suite còn lại — chọn kênh vắng. Hiện nó fail ngay check
đầu: Discord trả lời IDENTIFY voice bằng `4017 E2EE/DAVE protocol required` ở mọi version gateway, mà
fork không biết nói DAVE.

`interaction.mjs` nhận `SMOKE_INTERACTION_CHANNEL_ID`, điền id trần hoặc dán thẳng link kênh từ Discord
đều được. Kênh phải có bot mà bạn được phép chạy lệnh. Mặc định script chỉ chọn lệnh không có tham số
bắt buộc và tên nằm trong ping, help, about, info, stats, invite, uptime, version;
`SMOKE_INTERACTION_COMMAND` ghim một lệnh cụ thể. Khác sandbox group DM, cái này **để lại dấu vết không
xoá được**: Discord không cho thu hồi một lần gọi interaction, còn câu trả lời là tin của bot. Dùng kênh
bot-spam.

`groupdm.mjs` nhận `SMOKE_SECOND_USER_ID` — id trần hoặc link profile. Account đó phải đã là **bạn bè**
với account đang test: thêm người vào group DM là vào thẳng, và Discord chỉ cho làm giữa bạn bè. Script
tự dựng và tự xoá sandbox, nhưng account kia sẽ thấy một group DM hiện lên rồi biến mất, và nghe đổ
chuông vài giây. `setOwner` cố tình để ngoài: nhường quyền chủ nhóm không lấy lại được.

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
