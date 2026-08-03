'use strict';

const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Quản lý ghi chú riêng tư client user đặt cho user khác.
 * @extends {BaseManager}
 */
class UserNoteManager extends BaseManager {
  constructor(client, data = {}) {
    super(client);

    /**
     * Ghi chú theo user id.
     * @type {Collection<Snowflake, string>}
     */
    this.cache = new Collection(Object.entries(data));
  }

  /**
   * Thay toàn bộ cache bằng dữ liệu từ READY.
   * @param {Object<Snowflake, string>} [data={}] Map ghi chú thô
   * @returns {UserNoteManager}
   * @private
   */
  _reload(data = {}) {
    this.cache = new Collection(Object.entries(data ?? {}));
    return this;
  }

  /**
   * Đưa {@link UserResolvable} về user id.
   * @param {UserResolvable} user Thứ cần resolve
   * @returns {?Snowflake}
   */
  resolveId(user) {
    return this.client.users.resolveId(user);
  }

  /**
   * Đặt hoặc xoá ghi chú cho một user.
   * @param {UserResolvable} user User được ghi chú
   * @param {?string} [note=null] Nội dung ghi chú, `null` để xoá
   * @returns {Promise<UserNoteManager>}
   */
  async updateNote(user, note = null) {
    const id = this.resolveId(user);
    await this.client.rest.put(UserRoutes.note(id), { body: { note } });

    if (note) this.cache.set(id, note);
    else this.cache.delete(id);

    return this;
  }

  /**
   * Lấy ghi chú của một user.
   * @param {UserResolvable} user User cần lấy ghi chú
   * @param {Object} [options] Tuỳ chọn
   * @param {boolean} [options.cache=true] Có ghi kết quả vào cache không
   * @param {boolean} [options.force=false] Bỏ qua cache, hỏi thẳng API
   * @returns {Promise<string>} Chuỗi rỗng nếu user đó không có ghi chú
   */
  async fetch(user, { cache = true, force = false } = {}) {
    const id = this.resolveId(user);

    if (!force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }

    // Discord trả 404 khi user không có ghi chú, không phải lỗi thật.
    const note = await this.client.rest
      .get(UserRoutes.note(id))
      .then(data => data.note)
      .catch(() => '');

    if (cache && note) this.cache.set(id, note);
    return note;
  }
}

module.exports = UserNoteManager;
