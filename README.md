# discordjs-selfbot-v14

Fork của [discord.js](https://github.com/discordjs/discord.js) `v14.27.0` cho
tài khoản người dùng, thay cho
[`discord.js-selfbot-v13`](https://github.com/aiko-chan-ai/discord.js-selfbot-v13)
đã archive.

> [!CAUTION]
> Dùng tài khoản người dùng để tự động hoá là **vi phạm điều khoản dịch vụ của
> Discord** và có thể dẫn tới khoá tài khoản. Bạn tự chịu rủi ro.

## Trạng thái

Đang phát triển, **chưa dùng cho việc thật**. Chưa publish lên npm.

| Phần | Trạng thái |
|---|---|
| REST (spoof header, TLS fingerprint, proxy, captcha) | xong |
| Gateway (identify cho tài khoản người dùng) | xong |
| Quan hệ, phiên đăng nhập, ghi chú, cài đặt, thanh toán | xong |
| Group DM, cuộc gọi | xong |
| Custom status, rich presence, Spotify RPC | xong |
| WebEmbed | xong |
| Lớp tương thích v13 + codemod | xong |
| TypeScript | xong |
| Gửi interaction với tư cách user | xong |
| Voice / video / Go Live | đã port, **chưa chứng minh** (xem ghi chú) |
| Đăng nhập QR, đăng nhập mật khẩu (kèm 2FA) | xong |

> [!IMPORTANT]
> **Chưa chạy thử với token thật lần nào.** Toàn bộ kiểm thử hiện tại là unit
> test không chạm mạng. Các hằng số như `client_build_number`, `capabilities`,
> `SpotifyRPC.flags` và khoảng 40 route trong `src/util/UserRoutes.js` đều lấy
> từ bản v13 và **chưa được xác minh** với Discord hiện tại.

> [!WARNING]
> Riêng phần voice/video còn yếu hơn thế. Nó được port nguyên từ bản v13 và mọi
> file đều nạp được, nhưng phần lõi — UDP, đóng gói RTP, handshake voice gateway,
> mã hoá — **chỉ chứng minh được bằng một voice channel thật**. Test hiện tại chỉ
> khoá được phần thuần tuý: bảng codec, dựng SDP, bitfield, và các chỗ v13 dùng
> chuỗi enum mà v14 dùng số. Coi phần này là "đã port", không phải "đã chạy".

## Cài đặt

Cần Node.js 20.18 trở lên.

```sh
npm install github:trickstarcandina/discordjs-selfbot-v14
```

## Dùng thử

```js
const { Client } = require('discordjs-selfbot-v14');

const client = new Client({}); // không cần intents

client.on('ready', () => {
  console.log(`Đăng nhập với ${client.user.tag}`);
  console.log(`${client.relationships.friendCache.size} bạn bè`);
});

client.login(process.env.DISCORD_TOKEN);
```

Kiểm tra nền tảng bằng token thật:

```sh
DISCORD_TOKEN='...' npm run smoke:login
```

## Chuyển từ v13

Lớp tương thích bật mặc định nên phần lớn code cũ chạy ngay. Phần phải sửa và
codemod hỗ trợ đều ghi trong [`MIGRATION.md`](./MIGRATION.md).

## Quan hệ với upstream

Repo này là bản chép của `packages/discord.js/{src,typings}` tại một commit đã
ghim, cộng thêm phần dành cho tài khoản người dùng.

[`UPSTREAM.md`](./UPSTREAM.md) ghi commit đang bám và **bảng đầy đủ các file
upstream đã bị sửa kèm lý do**. Giữ bảng đó ngắn là tiêu chí thiết kế: mỗi file
lệch thêm là một chỗ phải xử lý tay ở lần nâng cấp sau.

Nâng cấp upstream:

```sh
./scripts/sync-upstream.sh <commit-moi>
git diff   # xem patch nào bị ghi đè, apply lại
```

## Phát triển

```sh
npm run lint          # eslint + prettier
node --test           # unit test
npm run test:typescript   # tsc + tsd
npm test              # cả ba
```

Quy ước: code dành cho tài khoản người dùng đi vào **file mới**; sửa file
upstream là phương án cuối, và phải ghi vào bảng trong `UPSTREAM.md`.

## Giấy phép

Apache-2.0, theo discord.js.
