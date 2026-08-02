'use strict';

const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const { RelationshipType } = require('../util/UserEnums');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Quản lý quan hệ (bạn bè, chặn, lời mời) của client user.
 *
 * Cache tách làm ba Collection thay vì một structure `Relationship`, vì Discord
 * gửi ba mẩu dữ liệu này ở ba event khác nhau và hiếm khi đủ cả ba.
 * @extends {BaseManager}
 */
class RelationshipManager extends BaseManager {
  constructor(client, relationships) {
    super(client);

    /**
     * Kiểu quan hệ theo user id.
     * @type {Collection<Snowflake, number>}
     */
    this.cache = new Collection();

    /**
     * Nickname client user đặt cho bạn bè.
     * @type {Collection<Snowflake, ?string>}
     */
    this.friendNicknames = new Collection();

    /**
     * Thời điểm quan hệ được tạo.
     * @type {Collection<Snowflake, Date>}
     */
    this.sinceCache = new Collection();

    this._setup(relationships);
  }

  /**
   * Lọc cache theo kiểu quan hệ rồi map sang User đã cache.
   * @param {number} type Kiểu quan hệ cần lọc
   * @returns {Collection<Snowflake, ?User>}
   * @private
   */
  _cacheOfType(type) {
    return new Collection(
      this.cache.filter(value => value === type).map((_, key) => [key, this.client.users.cache.get(key)]),
    );
  }

  /**
   * Bạn bè.
   * @type {Collection<Snowflake, ?User>}
   * @readonly
   */
  get friendCache() {
    return this._cacheOfType(RelationshipType.Friend);
  }

  /**
   * User đã chặn.
   * @type {Collection<Snowflake, ?User>}
   * @readonly
   */
  get blockedCache() {
    return this._cacheOfType(RelationshipType.Blocked);
  }

  /**
   * Lời mời kết bạn đến.
   * @type {Collection<Snowflake, ?User>}
   * @readonly
   */
  get incomingCache() {
    return this._cacheOfType(RelationshipType.PendingIncoming);
  }

  /**
   * Lời mời kết bạn đã gửi.
   * @type {Collection<Snowflake, ?User>}
   * @readonly
   */
  get outgoingCache() {
    return this._cacheOfType(RelationshipType.PendingOutgoing);
  }

  /**
   * @typedef {Object} RelationshipJSONData
   * @property {Snowflake} id Id của user đối phương
   * @property {number} type Kiểu quan hệ
   * @property {?string} nickname Nickname trong quan hệ này
   * @property {?string} since Thời điểm tạo quan hệ (ISO8601)
   */

  /**
   * Xuất cache ra dạng thuần.
   * @returns {RelationshipJSONData[]}
   */
  toJSON() {
    return this.cache.map((value, key) => ({
      id: key,
      type: value,
      nickname: this.friendNicknames.get(key) ?? null,
      since: this.sinceCache.get(key)?.toISOString() ?? null,
    }));
  }

  /**
   * Nạp mảng quan hệ thô từ READY hoặc từ REST vào cache.
   * @param {Array<Object>} [relationships] Mảng quan hệ thô
   * @returns {void}
   * @private
   */
  _setup(relationships) {
    if (!Array.isArray(relationships)) return;
    for (const relationship of relationships) {
      if (relationship.user) this.client.users._add(relationship.user);
      this.cache.set(relationship.id, relationship.type);
      this.friendNicknames.set(relationship.id, relationship.nickname ?? null);
      this.sinceCache.set(relationship.id, new Date(relationship.since ?? 0));
    }
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
   * Tải lại toàn bộ quan hệ từ API.
   * @param {UserResolvable} [user] Nếu truyền, trả về kiểu quan hệ với user đó
   * @returns {Promise<number|RelationshipManager>}
   */
  async fetch(user) {
    const data = await this.client.rest.get(UserRoutes.relationships());
    this.cache.clear();
    this.friendNicknames.clear();
    this.sinceCache.clear();
    this._setup(data);

    if (user) return this.cache.get(this.resolveId(user));
    return this;
  }

  /**
   * Đổi nickname của một người bạn.
   * @param {UserResolvable} user Người bạn cần đổi nickname
   * @param {?string} [nickname=null] Nickname mới, `null` để xoá
   * @returns {Promise<boolean>} `false` nếu user đó không phải bạn bè
   */
  async setNickname(user, nickname = null) {
    const id = this.resolveId(user);
    if (this.cache.get(id) !== RelationshipType.Friend) return false;

    const value = typeof nickname === 'string' ? nickname : null;
    await this.client.rest.patch(UserRoutes.relationship(id), { body: { nickname: value } });
    this.friendNicknames.set(id, value);
    return true;
  }
}

// Ponytail: chỉ port fetch/setNickname. Bản v13 còn sendFriendRequest,
// addFriend, addBlocked, deleteRelationship nhưng cả bốn đều `throw` ngay dòng
// đầu ('Risky action, not finished yet.') nên port sang chỉ là chép code chết.
// Thêm lại khi thực sự cần và chấp nhận rủi ro khoá tài khoản.

module.exports = RelationshipManager;
