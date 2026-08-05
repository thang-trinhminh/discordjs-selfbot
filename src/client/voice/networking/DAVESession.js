'use strict';

const { Buffer } = require('node:buffer');
const EventEmitter = require('node:events');
const Silence = require('../util/Silence');

// `@snazzah/davey` là optionalDependency: nó là binding native, và người chỉ dùng
// REST không có lý do gì phải build nó. Thiếu thì `ClientVoiceManager#joinChannel`
// chặn từ trước, chứ không để rơi xuống close code 4017 chẳng nói cho ai biết gì.
let Davey = null;
try {
  Davey = require('@snazzah/davey');
} catch {
  Davey = null;
}

/**
 * Phiên bản DAVE cao nhất bọc được. `0` nghĩa là không có davey.
 * @type {number}
 */
const DAVE_PROTOCOL_VERSION = Davey ? Davey.DAVE_PROTOCOL_VERSION : 0;

/**
 * @type {string}
 */
const MISSING_DAVEY = [
  'Voice requires the DAVE end-to-end encryption protocol, which Discord has enforced',
  'for every non-stage voice call since March 2026. Without it the voice gateway closes',
  'the connection with 4017.',
  '',
  'Install it: npm i @snazzah/davey',
].join('\n');

/**
 * Số giây một transition cũ còn được coi là hợp lệ.
 * @type {number}
 */
const TRANSITION_EXPIRY = 10;

/**
 * Hạ cấp mất khoảng 3 giây, nhưng kết nối chậm thì lâu hơn. 24 giây là khoảng đệm
 * để gói còn trên đường không bị vứt oan.
 * @type {number}
 */
const TRANSITION_EXPIRY_PENDING_DOWNGRADE = 24;

/**
 * Vào phiên mới thường có vài gói cũ lọt qua và giải mã hỏng. Chỉ khi hỏng liên
 * tiếp quá ngưỡng này mới coi là phiên hỏng thật.
 * @type {number}
 */
const DEFAULT_DECRYPTION_FAILURE_TOLERANCE = 36;

/**
 * `Davey.MediaType.AUDIO`. Viết thẳng số vì đó là `const enum` của NAPI, không đọc
 * được khi davey vắng mặt.
 * @type {number}
 */
const MEDIA_TYPE_AUDIO = 0;

/**
 * Quản lý phiên MLS của giao thức DAVE.
 *
 * Là bản port sang JS của `packages/voice/src/networking/DAVESession.ts` trong
 * discord.js. Giữ nguyên ngữ nghĩa để còn đối chiếu được khi upstream sửa.
 * @extends {EventEmitter}
 * @private
 */
class DAVESession extends EventEmitter {
  constructor(protocolVersion, userId, channelId, options = {}) {
    super();

    /**
     * Phiên bản giao thức đang dùng.
     * @type {number}
     */
    this.protocolVersion = protocolVersion;

    /**
     * @type {Snowflake}
     */
    this.userId = userId;

    /**
     * @type {Snowflake}
     */
    this.channelId = channelId;

    /**
     * Transition cuối cùng đã thi hành.
     * @type {?number}
     */
    this.lastTransitionId = null;

    /**
     * Transition đã báo trước nhưng chưa thi hành, khoá là id và giá trị là phiên bản.
     * @type {Map<number, number>}
     * @private
     */
    this.pendingTransitions = new Map();

    /**
     * Phiên này đã từng bị hạ cấp chưa.
     * @type {boolean}
     * @private
     */
    this.downgraded = false;

    /**
     * @type {number}
     * @private
     */
    this.consecutiveFailures = 0;

    /**
     * @type {number}
     * @private
     */
    this.failureTolerance = options.decryptionFailureTolerance ?? DEFAULT_DECRYPTION_FAILURE_TOLERANCE;

    /**
     * Đang khởi tạo lại vì một transition hỏng.
     * @type {boolean}
     */
    this.reinitializing = false;

    /**
     * Phiên davey bên dưới.
     * @type {?Object}
     */
    this.session = null;
  }

  /**
   * Tạo phiên davey. Tách riêng để test thay được bằng stub.
   * @returns {Object}
   */
  createSession() {
    if (!Davey) throw new Error(MISSING_DAVEY);
    return new Davey.DAVESession(this.protocolVersion, this.userId, this.channelId);
  }

  /**
   * Mã xác thực quyền riêng tư của phiên, `null` khi chưa có phiên.
   * @type {?string}
   * @readonly
   */
  get voicePrivacyCode() {
    if (this.protocolVersion === 0 || !this.session?.voicePrivacyCode) return null;
    return this.session.voicePrivacyCode;
  }

  /**
   * Khởi tạo, hoặc khởi tạo lại, phiên bên dưới.
   */
  reinit() {
    if (this.protocolVersion > 0) {
      if (this.session) {
        this.session.reinit(this.protocolVersion, this.userId, this.channelId);
        this.emit('debug', `Session reinitialized for protocol version ${this.protocolVersion}`);
      } else {
        this.session = this.createSession();
        this.emit('debug', `Session initialized for protocol version ${this.protocolVersion}`);
      }
      this.emit('keyPackage', this.session.getSerializedKeyPackage());
    } else if (this.session) {
      this.session.reset();
      this.session.setPassthroughMode(true, TRANSITION_EXPIRY);
      this.emit('debug', 'Session reset');
    }
  }

  /**
   * @param {Buffer} externalSender Dữ liệu external sender
   */
  setExternalSender(externalSender) {
    if (!this.session) throw new Error('No session available');
    this.session.setExternalSender(externalSender);
    this.emit('debug', 'Set MLS external sender');
  }

  /**
   * @param {Object} data Payload của opcode 21
   * @returns {boolean} Có phải báo lại cho voice server là đã sẵn sàng không
   */
  prepareTransition(data) {
    this.emit('debug', `Preparing for transition (${data.transition_id}, v${data.protocol_version})`);
    this.pendingTransitions.set(data.transition_id, data.protocol_version);

    // Transition id 0 là khởi tạo, thi hành ngay và không cần báo lại.
    if (data.transition_id === 0) {
      this.executeTransition(data.transition_id);
      return false;
    }

    if (data.protocol_version === 0) {
      this.session?.setPassthroughMode(true, TRANSITION_EXPIRY_PENDING_DOWNGRADE);
    }
    return true;
  }

  /**
   * @param {number} transitionId Transition cần thi hành
   * @returns {boolean}
   */
  executeTransition(transitionId) {
    this.emit('debug', `Executing transition (${transitionId})`);
    if (!this.pendingTransitions.has(transitionId)) {
      this.emit('debug', `Received execute transition, but we don't have a pending transition for ${transitionId}`);
      return false;
    }

    const oldVersion = this.protocolVersion;
    this.protocolVersion = this.pendingTransitions.get(transitionId);

    if (oldVersion !== this.protocolVersion && this.protocolVersion === 0) {
      this.downgraded = true;
      this.emit('debug', 'Session downgraded');
    } else if (transitionId > 0 && this.downgraded) {
      this.downgraded = false;
      this.session?.setPassthroughMode(true, TRANSITION_EXPIRY);
      this.emit('debug', 'Session upgraded');
    }

    this.reinitializing = false;
    this.lastTransitionId = transitionId;
    this.emit('debug', `Transition executed (v${oldVersion} -> v${this.protocolVersion}, id: ${transitionId})`);

    this.pendingTransitions.delete(transitionId);
    return true;
  }

  /**
   * @param {Object} data Payload của opcode 24
   */
  prepareEpoch(data) {
    this.emit('debug', `Preparing for epoch (${data.epoch})`);
    if (data.epoch === 1) {
      this.protocolVersion = data.protocol_version;
      this.reinit();
    }
  }

  /**
   * Khởi tạo lại sau một transition hỏng.
   * @param {number} transitionId Transition cần huỷ
   */
  recoverFromInvalidTransition(transitionId) {
    if (this.reinitializing) return;
    this.emit('debug', `Invalidating transition ${transitionId}`);
    this.reinitializing = true;
    this.consecutiveFailures = 0;
    this.emit('invalidateTransition', transitionId);
    this.reinit();
  }

  /**
   * @param {Buffer} payload Payload nhị phân của opcode 27
   * @param {Set<Snowflake>} connectedClients Ai đang trong kênh
   * @returns {?Buffer} Payload cho opcode 28, hoặc `undefined` nếu không có commit
   */
  processProposals(payload, connectedClients) {
    if (!this.session) throw new Error('No session available');

    // Byte đầu là kiểu thao tác (0 append, 1 revoke), phần còn lại mới là proposals.
    const optype = payload.readUInt8(0);
    const { commit, welcome } = this.session.processProposals(
      optype,
      payload.subarray(1),
      Array.from(connectedClients),
    );
    this.emit('debug', 'MLS proposals processed');

    if (!commit) return undefined;
    return welcome ? Buffer.concat([commit, welcome]) : commit;
  }

  /**
   * @param {Buffer} payload Payload nhị phân của opcode 29
   * @returns {{ transitionId: number, success: boolean }}
   */
  processCommit(payload) {
    if (!this.session) throw new Error('No session available');

    const transitionId = payload.readUInt16BE(0);
    try {
      this.session.processCommit(payload.subarray(2));
      this._acceptTransition(transitionId);
      this.emit('debug', `MLS commit processed (transition id: ${transitionId})`);
      return { transitionId, success: true };
    } catch (error) {
      this.emit('debug', `MLS commit errored from transition ${transitionId}: ${error}`);
      this.recoverFromInvalidTransition(transitionId);
      return { transitionId, success: false };
    }
  }

  /**
   * @param {Buffer} payload Payload nhị phân của opcode 30
   * @returns {{ transitionId: number, success: boolean }}
   */
  processWelcome(payload) {
    if (!this.session) throw new Error('No session available');

    const transitionId = payload.readUInt16BE(0);
    try {
      this.session.processWelcome(payload.subarray(2));
      this._acceptTransition(transitionId);
      this.emit('debug', `MLS welcome processed (transition id: ${transitionId})`);
      return { transitionId, success: true };
    } catch (error) {
      this.emit('debug', `MLS welcome errored from transition ${transitionId}: ${error}`);
      this.recoverFromInvalidTransition(transitionId);
      return { transitionId, success: false };
    }
  }

  /**
   * @param {number} transitionId Transition vừa nhận được
   * @private
   */
  _acceptTransition(transitionId) {
    if (transitionId === 0) {
      this.reinitializing = false;
      this.lastTransitionId = transitionId;
    } else {
      this.pendingTransitions.set(transitionId, this.protocolVersion);
    }
  }

  /**
   * @param {Buffer} packet Gói opus
   * @returns {Buffer}
   */
  encrypt(packet) {
    if (this.protocolVersion === 0 || !this.session?.ready || packet.equals(Silence.SILENCE_FRAME)) return packet;
    return this.session.encryptOpus(packet);
  }

  /**
   * @param {Buffer} packet Gói opus đã qua giải mã transport
   * @param {Snowflake} userId Người gửi
   * @returns {?Buffer} `null` nghĩa là bỏ gói này
   */
  decrypt(packet, userId) {
    const canDecrypt = this.session?.ready && (this.protocolVersion !== 0 || this.session?.canPassthrough(userId));
    if (packet.equals(Silence.SILENCE_FRAME) || !canDecrypt || !this.session) return packet;

    try {
      const buffer = this.session.decrypt(userId, MEDIA_TYPE_AUDIO, packet);
      this.consecutiveFailures = 0;
      return buffer;
    } catch (error) {
      if (this.reinitializing) {
        this.emit('debug', 'Failed to decrypt a packet (reinitializing session)');
      } else if (this.pendingTransitions.size > 0) {
        this.emit('debug', `Failed to decrypt a packet (${this.pendingTransitions.size} pending transition[s])`);
      } else {
        this.consecutiveFailures++;
        this.emit('debug', `Failed to decrypt a packet (${this.consecutiveFailures} consecutive fails)`);
        if (this.consecutiveFailures > this.failureTolerance) {
          // Upstream kiểm `if (this.lastTransitionId)`, nên transition 0 — chính là
          // transition khởi tạo, trường hợp thường gặp nhất — rơi vào nhánh ném lỗi
          // thay vì nhánh phục hồi. So với `null` để 0 vẫn phục hồi được.
          if (this.lastTransitionId === null) throw error;
          this.recoverFromInvalidTransition(this.lastTransitionId);
        }
      }
    }

    return null;
  }

  destroy() {
    try {
      this.session?.reset();
    } catch {
      // Phiên đã chết rồi thì không có gì để dọn.
    }
  }
}

module.exports = { DAVESession, DAVE_PROTOCOL_VERSION, MISSING_DAVEY };
