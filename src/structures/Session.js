'use strict';

const Base = require('./Base');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * @typedef {Object} SessionClientInfo
 * @property {string} location Vị trí suy ra từ IP
 * @property {string} platform Nền tảng (desktop, mobile, web)
 * @property {string} os Hệ điều hành
 */

/**
 * Một phiên đăng nhập của client user trên một thiết bị.
 * @extends {Base}
 */
class Session extends Base {
  constructor(client, data) {
    super(client);
    this._patch(data);
  }

  _patch(data) {
    if ('id_hash' in data) {
      /**
       * Hash id của phiên. Discord không trả id thật.
       * @type {string}
       */
      this.id = data.id_hash;
    }

    if ('approx_last_used_time' in data) {
      /**
       * Thời điểm phiên được dùng lần cuối (xấp xỉ, ISO8601).
       * @type {string}
       */
      this.approxLastUsedTime = data.approx_last_used_time;
    }

    if ('client_info' in data) {
      /**
       * Thông tin thiết bị của phiên.
       * @type {SessionClientInfo}
       */
      this.clientInfo = data.client_info;
    }
  }

  /**
   * Timestamp phiên được dùng lần cuối.
   * @type {number}
   * @readonly
   */
  get lastUsedTimestamp() {
    return this.lastUsedAt.getTime();
  }

  /**
   * Thời điểm phiên được dùng lần cuối.
   * @type {Date}
   * @readonly
   */
  get lastUsedAt() {
    return new Date(this.approxLastUsedTime);
  }

  /**
   * Thời điểm phiên được dùng lần cuối.
   * @type {Date}
   * @readonly
   * @deprecated Tên cũ của v13. `Session` không có thời điểm tạo — dùng
   * {@link Session#lastUsedAt}. Base#createdAt suy từ snowflake, mà id của
   * Session là hash nên không suy được.
   */
  get createdAt() {
    return this.lastUsedAt;
  }

  /**
   * Timestamp phiên được dùng lần cuối.
   * @type {number}
   * @readonly
   * @deprecated Tên cũ của v13, dùng {@link Session#lastUsedTimestamp}.
   */
  get createdTimestamp() {
    return this.lastUsedTimestamp;
  }

  /**
   * Đăng xuất phiên này từ xa.
   * @returns {Promise<void>}
   */
  logout() {
    return this.client.rest.post(UserRoutes.authSessionsLogout(), {
      body: { session_id_hashes: [this.id] },
    });
  }
}

module.exports = Session;
