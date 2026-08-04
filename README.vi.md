[English](./README.md) | **Tiếng Việt**

# discordjs-selfbot

Fork của [discord.js](https://github.com/discordjs/discord.js) `v14.27.0` cho
tài khoản người dùng, thay cho
[`discord.js-selfbot-v13`](https://github.com/aiko-chan-ai/discord.js-selfbot-v13)
đã archive.

> [!CAUTION]
> Dùng tài khoản người dùng để tự động hoá là **vi phạm điều khoản dịch vụ của
> Discord** và có thể dẫn tới khoá tài khoản. Bạn tự chịu rủi ro, nên dùng tài
> khoản phụ bỏ đi được.

## Trạng thái

Đang phát triển, **chưa dùng cho việc thật**. Chưa publish lên npm.

| Phần                                                   | Trạng thái                                 |
| ------------------------------------------------------ | ------------------------------------------ |
| REST (spoof header, TLS fingerprint, proxy, captcha)   | xong                                       |
| Gateway (identify cho tài khoản người dùng)            | xong                                       |
| Quan hệ, phiên đăng nhập, ghi chú, cài đặt, thanh toán | xong                                       |
| Group DM, cuộc gọi                                     | xong                                       |
| Custom status, rich presence, Spotify RPC              | xong                                       |
| WebEmbed                                               | xong                                       |
| Lớp tương thích v13 + codemod                          | xong                                       |
| TypeScript                                             | xong                                       |
| Gửi interaction với tư cách user                       | xong                                       |
| Voice / video / Go Live                                | đã port, **chưa chứng minh** (xem ghi chú) |
| Đăng nhập QR, đăng nhập mật khẩu (kèm 2FA)             | xong                                       |

> [!IMPORTANT]
> Phần đăng nhập và các đường chỉ đọc đã chạy thật với token thật (xem
> [`scripts/smoke/results.md`](./scripts/smoke/results.md)). Ngoài phạm vi đó,
> mọi thứ vẫn chỉ có unit test không chạm mạng. Các hằng số như
> `client_build_number`, `capabilities`, `SpotifyRPC.flags` và phần lớn route
> trong `src/util/UserRoutes.js` đều lấy từ bản v13 và **chưa được xác minh**
> với Discord hiện tại.

> [!WARNING]
> Riêng phần voice/video còn yếu hơn thế. Nó được port nguyên từ bản v13 và mọi
> file đều nạp được, nhưng phần lõi — UDP, đóng gói RTP, handshake voice gateway,
> mã hoá — **chỉ chứng minh được bằng một voice channel thật**. Test hiện tại chỉ
> khoá được phần thuần tuý: bảng codec, dựng SDP, bitfield, và các chỗ v13 dùng
> chuỗi enum mà v14 dùng số. Coi phần này là "đã port", không phải "đã chạy".

## Cài đặt

Cần Node.js 20.18 trở lên.

```sh
npm install github:trickstarcandina/discordjs-selfbot
```

## Dùng thử

```js
const { Client } = require('discordjs-selfbot');

const client = new Client({}); // không cần intents

client.on('ready', () => {
  console.log(`Đăng nhập với ${client.user.tag}`);
  console.log(`${client.relationships.friendCache.size} bạn bè`);
});

client.login(process.env.DISCORD_TOKEN);
```

Kiểm tra nền tảng bằng token thật:

```sh
node --env-file=.env scripts/smoke/readonly.mjs
```

Chép [`.env.example`](./.env.example) thành `.env` trước. Đọc
[`scripts/smoke/README.vi.md`](./scripts/smoke/README.vi.md) — mỗi lần chạy tốn
một identify nên phải giãn các lần chạy ra.

## Ví dụ

Thư mục [`examples/`](./examples) có 9 script chạy được: đăng nhập bằng token,
QR và mật khẩu; rich presence; gọi slash command; group DM và cuộc gọi;
WebEmbed; proxy; voice. Chúng dùng ID placeholder — điền ID của bạn trước khi
chạy.

## Chuyển từ v13

Lớp tương thích bật mặc định nên phần lớn code cũ chạy ngay. Phần phải sửa và
codemod hỗ trợ đều ghi trong [`MIGRATION.vi.md`](./MIGRATION.vi.md).

## Quan hệ với upstream

Repo này là bản chép của `packages/discord.js/{src,typings}` tại một commit đã
ghim, cộng thêm phần dành cho tài khoản người dùng.

[`UPSTREAM.vi.md`](./UPSTREAM.vi.md) ghi commit đang bám và **bảng đầy đủ các
file upstream đã bị sửa kèm lý do**. Giữ bảng đó ngắn là tiêu chí thiết kế: mỗi
file lệch thêm là một chỗ phải xử lý tay ở lần nâng cấp sau.

Nâng cấp là một lần merge, không phải vá lại từ đầu. Nhánh `upstream-vendor` giữ
mã gốc chưa patch và đóng vai merge base:

```sh
cd ../discord.js && git fetch          # lấy code mới của discord.js
./scripts/sync-upstream.sh origin/v14  # ghi commit lên upstream-vendor
git merge upstream-vendor              # git tự áp lại patch selfbot
npm test
```

## Phát triển

```sh
npm run lint              # eslint + prettier
node --test               # unit test
npm run test:typescript   # tsc + tsd
npm test                  # cả ba
```

Git hook chạy sẵn qua husky, chia theo tốc độ:

| Hook         | Chạy gì                                          | Mất  |
| ------------ | ------------------------------------------------ | ---- |
| `pre-commit` | lint-staged (chỉ file đang staged) + unit test   | ~3s  |
| `pre-push`   | lint cả repo + unit test + `tsc` và hai bộ `tsd` | ~25s |

Không có CI: hook là cổng duy nhất, nên `--no-verify` bỏ qua được hết và hook
chỉ chạy trên đúng bản Node của máy bạn.

Quy ước: code dành cho tài khoản người dùng đi vào **file mới**; sửa file
upstream là phương án cuối, và phải ghi vào bảng trong `UPSTREAM.vi.md`.

## Giấy phép

GPL-3.0-or-later. Xem [`LICENSE`](./LICENSE).

Đây là giấy phép copyleft: phần mềm bạn viết dựa trên thư viện này, nếu đem phân
phối, cũng phải phát hành theo GPL-3.0 kèm mã nguồn.

Sở dĩ là GPL chứ không phải Apache vì phần voice stack cho tài khoản người dùng
nằm dưới `src/client/voice/` được port từ
[discord.js-selfbot-v13](https://github.com/aiko-chan-ai/discord.js-selfbot-v13),
vốn là GPL-3.0. Phần kế thừa từ
[discord.js](https://github.com/discordjs/discord.js) vẫn đến tay bạn kèm giấy
phép Apache-2.0, toàn văn nằm ở [`LICENSE-APACHE`](./LICENSE-APACHE).
[`NOTICE`](./NOTICE) ghi rõ phần ghi công cho cả hai upstream.
