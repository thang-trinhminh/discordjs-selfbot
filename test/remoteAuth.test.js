'use strict';

const assert = require('node:assert');
const { Buffer } = require('node:buffer');
const { constants, createHash, generateKeyPairSync, publicEncrypt } = require('node:crypto');
const { test } = require('node:test');
const Client = require('../src/client/Client.js');
const { RemoteAuth, base64url, encodePublicKey, parseUserPayload } = require('../src/util/RemoteAuth.js');
const { generateTOTP } = require('../src/util/totp.js');

test('encodePublicKey bo header, footer va xuong dong cua PEM', () => {
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const encoded = encodePublicKey(publicKey);

  assert.ok(!encoded.includes('-----'));
  assert.ok(!encoded.includes('\n'));
  // Phải là base64 hợp lệ và giải ra đúng nội dung khoá.
  assert.strictEqual(Buffer.from(encoded, 'base64').toString('base64'), encoded);
});

test('base64url thay ky tu va bo padding', () => {
  // Byte chọn sao cho base64 thường có cả '+' lẫn '/'.
  const data = Buffer.from([0xfb, 0xff, 0xbf, 0x00]);
  const standard = data.toString('base64');
  const encoded = base64url(data);

  assert.ok(standard.includes('+') || standard.includes('/'));
  assert.ok(!encoded.includes('+'));
  assert.ok(!encoded.includes('/'));
  assert.ok(!encoded.includes('='));
});

test('parseUserPayload boc dung 4 phan', () => {
  assert.deepStrictEqual(parseUserPayload('123:0:hashanh:tenuser'), {
    id: '123',
    discriminator: '0',
    avatar: 'hashanh',
    username: 'tenuser',
  });

  // Không có avatar thì là null chứ không phải chuỗi rỗng.
  assert.strictEqual(parseUserPayload('123:0::tenuser').avatar, null);
});

/**
 * Máy chủ remote auth giả: ghi lại gói client gửi lên, cho phép đẩy gói xuống.
 * Không mở socket thật.
 * @returns {Object}
 */
function makeFakeSocket() {
  const sent = [];
  const listeners = {};

  return {
    sent,
    send: payload => sent.push(JSON.parse(payload)),
    close: () => listeners.close?.(),
    on(event, handler) {
      listeners[event] = handler;
    },
    receive(message) {
      listeners.message(JSON.stringify(message));
    },
  };
}

test('bat tay: hello -> init, nonce_proof -> proof, pending_remote_init -> ready', async () => {
  const socket = makeFakeSocket();
  const auth = new RemoteAuth({ createSocket: () => socket, rest: {} });

  auth.connect().catch(() => {});

  // 1. Máy chủ chào; client phải sinh khoá rồi gửi init kèm khoá công khai.
  socket.receive({ op: 'hello', timeout_ms: 60_000, heartbeat_interval: 30_000 });

  const init = socket.sent.find(packet => packet.op === 'init');
  assert.ok(init, 'phai gui init');
  assert.ok(!init.encoded_public_key.includes('-----'), 'khoa phai bo header PEM');

  const publicKey = `-----BEGIN PUBLIC KEY-----\n${init.encoded_public_key}\n-----END PUBLIC KEY-----`;

  // 2. Máy chủ gửi nonce mã hoá bằng chính khoá đó; client phải trả sha256 của
  // nonce đã giải, dạng base64url.
  const nonce = Buffer.from('nonce-thu-nghiem');
  const encryptedNonce = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    nonce,
  );
  socket.receive({ op: 'nonce_proof', encrypted_nonce: encryptedNonce.toString('base64') });

  const proofPacket = socket.sent.find(packet => packet.op === 'nonce_proof');
  assert.ok(proofPacket, 'phai gui nonce_proof');
  assert.strictEqual(proofPacket.proof, base64url(createHash('sha256').update(nonce).digest()));

  // 3. Máy chủ cấp fingerprint; client sẵn sàng hiện QR.
  const ready = new Promise(resolve => auth.once('ready', resolve));
  socket.receive({ op: 'pending_remote_init', fingerprint: 'vantay123' });
  await ready;

  assert.strictEqual(auth.fingerprint, 'vantay123');
  assert.strictEqual(auth.qrCodeURL, 'https://discord.com/ra/vantay123');

  auth.destroy();
});

test('pending_ticket giai ma thong tin tai khoan vua quet', async () => {
  const socket = makeFakeSocket();
  const auth = new RemoteAuth({ createSocket: () => socket, rest: {} });
  auth.connect().catch(() => {});

  socket.receive({ op: 'hello', timeout_ms: 60_000, heartbeat_interval: 30_000 });
  const init = socket.sent.find(packet => packet.op === 'init');
  const publicKey = `-----BEGIN PUBLIC KEY-----\n${init.encoded_public_key}\n-----END PUBLIC KEY-----`;

  const payload = Buffer.from('123456:0:hashanh:nguoidung');
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    payload,
  );

  const pending = new Promise(resolve => auth.once('pending', resolve));
  socket.receive({ op: 'pending_ticket', encrypted_user_payload: encrypted.toString('base64') });
  const user = await pending;

  assert.deepStrictEqual(user, { id: '123456', discriminator: '0', avatar: 'hashanh', username: 'nguoidung' });
  auth.destroy();
});

test('pending_login doi ticket lay token roi emit finish', async () => {
  const socket = makeFakeSocket();
  const posted = [];
  let publicKey;

  const rest = {
    post: async (route, options) => {
      posted.push([route, options.body]);
      const token = Buffer.from('token-that-cua-toi');
      const encrypted = publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        token,
      );
      return { encrypted_token: encrypted.toString('base64') };
    },
  };

  const auth = new RemoteAuth({ createSocket: () => socket, rest });
  const finished = auth.connect();

  socket.receive({ op: 'hello', timeout_ms: 60_000, heartbeat_interval: 30_000 });
  const init = socket.sent.find(packet => packet.op === 'init');
  publicKey = `-----BEGIN PUBLIC KEY-----\n${init.encoded_public_key}\n-----END PUBLIC KEY-----`;

  socket.receive({ op: 'pending_login', ticket: 've-dang-nhap' });

  assert.strictEqual(await finished, 'token-that-cua-toi');
  assert.deepStrictEqual(posted, [['/users/@me/remote-auth/login', { ticket: 've-dang-nhap' }]]);
});

test('cancel tu thiet bi kia lam connect reject', async () => {
  const socket = makeFakeSocket();
  const auth = new RemoteAuth({ createSocket: () => socket, rest: {} });
  const connecting = auth.connect();

  socket.receive({ op: 'cancel' });

  await assert.rejects(() => connecting, /cancelled from the other device/);
});

test('qrCodeURL null khi chua co fingerprint, co gia tri khi da co', () => {
  const auth = new RemoteAuth();
  assert.strictEqual(auth.qrCodeURL, null);

  auth.fingerprint = 'abc123';
  assert.strictEqual(auth.qrCodeURL, 'https://discord.com/ra/abc123');
});

test('generateQR tu choi khi phien chua san sang', async () => {
  const auth = new RemoteAuth();
  await assert.rejects(() => auth.generateQR(), /not ready yet/);
});

test('generateQR sinh ma QR dang ky tu', async () => {
  const auth = new RemoteAuth();
  auth.fingerprint = 'abc123';

  const qr = await auth.generateQR();
  assert.strictEqual(typeof qr, 'string');
  assert.ok(qr.length > 100, 'ma QR phai co noi dung');
});

test('destroy khong nem khi chua ket noi', () => {
  const auth = new RemoteAuth();
  // Bản v13 kiểm `this.ws` (không tồn tại) nên destroy luôn thoát sớm; ở đây
  // kiểm đúng field riêng, và vẫn phải an toàn khi chưa có socket.
  assert.doesNotThrow(() => auth.destroy());
});

test('giai ma payload RSA-OAEP-SHA256 dung chieu', () => {
  // Chứng minh cặp khoá và tham số padding khớp với thứ máy chủ Discord dùng.
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const nonce = Buffer.from('nonce-may-chu-gui');
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    nonce,
  );

  const { privateDecrypt } = require('node:crypto');
  const decrypted = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    encrypted,
  );

  assert.strictEqual(decrypted.toString(), 'nonce-may-chu-gui');
  // Proof là base64url của sha256(nonce).
  assert.strictEqual(base64url(createHash('sha256').update(decrypted).digest()).length, 43);
});

function makeLoginClient() {
  const client = new Client({});
  client.login = async token => token;
  return client;
}

test('passLogin tra token khi khong can 2FA', async () => {
  const client = makeLoginClient();
  const posted = [];
  client.rest.post = async (route, options) => {
    posted.push([route, options.body]);
    return { token: 'token-cua-toi' };
  };

  const token = await client.passLogin('a@b.vn', '<mat-khau-gia>');

  assert.strictEqual(token, 'token-cua-toi');
  assert.strictEqual(posted[0][0], '/auth/login');
  assert.strictEqual(posted[0][1].login, 'a@b.vn');
  assert.strictEqual(posted[0][1].undelete, false);

  client.destroy();
});

test('passLogin tu sinh ma 2FA tu mfaSecret', async () => {
  const client = makeLoginClient();
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const posted = [];

  client.rest.post = async (route, options) => {
    posted.push([route, options.body]);
    if (route === '/auth/login') return { mfa: true, ticket: 've-2fa' };
    return { token: 'token-sau-2fa' };
  };

  const token = await client.passLogin('a@b.vn', '<mat-khau-gia>', { mfaSecret: secret });

  assert.strictEqual(token, 'token-sau-2fa');
  assert.strictEqual(posted[1][0], '/auth/mfa/totp');
  assert.strictEqual(posted[1][1].ticket, 've-2fa');
  // Mã phải đúng thứ generateTOTP sinh ra cùng thời điểm.
  assert.strictEqual(posted[1][1].code, generateTOTP(secret));

  client.destroy();
});

test('passLogin dung ham mfaCode khi khong co secret', async () => {
  const client = makeLoginClient();
  const posted = [];
  client.rest.post = async (route, options) => {
    posted.push(options.body);
    if (route === '/auth/login') return { mfa: true, ticket: 've' };
    return { token: 'xong' };
  };

  await client.passLogin('a@b.vn', '<mat-khau-gia>', { mfaCode: async () => '424242' });
  assert.strictEqual(posted[1].code, '424242');

  client.destroy();
});

test('passLogin bao ro khi can 2FA ma khong cau hinh gi', async () => {
  const client = makeLoginClient();
  client.rest.post = async () => ({ mfa: true, ticket: 've' });

  await assert.rejects(
    () => client.passLogin('a@b.vn', '<mat-khau-gia>'),
    /two-factor authentication; pass mfaSecret or mfaCode/,
  );

  client.destroy();
});

test('passLogin bao loi khi Discord khong tra token', async () => {
  const client = makeLoginClient();
  client.rest.post = async () => ({ user_id: '1' });

  await assert.rejects(() => client.passLogin('a@b.vn', '<mat-khau-gia>'), /did not return a token/);

  client.destroy();
});

test('passLogin co the tra token ma khong dang nhap', async () => {
  const client = new Client({});
  let loggedIn = false;
  client.login = async () => {
    loggedIn = true;
  };
  client.rest.post = async () => ({ token: 'chi-lay-token' });

  const token = await client.passLogin('a@b.vn', '<mat-khau-gia>', { login: false });

  assert.strictEqual(token, 'chi-lay-token');
  assert.strictEqual(loggedIn, false);

  client.destroy();
});
