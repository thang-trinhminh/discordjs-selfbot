'use strict';

const CachedManager = require('./CachedManager');
const Session = require('../structures/Session');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Quản lý các phiên đăng nhập của client user.
 * @extends {CachedManager}
 */
class SessionManager extends CachedManager {
  constructor(client, iterable) {
    super(client, Session, iterable);

    /**
     * Hash id của phiên hiện tại, lấy từ payload READY.
     * @type {?string}
     */
    this.currentSessionIdHash = null;
  }

  /**
   * Cache các phiên, khoá theo hash id.
   * @type {Collection<string, Session>}
   * @name SessionManager#cache
   */

  /**
   * Tải lại toàn bộ phiên từ API.
   * @returns {Promise<Collection<string, Session>>}
   */
  async fetch() {
    const data = await this.client.rest.get(UserRoutes.authSessions());
    this.cache.clear();
    for (const session of data.user_sessions) {
      this._add(session, true, { id: session.id_hash });
    }
    return this.cache;
  }

  /**
   * Đăng xuất mọi phiên đang có trong cache.
   * <info>Gọi {@link SessionManager#fetch} trước, nếu không cache rỗng và
   * request này không làm gì cả.</info>
   * @returns {Promise<void>}
   */
  logoutAllDevices() {
    return this.client.rest.post(UserRoutes.authSessionsLogout(), {
      body: { session_id_hashes: this.cache.map(session => session.id) },
    });
  }

  /**
   * Phiên hiện tại của client.
   * <info>Trả `null` cho tới khi {@link SessionManager#fetch} chạy xong, vì
   * READY chỉ cho hash id chứ không cho dữ liệu phiên.</info>
   * @type {?Session}
   * @readonly
   */
  get currentSession() {
    if (!this.currentSessionIdHash) return null;
    return this.cache.get(this.currentSessionIdHash) ?? null;
  }
}

module.exports = SessionManager;
