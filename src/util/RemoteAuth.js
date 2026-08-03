'use strict';

const { Buffer } = require('node:buffer');
const { constants, createHash, generateKeyPairSync, privateDecrypt } = require('node:crypto');
const EventEmitter = require('node:events');
const { setTimeout, clearTimeout } = require('node:timers');
const WebSocket = require('ws');
const { UserRoutes } = require('./UserRoutes');

const GATEWAY_URL = 'wss://remote-auth-gateway.discord.gg/?v=2';
const QR_BASE_URL = 'https://discord.com/ra/';

/**
 * Op nhận từ remote auth gateway.
 * @type {Object<string, string>}
 */
const ReceiveOp = {
  Hello: 'hello',
  NonceProof: 'nonce_proof',
  PendingRemoteInit: 'pending_remote_init',
  HeartbeatAck: 'heartbeat_ack',
  PendingTicket: 'pending_ticket',
  PendingLogin: 'pending_login',
  Cancel: 'cancel',
};

/**
 * Op gửi lên remote auth gateway.
 * @type {Object<string, string>}
 */
const SendOp = {
  Init: 'init',
  NonceProof: 'nonce_proof',
  Heartbeat: 'heartbeat',
};

/**
 * Đăng nhập bằng cách quét mã QR, đúng luồng nút "Log in with QR Code" trên
 * Discord desktop.
 *
 * Toàn bộ trao đổi được mã hoá bằng một cặp khoá RSA-2048 dựng tại chỗ: máy chủ
 * mã hoá bằng khoá công khai vừa gửi lên, chỉ tiến trình này giải được.
 *
 * @extends {EventEmitter}
 * @example
 * const auth = new RemoteAuth();
 * auth.on('ready', () => console.log(auth.qrCodeURL));
 * auth.on('pending', user => console.log('Đã quét:', user.username));
 * await auth.connect(client); // đăng nhập client luôn khi lấy được token
 */
class RemoteAuth extends EventEmitter {
  #ws = null;
  #privateKey = null;
  #publicKey = null;
  #heartbeatInterval = null;
  #heartbeatTimer = null;
  #rest = null;
  #createSocket = null;

  /**
   * @param {Object} [options={}] Tuỳ chọn
   * @param {?REST} [options.rest] REST dùng để đổi ticket lấy token. Bỏ trống thì
   * tự dựng một cái từ tuỳ chọn mặc định — truyền vào nếu cần proxy hoặc captcha solver
   * @param {?Function} [options.createSocket] Hàm dựng WebSocket. Chỉ để test có
   * chỗ nhét socket giả vào; bỏ trống thì mở kết nối thật
   */
  constructor({ rest, createSocket } = {}) {
    super();

    /**
     * Vân tay của phiên, phần định danh trong link QR.
     * @type {?string}
     */
    this.fingerprint = null;

    /**
     * Thông tin tài khoản vừa quét mã, có sau sự kiện `pending`.
     * @type {?Object}
     */
    this.user = null;

    /**
     * Thời điểm phiên hết hạn.
     * @type {?Date}
     */
    this.expiresAt = null;

    this.#rest = rest ?? null;
    this.#createSocket = createSocket ?? (url => new WebSocket(url, { origin: 'https://discord.com' }));
  }

  /**
   * Link nhúng vào mã QR.
   * @type {?string}
   * @readonly
   */
  get qrCodeURL() {
    return this.fingerprint ? `${QR_BASE_URL}${this.fingerprint}` : null;
  }

  /**
   * Mở kết nối tới remote auth gateway.
   * @param {?Client} [client] Nếu truyền, tự `login()` client đó khi lấy được token
   * @returns {Promise<string>} Token lấy được
   */
  connect(client) {
    this.#rest ??=
      client?.rest ?? require('../rest/SelfbotREST').createSelfbotREST(require('./Options').createDefault());

    this.#ws = this.#createSocket(GATEWAY_URL);
    this.#ws.on('message', data => this.#handleMessage(data));
    this.#ws.on('error', error => this.emit('error', error));
    this.#ws.on('close', () => {
      this.#stopHeartbeat();
      this.emit('closed');
    });

    return new Promise((resolve, reject) => {
      this.once('finish', async token => {
        if (client) await client.login(token);
        resolve(token);
      });
      this.once('error', reject);
      this.once('cancel', () => reject(new Error('The login was cancelled from the other device')));
    });
  }

  /**
   * Đóng kết nối.
   * @returns {void}
   */
  destroy() {
    this.#stopHeartbeat();
    // Bản v13 kiểm `this.ws` — thuộc tính công khai không tồn tại, vì socket nằm
    // ở field riêng `#ws`. Nên `destroy()` luôn thoát sớm và không đóng gì cả.
    if (!this.#ws) return;
    this.#ws.close();
    this.#ws = null;
    this.emit('closed');
  }

  /**
   * In mã QR ra terminal.
   * @returns {Promise<string>} Mã QR dạng ký tự
   */
  async generateQR() {
    if (!this.qrCodeURL) throw new Error('The session is not ready yet, wait for the "ready" event');

    const { toString } = require('qrcode');
    return new Promise((resolve, reject) => {
      toString(this.qrCodeURL, { type: 'utf8', errorCorrectionLevel: 'L' }, (error, output) =>
        error ? reject(error) : resolve(output),
      );
    });
  }

  #send(op, data) {
    this.#ws?.send(JSON.stringify({ op, ...data }));
  }

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.#heartbeatTimer = setTimeout(() => this.#send(SendOp.Heartbeat), this.#heartbeatInterval);
    this.#heartbeatTimer.unref?.();
  }

  #stopHeartbeat() {
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer);
    this.#heartbeatTimer = null;
  }

  /**
   * Giải mã một payload máy chủ gửi bằng khoá riêng của phiên.
   * @param {string} encrypted Payload base64
   * @returns {Buffer}
   */
  #decrypt(encrypted) {
    return privateDecrypt(
      { key: this.#privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(encrypted, 'base64'),
    );
  }

  #handleMessage(raw) {
    const message = JSON.parse(raw);

    switch (message.op) {
      case ReceiveOp.Hello:
        this.expiresAt = new Date(Date.now() + message.timeout_ms);
        this.#heartbeatInterval = message.heartbeat_interval;
        this.#createKeyPair();
        this.#startHeartbeat();
        this.#send(SendOp.Init, { encoded_public_key: encodePublicKey(this.#publicKey) });
        break;

      case ReceiveOp.NonceProof:
        this.#send(SendOp.NonceProof, {
          proof: base64url(createHash('sha256').update(this.#decrypt(message.encrypted_nonce)).digest()),
        });
        break;

      case ReceiveOp.PendingRemoteInit:
        this.fingerprint = message.fingerprint;
        /**
         * Emitted when the QR code is ready to be shown.
         * @event RemoteAuth#ready
         */
        this.emit('ready');
        break;

      case ReceiveOp.HeartbeatAck:
        this.#startHeartbeat();
        break;

      case ReceiveOp.PendingTicket:
        this.user = parseUserPayload(this.#decrypt(message.encrypted_user_payload).toString());
        /**
         * Emitted when the QR code has been scanned but not yet approved.
         * @event RemoteAuth#pending
         * @param {Object} user The account that scanned the code
         */
        this.emit('pending', this.user);
        break;

      case ReceiveOp.PendingLogin:
        this.#exchangeTicket(message.ticket);
        break;

      case ReceiveOp.Cancel:
        /**
         * Emitted when the login is cancelled from the other device.
         * @event RemoteAuth#cancel
         */
        this.emit('cancel');
        this.destroy();
        break;

      default:
        this.emit('debug', `Unhandled remote auth op: ${message.op}`);
    }
  }

  #createKeyPair() {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
  }

  /**
   * Đổi ticket lấy token thật.
   * @param {string} ticket Ticket máy chủ cấp
   * @returns {Promise<void>}
   */
  async #exchangeTicket(ticket) {
    try {
      // Đi qua REST của thư viện chứ không `fetch` trần như bản v13, để dùng
      // chung header spoof, proxy và captcha solver.
      const { encrypted_token: encryptedToken } = await this.#rest.post(UserRoutes.remoteAuthLogin(), {
        body: { ticket },
      });

      const token = this.#decrypt(encryptedToken).toString();
      this.destroy();

      /**
       * Emitted once the token has been retrieved.
       * @event RemoteAuth#finish
       * @param {string} token The account token
       */
      this.emit('finish', token);
    } catch (error) {
      this.emit('error', error);
    }
  }
}

/**
 * Bỏ dòng header/footer PEM và xuống dòng, còn lại phần base64 thuần.
 * @param {string} publicKey Khoá công khai dạng PEM
 * @returns {string}
 */
function encodePublicKey(publicKey) {
  return publicKey
    .split('\n')
    .filter(line => line && !line.startsWith('-----'))
    .join('');
}

/**
 * Mã hoá base64url: `+` thành `-`, `/` thành `_`, bỏ padding.
 * @param {Buffer} data Dữ liệu
 * @returns {string}
 */
function base64url(data) {
  return data.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/**
 * Bóc payload tài khoản, dạng `id:discriminator:avatar:username`.
 * @param {string} payload Chuỗi đã giải mã
 * @returns {Object}
 */
function parseUserPayload(payload) {
  const [id, discriminator, avatar, username] = payload.split(':');
  return { id, discriminator, avatar: avatar || null, username };
}

module.exports = { RemoteAuth, encodePublicKey, base64url, parseUserPayload, ReceiveOp, SendOp };
