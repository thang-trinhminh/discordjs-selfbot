[English](./SECURITY.md) | **Tiếng Việt**

# Bảo mật

Thư viện này giữ **token người dùng**: ai có nó là sở hữu tài khoản — tin nhắn,
bạn bè, phương thức thanh toán. Mọi quy tắc dưới đây đều nhằm giữ token đó, và các
request mà nó ký, khỏi tay người khác.

## Báo lỗ hổng

Đừng mở issue công khai. Dùng
[báo lỗ hổng riêng tư](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
của GitHub trên repo này (Security → Report a vulnerability). Không bao giờ dán
token thật, kể cả token đã hết hạn, vào báo cáo.

## Lệnh

| Lệnh                                | Kiểm tra gì                                                                         | Chạy ở đâu                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `npm run audit:prod`                | Lỗ hổng đã công bố trong dependency **runtime**, từ `moderate` trở lên              | release, hằng tuần, máy local              |
| `npm run audit:all`                 | Lỗ hổng đã công bố trong mọi dependency, từ `high` trở lên                          | release, hằng tuần, máy local              |
| `npm run audit:signatures`          | Chữ ký registry và provenance của từng gói đã cài                                   | release, hằng tuần (cần mạng tới sigstore) |
| `npm run check:package`             | Những gì `npm publish` sẽ đẩy lên: chỉ path được phép, không `.env`, khoá hay token | release, hằng tuần, máy local              |
| `node --test test/security.test.js` | Các lỗi ở mục _Đã sửa_ bên dưới, và không file nào bị git theo dõi chứa token       | mỗi commit (husky), release                |
| `npm run security`                  | Tất cả ở trên trừ chữ ký, chạy một lần                                              | máy local, trước khi tag                   |

## Quy trình

**Mỗi commit** — husky `pre-commit` chạy `node --test`, trong đó có
`test/security.test.js`. Commit nào thêm token Discord thật vào file bị git theo
dõi sẽ trượt ở đây.

**Mỗi tuần** — `.github/workflows/security.yml` chạy audit, kiểm chữ ký và CodeQL
(`security-and-quality`, config ở `.github/codeql/`). Dependabot mở PR cho gói npm
và GitHub Actions. Lỗ hổng mới công bố cho một dependency hiện ra ở đây kể cả khi
code của ta không đổi dòng nào.

**Mỗi release** — `publish.yml` từ chối publish trừ khi qua hết, theo thứ tự: tag
khớp `package.json`, lint, unit test, TypeScript, `audit:prod`, `audit:all`,
`audit:signatures`, `check:package`. Trước khi bấm _Publish release_:

1. Chạy `npm run security` ở máy và đọc output, không chỉ nhìn exit code.
2. Đọc `git diff <tag trước>..HEAD -- package-lock.json`: mỗi gói mới hay đổi là
   code sẽ chạy khi token người dùng đang nằm trong bộ nhớ. Script
   `install`/`postinstall` mới cần xem kỹ (`npm query ':attr(scripts, [postinstall])'`).
3. `git log <tag trước>..HEAD -p | grep -E '[MNO][\w-]{23,27}\.[\w-]{6}\.'` phải
   không in ra gì.
4. Xác nhận `scripts/smoke/results.md` chỉ có tên check, ngày và PASS/FAIL.
5. Sau khi publish, `npm view @trickstarcandina/discordjs-selfbot dist.attestations`
   phải có provenance.

**Khi upstream discord.js đổi** — chạy lại audit sau `git merge upstream-vendor`;
upstream có thể nâng mức tối thiểu của dependency (ví dụ `undici`) mà ta phải theo.

## Đã sửa

| Lỗi                                                                  | Ảnh hưởng                                                                                                                                                                                                                                                      | Cách sửa                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Tham số route trong `UserRoutes` được ghép thẳng                     | `client.redeemNitro('../../invites/<code>#')` gửi đi **`POST /invites/<code>` kèm token** (vào server). Gift sniper đưa thẳng nội dung tin nhắn vào hàm này, nên ai gửi được tin nhắn là điều khiển được tài khoản. Mọi route khác trong `UserRoutes` cũng vậy | Mọi tham số đi qua `segment()`: `encodeURIComponent`, giữ `@`; `.`/`..`/rỗng thì ném lỗi |
| `acceptInvite` đưa chuỗi không khớp vào `Routes.invite` của upstream | Cùng loại: `GET` và `POST` kèm token tới path do kẻ tấn công chọn                                                                                                                                                                                              | Mã phải khớp `^[\w-]{2,255}$`                                                            |
| `undici` ≤ 6.29.0 (runtime)                                          | 5 advisory, DoS và response splitting (GHSA-3wwx-pv8p-q78v, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5, GHSA-4qv8-2p9j-2685, GHSA-xjj6-f33q-929c)                                                                                                                | Nâng mức tối thiểu lên `^6.29.1`                                                         |
| `brace-expansion`, `js-yaml` (chỉ dev)                               | DoS trong công cụ lint                                                                                                                                                                                                                                         | `npm audit fix`                                                                          |
| `RemoteAuth` ném lỗi trong listener của socket                       | Gói hỏng hoặc giải mã thất bại là uncaught exception, sập tiến trình                                                                                                                                                                                           | Bắt lại; emit `error`, `connect()` reject                                                |
| `RemoteAuth.connect(client)` khi `client.login` lỗi                  | Unhandled rejection, promise treo mãi                                                                                                                                                                                                                          | `connect()` reject với lỗi đăng nhập                                                     |
| `Recorder.destroy` tìm ffmpeg theo dòng lệnh                         | Có thể `kill` nhầm tiến trình khác (Recorder thứ hai, hay ffmpeg của chương trình khác) có cùng tham số                                                                                                                                                        | Chỉ khớp pid/ppid (`findOwnFFmpeg`)                                                      |
| `uploadToSlot` nhận mọi scheme                                       | Nội dung file có thể đi qua `http` không mã hoá                                                                                                                                                                                                                | Chỉ `https:`                                                                             |

## Rủi ro đã biết, chưa sửa

Ghi lại thay vì sửa, vì sửa sẽ đổi hành vi mà người gọi có thể đang dựa vào.

- **Input ffmpeg được truyền nguyên.** `playAudio(input)` / `playVideo(input)` đưa
  `input` cho `ffmpeg -i` (không qua shell, nên không có command injection). Nếu
  ứng dụng truyền URL lấy từ chat, ffmpeg sẽ mở cả `file:`, `concat:` hay URL mạng
  nội bộ. Ứng dụng phải tự chỉ cho phép URL `https:`.
  `inputFFmpegArgs`/`outputFFmpegArgs` là tham số ffmpeg thô — đừng bao giờ lấy từ
  input người dùng.
- **Đường dẫn output của `Recorder` được truyền nguyên** cho ffmpeg kèm `-y` (ghi đè).
- **`authorizeURL` chép mọi query parameter vào body**, kể cả `permissions` và
  `scope`. Đó là mục đích của hàm, nhưng nghĩa là chỉ URL quyết định cấp quyền gì —
  chỉ gọi với URL bạn tin.
- **`client.options.http.headers` ghi đè được mọi header**, kể cả `authorization`.
  Đừng dựng nó từ dữ liệu không tin cậy.
- **`Routes` của upstream (discord-api-types) cũng không mã hoá tham số.** Id lấy từ
  payload của Discord thì an toàn; chuỗi từ người dùng thì không. Resolve qua
  manager (`fetch`, `resolveId`) trước.
- **`typings/*.test-d.ts` bị đóng gói theo.** Vô hại, chỉ tốn dung lượng.
- **GitHub Actions ghim theo tag (`@v4`), không theo commit SHA.** Dependabot giữ
  chúng mới; ghim SHA chống action bị chiếm quyền tốt hơn, nên làm trước khi gói có
  nhiều người dùng.
- **`paths-ignore` của CodeQL bỏ `test/` và `scripts/smoke/`**, nơi chỉ có credential
  giả. `src/` được quét đầy đủ.

## Giữ token

- Token chỉ nằm trong `.env` (đã git-ignore). `.env.example` chỉ có giá trị rỗng.
- `Client#_censoredToken` là thứ đi vào sự kiện `debug`; đừng bao giờ log
  `client.token`.
- Token từng bị commit, dán vào issue hay in ra CI là đã lộ: đổi mật khẩu tài khoản
  (làm mọi token mất hiệu lực), rồi viết lại lịch sử nếu cần.
