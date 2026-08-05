# Design: DAVE (E2EE) cho voice

Ngày: 2026-08-04
Trạng thái: chờ duyệt

## 1. Bối cảnh

Stack voice của repo được chép nguyên từ `discord.js-selfbot-v13` và chưa từng chạy thật.
Tier 3 smoke chạy lần đầu ngày 2026-08-04 và cả năm check voice đều FAIL. Sau khi sửa hai
lỗi trong fork (`joinChannel` gate sai vì member cache rỗng, `onClose` retry mù), lỗi thật
lộ ra:

```
Voice websocket closed with 4017: E2EE/DAVE protocol required
```

Đã probe voice gateway version 8, 7, 6, 5, 4, mỗi lần một session mới. Tất cả đều 4017.

### Vì sao không né được

Từ tháng 3/2026 Discord bắt buộc E2EE cho mọi voice call không phải stage. Client gửi
IDENTIFY với `max_dave_protocol_version` bằng 0, hoặc bỏ trống field đó, thì voice server
đóng socket bằng 4017 ngay lập tức.

- <https://support.discord.com/hc/en-us/articles/38749827197591-A-V-E2EE-Enforcement-for-Non-Stage-Voice-Calls>
- <https://docs.discord.food/topics/voice-connections>
- <https://daveprotocol.com/>

IDENTIFY hiện tại (`src/client/voice/networking/VoiceWebSocket.js:138`) không có field đó,
nên 4017 là kết quả đúng chứ không phải bug mạng.

### Ràng buộc đã chốt với người dùng

| Ràng buộc        | Quyết định                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Phạm vi          | Full DAVE: bắt tay + E2EE cho audio (gửi và nhận)                 |
| Video / Go Live  | Ngoài phạm vi lần này                                             |
| `@snazzah/davey` | `optionalDependencies`, giống cách repo đối xử với `zlib-sync`    |
| Mức xác minh     | Unit test offline + `smoke:voice` chạm Discord thật tới CONNECTED |
| Nghe bằng tai    | Không bắt buộc trong lần này                                      |

## 2. Quyết định nền: không tự viết MLS

DAVE v1 là MLS (RFC 9420) trên ciphersuite P-256. Tự implement là nhiều tháng crypto
review, và một lỗi trong đó là lỗi bảo mật im lặng chứ không phải crash.

`@snazzah/davey` là binding native mà `@discordjs/voice` dùng. Đã kiểm chứng trên máy này:

```
$ npm i @snazzah/davey && node -e "console.log(require('@snazzah/davey').DAVE_PROTOCOL_VERSION)"
1
```

Cài sạch, có prebuilt binary, không phải build từ nguồn, 0 vulnerabilities. Ta bọc nó,
không viết lại nó.

## 3. Kiến trúc

### File mới

`src/client/voice/networking/DAVESession.js` — lớp bọc `@snazzah/davey`. Giữ session MLS,
máy trạng thái transition/epoch, bộ đếm decrypt hỏng, và hai cửa `encrypt`/`decrypt`.
Không biết gì về websocket: nhận payload đã tách, trả buffer hoặc phát event.

Là port sang JS của `packages/voice/src/networking/DAVESession.ts` trong discord.js.
Giữ nguyên ngữ nghĩa để sau này còn đối chiếu được khi upstream sửa.

### File sửa

| File                                            | Sửa gì                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/voice/util/VoiceConstants.js`       | Thêm `CLIENTS_CONNECT: 11` và DAVE opcode 21–31 vào `VoiceOpcodes`, khớp `discord-api-types/voice/v8`                                                                     |
| `src/client/voice/util/VoiceWebSocketShim.js`   | `unpack` phân biệt string với Buffer; thêm `packBinary(op, payload)`                                                                                                      |
| `src/client/voice/networking/VoiceWebSocket.js` | IDENTIFY đúng opcode và có `max_dave_protocol_version`; tách `streams`/`video` ra khỏi voice thường; route frame nhị phân; thêm `sendBinary`; theo dõi `connectedClients` |
| `src/client/voice/VoiceConnection.js`           | Tạo và huỷ `DAVESession` theo vòng đời; nối event; getter `identifyExtras`                                                                                                |
| `src/client/voice/dispatcher/BaseDispatcher.js` | `dave.encrypt(opus)` **trước** transport encrypt                                                                                                                          |
| `src/client/voice/receiver/PacketHandler.js`    | `dave.decrypt(opus, userId)` **sau** transport decrypt                                                                                                                    |
| `package.json`                                  | `@snazzah/davey` vào `optionalDependencies`                                                                                                                               |

### Ba lỗi phụ phát hiện khi đọc code

1. `VoiceWebSocket.js:139` gửi `op: Opcodes.DISPATCH`. Trùng số với `VoiceOpcodes.IDENTIFY`
   (đều là 0) nên vô hại, nhưng sai tên và gây hiểu nhầm. Sửa thành `VoiceOpcodes.IDENTIFY`.
2. `VoiceWebSocket.js:145` nhét `streams: [{type: 'screen', ...}]` và `video: true` vào mọi
   IDENTIFY. Đó là payload của Go Live, không phải voice thường. `StreamConnection` kế thừa
   `VoiceConnection` và dùng chung websocket này, nên không xoá thẳng được — xem mục 4.3.
3. `VoiceOpcodes` hiện map `SOURCES: 12` và `CLIENT_CONNECT: 12` trùng nhau, và thiếu hẳn
   opcode 11. DAVE cần opcode 11 để biết ai đang trong nhóm.

## 4. Chi tiết

### 4.1 Framing nhị phân

DAVE dùng frame nhị phân trên cùng websocket với JSON. Layout (chỉ chiều nhận):

```
byte 0..1   seq        uint16 big-endian
byte 2      op         uint8
byte 3..    payload
```

Chiều gửi không có `seq`, chỉ `op` một byte rồi payload:

```js
Buffer.concat([Uint8Array.from([op]), payload]);
```

`unpack` hiện tại `JSON.parse` mọi thứ nên frame nhị phân làm nó ném lỗi. Sửa: nếu data là
string thì `JSON.parse`, nếu là Buffer/ArrayBuffer thì trả `{ op, seq, payload }`.

### 4.2 IDENTIFY

```js
{
  op: VoiceOpcodes.IDENTIFY,
  d: {
    server_id, user_id, token, session_id,
    max_dave_protocol_version: DAVE_PROTOCOL_VERSION,
    ...this.connection.identifyExtras,
  },
}
```

`DAVE_PROTOCOL_VERSION` đọc thẳng từ davey. Không có nhánh gửi 0: thiếu davey thì `joinChannel`
đã ném từ trước, websocket không bao giờ mở, xem mục 4.6.

### 4.3 `identifyExtras`

`VoiceConnection.prototype.identifyExtras` trả `{}`.
`StreamConnection` override, trả `{ streams: [{ type: 'screen', rid: '100', quality: 100 }], video: true }`.

Nhờ vậy voice thường gửi IDENTIFY sạch, còn Go Live giữ nguyên payload cũ. Đây là điểm rủi ro
cao nhất của thiết kế: tách sai thì Go Live chết, mà Go Live vốn chưa từng chạy được nên
không có baseline để so.

### 4.4 Vòng đời session

Session được tạo khi nhận **SESSION_DESCRIPTION** (op 4), không phải READY. `dave_protocol_version`
nằm trong payload đó cạnh `mode` và `secret_key`.

```
WS open
  -> IDENTIFY { max_dave_protocol_version: 1 }
  <- READY
  -> SELECT_PROTOCOL (đã có sẵn)
  <- SESSION_DESCRIPTION { mode, secret_key, dave_protocol_version }
       nếu dave_protocol_version > 0: new DAVESession(v, userId, channelId)
  <- op 24 dave_prepare_epoch { epoch: 1, protocol_version }
       -> reinit() -> emit keyPackage -> gửi op 26 dave_mls_key_package (nhị phân)
  <- op 25 dave_mls_external_sender (nhị phân)     -> setExternalSender
  <- op 27 dave_mls_proposals (nhị phân)           -> processProposals
       nếu có commit: gửi op 28 dave_mls_commit_welcome (nhị phân)
  <- op 29 dave_mls_announce_commit_transition     -> processCommit
  <- op 30 dave_mls_welcome                        -> processWelcome
  <- op 21 dave_prepare_transition                 -> gửi op 23 dave_transition_ready
  <- op 22 dave_execute_transition                 -> session.ready
```

Byte offset trong payload nhị phân:

| Opcode       | Đọc                                                                               |
| ------------ | --------------------------------------------------------------------------------- |
| 27 proposals | `readUInt8(0)` là operation type (0 append, 1 revoke), `subarray(1)` là proposals |
| 29 commit    | `readUInt16BE(0)` là transition id, `subarray(2)` là commit                       |
| 30 welcome   | `readUInt16BE(0)` là transition id, `subarray(2)` là welcome                      |

Trả về cho op 28: `commit` nếu chỉ có commit, `Buffer.concat([commit, welcome])` nếu có cả hai.

`processProposals` cần danh sách user id đang trong kênh để kiểm tra người mới. Lấy từ
`connectedClients`, một `Set` do `VoiceWebSocket` giữ: op 11 `CLIENTS_CONNECT` thêm cả mảng
`user_ids`, op 13 `CLIENT_DISCONNECT` xoá `user_id`.

### 4.5 Transition và downgrade

- `transition_id === 0` là khởi tạo, thi hành ngay, không gửi op 23.
- `transition_id > 0` thì đưa vào `pendingTransitions`, gửi op 23, chờ op 22.
- Chuyển sang `protocol_version === 0` là downgrade: có ai trong kênh không hỗ trợ DAVE.
  Bật passthrough 24 giây rồi truyền opus trần.
- Quay lại version > 0 là upgrade: bật passthrough 10 giây cho gói còn trên đường.
- `epoch === 1` trong op 24 là dấu hiệu phải `reinit()`.

### 4.6 Xử lý lỗi

- **Thiếu `@snazzah/davey`.** `require` bọc trong try/catch. Khi thiếu, `joinChannel` ném ngay,
  trước cả khi mở websocket:

  ```
  Voice requires end-to-end encryption. Install it: npm i @snazzah/davey
  ```

  Không để rơi xuống 4017, vì 4017 không nói cho ai biết phải cài gì.

- **Commit hoặc welcome hỏng.** Gửi op 31 `dave_mls_invalid_commit_welcome` kèm transition id
  rồi `reinit()`.
- **Decrypt hỏng liên tiếp.** Đếm; quá 36 lần thì `recoverFromInvalidTransition`. Trong lúc
  đang reinit hoặc còn transition treo thì chỉ log, không đếm.
- **Silence frame.** `Buffer.from([0xf8, 0xff, 0xfe])` (`Silence.SILENCE_FRAME`, đã có sẵn)
  đi thẳng, không mã hoá, không giải mã.
- **4017 giữ nguyên trong `FATAL_CLOSE_CODES`.** Sau khi xong việc mà nó còn nổ thì là lỗi thật,
  không phải thiếu tính năng.

### 4.7 Thứ tự mã hoá

Gửi:

```
opus frame -> dave.encrypt() -> aes-256-gcm (BaseDispatcher.js:324) -> RTP -> UDP
```

Nhận:

```
UDP -> RTP -> giải aes-256-gcm (PacketHandler.js:100) -> dave.decrypt(userId) -> opus
```

E2EE nằm **trong** transport encryption, không thay thế nó. `decrypt` trả `null` nghĩa là bỏ
gói đó chứ không phải lỗi.

## 5. Test

### Unit (`node --test`, không chạm mạng)

| Kiểm                                                                                          | Vì sao                                        |
| --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `packBinary`/`unpack` roundtrip, và `unpack` một chuỗi JSON vẫn ra object                     | Framing sai là hỏng câm                       |
| Offset op 27 / 29 / 30 tách đúng optype và transition id                                      | Lệch một byte là MLS hỏng, không có thông báo |
| IDENTIFY của `VoiceConnection` không có `streams`, của `StreamConnection` thì có              | Chống hồi quy cho Go Live                     |
| IDENTIFY luôn có `max_dave_protocol_version`                                                  | Chính là thứ gây ra 4017                      |
| Routing: op 21/22/24 vào JSON handler, 25–31 vào binary handler                               |                                               |
| `prepareTransition(0)` thi hành ngay và không gửi op 23; `prepareTransition(5)` thì ngược lại |                                               |
| Downgrade về v0 bật passthrough; upgrade tắt                                                  |                                               |
| Ngưỡng 36 lần decrypt hỏng mới recover                                                        |                                               |
| `connectedClients` cộng theo op 11, trừ theo op 13                                            |                                               |
| Thiếu davey thì `joinChannel` ném đúng câu                                                    |                                               |

Session MLS thật được stub trong unit test. Không test lại crypto của davey.

### Smoke (`npm run smoke:voice`, chạm Discord thật)

Tiêu chí xong:

- Không còn close code 4017.
- Tới READY và SESSION_DESCRIPTION.
- `dave_protocol_version` trong log là 1.
- `joinChannel` chuyển từ FAIL sang PASS trong `scripts/smoke/results.md`.

Bốn check còn lại (`playAudio`, `createStreamConnection`, `receiver.createStream`,
`disconnect`) chỉ đánh giá lại sau khi joinChannel PASS; cái nào cần ffmpeg mà máy không có
thì ghi SKIP kèm lý do, không ghi PASS.

## 6. Rủi ro

| Rủi ro                                                                   | Xử lý                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Tách `streams`/`video` làm chết Go Live                                  | `identifyExtras` giữ nguyên payload cũ cho `StreamConnection`, kèm unit test     |
| Native module không build được trên máy người dùng                       | `optionalDependencies` + thông báo lỗi nói rõ phải cài gì                        |
| Hết 4017 rồi lộ ra lớp lỗi tiếp theo ở UDP/RTP, phần cũng chưa từng chạy | Chấp nhận. Đó là tiến bộ chứ không phải thất bại; ghi vào results.md như lỗi mới |
| Discord đổi DAVE lên v2                                                  | `DAVE_PROTOCOL_VERSION` đọc từ davey, không hardcode                             |
| Video/Go Live vẫn không có E2EE                                          | Nằm ngoài phạm vi, ghi rõ trong results.md                                       |

## 7. Ngoài phạm vi

- E2EE cho video frame và luồng Go Live.
- Verification code và voice privacy code trên UI (davey có sẵn API, chưa expose).
- Thay `opusscript` bằng `@discordjs/opus`, và đóng gói ffmpeg.
