[English](./README.md) | **Tiếng Việt**

<div align="center">

<h1>discordjs-selfbot</h1>

<p><strong>discord.js v14 cho tài khoản người dùng.</strong><br>
Kế nhiệm <a href="https://github.com/aiko-chan-ai/discord.js-selfbot-v13"><code>discord.js-selfbot-v13</code></a> đã archive, xây trên <a href="https://github.com/discordjs/discord.js">discord.js</a> <code>v14.27.0</code>.</p>

<p>
<a href="https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot"><img alt="Phiên bản npm" src="https://img.shields.io/npm/v/@trickstarcandina/discordjs-selfbot?logo=npm&color=cb3837"></a>
<a href="https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot"><img alt="Lượt tải mỗi tháng" src="https://img.shields.io/npm/dm/@trickstarcandina/discordjs-selfbot?label=downloads&color=blue"></a>
<a href="https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot"><img alt="Tổng lượt tải" src="https://img.shields.io/npm/dt/@trickstarcandina/discordjs-selfbot?label=total&color=blue"></a>
<a href="https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot?activeTab=code"><img alt="Dung lượng sau giải nén" src="https://img.shields.io/npm/unpacked-size/@trickstarcandina/discordjs-selfbot"></a>
<a href="./typings/index.d.ts"><img alt="Có sẵn kiểu TypeScript" src="https://img.shields.io/npm/types/@trickstarcandina/discordjs-selfbot?logo=typescript&logoColor=white"></a>
</p>

<p>
<a href="https://github.com/discordjs/discord.js/tree/14.27.0"><img alt="Dựa trên discord.js v14.27.0" src="https://img.shields.io/badge/discord.js-v14.27.0-5865F2?logo=discord&logoColor=white"></a>
<a href="./package.json"><img alt="Phiên bản Node.js" src="https://img.shields.io/node/v/@trickstarcandina/discordjs-selfbot?logo=node.js&logoColor=white&color=339933"></a>
<a href="https://github.com/trickstarcandina/discordjs-selfbot/actions/workflows/publish.yml"><img alt="Workflow publish" src="https://img.shields.io/github/actions/workflow/status/trickstarcandina/discordjs-selfbot/publish.yml?label=publish&logo=githubactions&logoColor=white"></a>
<a href="https://github.com/trickstarcandina/discordjs-selfbot/actions/workflows/security.yml"><img alt="Workflow security" src="https://img.shields.io/github/actions/workflow/status/trickstarcandina/discordjs-selfbot/security.yml?label=security&logo=githubactions&logoColor=white"></a>
<a href="./LICENSE"><img alt="Giấy phép" src="https://img.shields.io/npm/l/@trickstarcandina/discordjs-selfbot?color=yellow"></a>
</p>

<p>
<a href="https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot"><b>npm</b></a> ·
<a href="https://github.com/trickstarcandina/discordjs-selfbot/pkgs/npm/discordjs-selfbot"><b>GitHub Packages</b></a> ·
<a href="https://github.com/trickstarcandina/discordjs-selfbot/releases"><b>Releases</b></a> ·
<a href="./CHANGELOG.md"><b>Changelog</b></a> ·
<a href="./docs/API.vi.md"><b>API</b></a> ·
<a href="./examples"><b>Ví dụ</b></a>
</p>

</div>

> [!CAUTION]
> Dùng tài khoản người dùng để tự động hoá là **vi phạm điều khoản dịch vụ của
> Discord** và có thể dẫn tới khoá tài khoản. Bạn tự chịu rủi ro, nên dùng tài
> khoản phụ bỏ đi được.

## Cài đặt

Cần **Node.js 22.12** trở lên.

```sh
npm install @trickstarcandina/discordjs-selfbot
# hoặc
pnpm add @trickstarcandina/discordjs-selfbot
# hoặc
yarn add @trickstarcandina/discordjs-selfbot
```

### Voice (tuỳ chọn)

Voice cần thêm ba thứ, lib không bundle cái nào:

```sh
npm install @snazzah/davey      # mã hoá đầu cuối DAVE, Discord bắt buộc
npm install @discordjs/opus     # hoặc opusscript, để gửi audio
# và ffmpeg trong PATH
```

Từ tháng 3/2026 Discord bắt buộc giao thức mã hoá đầu cuối DAVE cho mọi voice
call không phải stage, và ngắt kết nối với client không nói được nó.
`@snazzah/davey` là `optionalDependency` để người không đụng voice khỏi phải build
một native module; thiếu nó thì `joinChannel` ném ra một câu nói rõ tên gói.

### Cài từ GitHub Packages

Mỗi bản release cũng được publish lên GitHub Packages. GitHub đòi token có quyền
`read:packages` kể cả với gói public:

```ini
# .npmrc
@trickstarcandina:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Bắt đầu nhanh

```js
const { Client } = require('@trickstarcandina/discordjs-selfbot');

const client = new Client({}); // không cần intents

client.on('ready', () => {
  console.log(`Đăng nhập với ${client.user.tag}`);
  console.log(`${client.relationships.friendCache.size} bạn bè`);
});

client.login(process.env.DISCORD_TOKEN);
```

Muốn kiểm tra lib bằng token của bạn, chép [`.env.example`](./.env.example) thành
`.env` rồi chạy:

```sh
node --env-file=.env scripts/smoke/readonly.mjs
```

Mỗi lần chạy tốn một identify nên phải giãn các lần chạy ra. Xem
[`scripts/smoke/README.vi.md`](./scripts/smoke/README.vi.md).

## Tính năng

| Phần                                                   | Trạng thái                         |
| ------------------------------------------------------ | ---------------------------------- |
| REST (spoof header, TLS fingerprint, proxy, captcha)   | ✅ Xong                            |
| Gateway (identify cho tài khoản người dùng)            | ✅ Xong                            |
| Quan hệ, phiên đăng nhập, ghi chú, cài đặt, thanh toán | ✅ Xong                            |
| Group DM, cuộc gọi                                     | ✅ Xong                            |
| Custom status, rich presence, Spotify RPC              | ✅ Xong                            |
| WebEmbed                                               | ✅ Xong                            |
| Gửi interaction với tư cách user                       | ✅ Xong                            |
| Đăng nhập QR, đăng nhập mật khẩu (kèm 2FA)             | ✅ Xong                            |
| Lớp tương thích v13 + codemod                          | ✅ Xong                            |
| Kiểu TypeScript                                        | ✅ Xong                            |
| Voice / video / Go Live                                | ⚠️ Chạy được, cần `@snazzah/davey` |

Dự án đang ở **giai đoạn trước 1.0**: API còn có thể đổi giữa các bản minor, và
mọi thay đổi phá tương thích đều ghi trong [changelog](./CHANGELOG.md).

> [!IMPORTANT]
> Phần đăng nhập và các đường chỉ đọc đã chạy thật với token thật (xem
> [`scripts/smoke/results.md`](./scripts/smoke/results.md)). Ngoài phạm vi đó,
> mọi thứ vẫn chỉ có unit test không chạm mạng. Các hằng số như
> `client_build_number`, `capabilities`, `SpotifyRPC.flags` và phần lớn route
> trong `src/util/UserRoutes.js` đều lấy từ bản v13 và **chưa được xác minh**
> với Discord hiện tại.

> [!WARNING]
> Voice vào được kênh thật và pass toàn bộ smoke suite: vào kênh, phát, mở stream
> nhận, mở kết nối Go Live, rời kênh. Còn hai chỗ chưa chứng minh: chưa ai nghe
> bằng tai, và ở một mình trong kênh thì nhóm DAVE không tới epoch nên chính đường
> mã hoá đầu cuối chưa từng chạy với Discord. Video và Go Live thì không được mã
> hoá đầu cuối.

## Thông tin gói

| Mục                     | Chi tiết                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Registry**            | [npmjs.com](https://www.npmjs.com/package/@trickstarcandina/discordjs-selfbot) (chính), [GitHub Packages](https://github.com/trickstarcandina/discordjs-selfbot/pkgs/npm/discordjs-selfbot) (bản sao)                                      |
| **Thống kê lượt tải**   | Biểu đồ theo ngày, tuần, tháng trên [npm-stat](https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot)                                                                                                           |
| **Ghi chú phát hành**   | [`CHANGELOG.md`](./CHANGELOG.md) và [GitHub Releases](https://github.com/trickstarcandina/discordjs-selfbot/releases)                                                                                                                      |
| **Định dạng module**    | CommonJS, kèm kiểu TypeScript trong [`typings/`](./typings)                                                                                                                                                                                |
| **Nguồn gốc bản build** | Mỗi bản release do [GitHub Actions](./.github/workflows/publish.yml) build và publish qua npm Trusted Publishing, không có token lưu sẵn. npm gắn mỗi version với commit đã build ra nó; kiểm tra bản bạn cài bằng `npm audit signatures`. |

## Tài liệu

| Ở đâu                                    | Nội dung                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| [`docs/API.vi.md`](./docs/API.vi.md)     | Toàn bộ phần fork thêm vào, theo nhóm, kèm trạng thái tested/unit/ported từng mục |
| [`MIGRATION.vi.md`](./MIGRATION.vi.md)   | Chuyển code từ `discord.js-selfbot-v13`, và codemod                               |
| [`UPSTREAM.vi.md`](./UPSTREAM.vi.md)     | File upstream nào bị sửa, vì sao, và cách nâng cấp                                |
| [`SECURITY.vi.md`](./SECURITY.vi.md)     | Báo lỗ hổng, lệnh audit, checklist trước khi release                              |
| [`examples/`](./examples)                | 9 script chạy được                                                                |
| [`scripts/smoke/`](./scripts/smoke)      | Kiểm tra bằng token thật, và log các lần chạy trước                               |
| [discord.js.dev](https://discord.js.dev) | Mọi thứ không thuộc selfbot, giữ nguyên từ upstream                               |

## Ví dụ

Thư mục [`examples/`](./examples) có 9 script chạy được: đăng nhập bằng token,
QR và mật khẩu; rich presence; gọi slash command; group DM và cuộc gọi;
WebEmbed; proxy; voice. Chúng dùng ID placeholder, hãy điền ID của bạn trước khi
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
npm run security          # npm audit + test bảo mật + soi nội dung gói
```

Git hook chạy sẵn qua husky, chia theo tốc độ:

| Hook         | Chạy gì                                          | Mất  |
| ------------ | ------------------------------------------------ | ---- |
| `pre-commit` | lint-staged (chỉ file đang staged) + unit test   | ~3s  |
| `pre-push`   | lint cả repo + unit test + `tsc` và hai bộ `tsd` | ~25s |

Hook là cổng kiểm tra hằng ngày: không có CI khi push, nên `--no-verify` bỏ qua
được hết. GitHub Actions chỉ chạy ở ba chỗ:

- **`publish`**, mỗi lần tạo GitHub release: lint, test, kiểm kiểu, `npm audit`,
  chữ ký registry và soi nội dung tarball, rồi mới publish.
- **`security`**, hằng tuần và khi chạy tay: `npm audit`, chữ ký, test bảo mật và
  CodeQL.
- **`stats`**, hằng ngày: vẽ lại biểu đồ lượt tải ở cuối trang này và đẩy lên
  nhánh `stats`. Đây là workflow duy nhất có quyền ghi vào repo.

Quy ước: code dành cho tài khoản người dùng đi vào **file mới**. Sửa file
upstream là phương án cuối, và phải ghi vào bảng trong `UPSTREAM.vi.md`.

## Bảo mật

Hãy báo lỗ hổng một cách riêng tư; xem [`SECURITY.vi.md`](./SECURITY.vi.md) để
biết cách báo, và danh sách các lỗi đã sửa.

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

## Thống kê

Lượt tải mỗi tuần trên npmjs.com (không tính GitHub Packages), vẽ lại hằng ngày
bởi [workflow `stats`](./.github/workflows/stats.yml), mỗi bản release là một vạch
đứt. Bấm vào biểu đồ để xem chi tiết theo ngày trên npm-stat.

<div align="center">

<a href="https://npm-stat.com/charts.html?package=%40trickstarcandina%2Fdiscordjs-selfbot">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/trickstarcandina/discordjs-selfbot/stats/downloads-dark.svg">
    <img alt="Lượt tải npm mỗi tuần" src="https://raw.githubusercontent.com/trickstarcandina/discordjs-selfbot/stats/downloads-light.svg" width="800">
  </picture>
</a>

<a href="https://star-history.com/#trickstarcandina/discordjs-selfbot&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=trickstarcandina/discordjs-selfbot&type=Date&theme=dark">
    <img alt="Số sao GitHub theo thời gian" src="https://api.star-history.com/svg?repos=trickstarcandina/discordjs-selfbot&type=Date" width="800">
  </picture>
</a>

</div>
