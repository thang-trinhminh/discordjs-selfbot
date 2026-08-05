'use strict';

const { Collection } = require('@discordjs/collection');
const { Routes } = require('discord-api-types/v10');
const PartialGroupDMChannel = require('./PartialGroupDMChannel');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const { resolveImage } = require('../util/DataResolver');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Group DM mà client user tham gia.
 *
 * Upstream chỉ có {@link PartialGroupDMChannel} vì bot chỉ nhìn thấy group DM ở
 * dạng partial và không gửi được tin nhắn. User account thì dùng được đầy đủ,
 * nên lớp này mở lại các method upstream chặn và thêm phần quản lý thành viên.
 * @extends {PartialGroupDMChannel}
 * @implements {TextBasedChannel}
 */
class GroupDMChannel extends PartialGroupDMChannel {
  /**
   * Upstream đặt hết field của group DM trong constructor chứ không có `_patch`,
   * nên phải lặp lại ở đây — nếu không thì `edit()` và event update sẽ không
   * cập nhật được `name`, `icon`, `ownerId`.
   * @param {Object} data Payload thô
   * @returns {void}
   * @private
   */
  _patch(data) {
    super._patch(data);

    if ('name' in data) this.name = data.name;
    if ('icon' in data) this.icon = data.icon ?? null;
    if ('owner_id' in data) this.ownerId = data.owner_id;
    if ('last_message_id' in data) this.lastMessageId = data.last_message_id;
    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? Date.parse(data.last_pin_timestamp) : null;
    }

    if ('recipients' in data) {
      /**
       * Dữ liệu thô của thành viên. Handler `CHANNEL_RECIPIENT_ADD` và
       * `CHANNEL_RECIPIENT_REMOVE` sửa trực tiếp mảng này.
       * @type {Object[]}
       * @private
       */
      // Copy chứ không giữ tham chiếu: handler recipient mutate mảng này,
      // giữ tham chiếu sẽ sửa luôn payload gốc của caller.
      this._recipients = [...data.recipients];
    } else {
      this._recipients ??= [];
    }
  }

  /**
   * Thành viên trong nhóm.
   * @type {Collection<Snowflake, User>}
   * @readonly
   */
  // Cặp getter/setter này phải nằm trên prototype, không được `defineProperty`
  // thẳng lên instance: `Base#_clone()` chạy `Object.assign(Object.create(this),
  // this)`, bản sao thừa kế accessor chỉ-đọc gắn trên instance nên phép gán ném
  // TypeError — mọi `CHANNEL_UPDATE` của group DM (đổi tên, đổi icon, đổi chủ
  // nhóm) sẽ nổ ngay trong handler packet và giết cả client.
  get recipients() {
    return new Collection(this._recipients.map(recipient => [recipient.id, this.client.users._add(recipient)]));
  }

  /**
   * Chỉ để hứng `this.recipients = data.recipients ?? []` của constructor cha:
   * getter không kèm setter thì phép gán đó ném thẳng TypeError. Dữ liệu thật
   * nằm ở `_recipients`, `_patch` ghi trực tiếp vào đó.
   * @param {Object[]} value Mảng thành viên thô
   * @private
   */
  set recipients(value) {
    this._recipients = Array.isArray(value) ? [...value] : [];
  }

  /**
   * `flatten` chỉ đọc own enumerable property, mà `recipients` giờ là getter trên
   * prototype nên phải khai báo tường minh để nó không biến mất khỏi `toJSON()`.
   * @param {...Object} props Thuộc tính cần thêm
   * @returns {Object}
   */
  toJSON(...props) {
    return super.toJSON({ recipients: true }, ...props);
  }

  /**
   * Chủ nhóm, `null` nếu chưa có trong cache.
   * @type {?User}
   * @readonly
   */
  get owner() {
    return this.ownerId ? (this.client.users.cache.get(this.ownerId) ?? null) : null;
  }

  /**
   * Kênh đã tải đủ dữ liệu chưa.
   * @type {boolean}
   * @readonly
   */
  get partial() {
    return this.lastMessageId === undefined;
  }

  /**
   * @typedef {Object} GroupDMChannelEditOptions
   * @property {?string} [name] Tên nhóm
   * @property {?(BufferResolvable|Base64Resolvable)} [icon] Ảnh đại diện nhóm
   * @property {UserResolvable} [owner] Chủ nhóm mới
   */

  /**
   * Sửa thông tin nhóm.
   * @param {GroupDMChannelEditOptions} options Thứ cần sửa
   * @returns {Promise<GroupDMChannel>}
   */
  async edit(options) {
    const body = {};
    if ('name' in options) body.name = options.name;
    if ('icon' in options) body.icon = await resolveImage(options.icon);
    if ('owner' in options) body.owner = this.client.users.resolveId(options.owner);

    const data = await this.client.rest.patch(Routes.channel(this.id), { body });
    this._patch(data);
    return this;
  }

  /**
   * Đổi tên nhóm.
   * @param {?string} name Tên mới
   * @returns {Promise<GroupDMChannel>}
   */
  setName(name) {
    return this.edit({ name });
  }

  /**
   * Đổi ảnh đại diện nhóm.
   * @param {?(BufferResolvable|Base64Resolvable)} icon Ảnh mới
   * @returns {Promise<GroupDMChannel>}
   */
  setIcon(icon) {
    return this.edit({ icon });
  }

  /**
   * Chuyển quyền chủ nhóm.
   * @param {UserResolvable} user Chủ nhóm mới
   * @returns {Promise<GroupDMChannel>}
   */
  setOwner(user) {
    return this.edit({ owner: user });
  }

  /**
   * Thêm một user vào nhóm.
   * @param {UserResolvable} user User cần thêm
   * @returns {Promise<GroupDMChannel>}
   */
  async addUser(user) {
    await this.client.rest.put(Routes.channelRecipient(this.id, this.client.users.resolveId(user)));
    return this;
  }

  /**
   * Bỏ một user khỏi nhóm.
   * @param {UserResolvable} user User cần bỏ
   * @returns {Promise<GroupDMChannel>}
   */
  async removeUser(user) {
    await this.client.rest.delete(Routes.channelRecipient(this.id, this.client.users.resolveId(user)));
    return this;
  }

  /**
   * Rời nhóm.
   * @param {boolean} [silent=false] Rời mà không báo cho các thành viên khác
   * @returns {Promise<GroupDMChannel>}
   */
  async delete(silent = false) {
    await this.client.rest.delete(Routes.channel(this.id), {
      query: silent ? new URLSearchParams({ silent: 'true' }) : undefined,
    });
    return this;
  }

  /**
   * Tạo link mời vào nhóm.
   * @param {number} [maxAge=86400] Thời gian sống của link, tính bằng giây
   * @param {number} [maxUses=0] Số lượt dùng tối đa, `0` là không giới hạn
   * @returns {Promise<Invite>}
   */
  async createInvite(maxAge = 86_400, maxUses = 0) {
    const Invite = require('./Invite');
    const data = await this.client.rest.post(Routes.channelInvites(this.id), {
      body: { max_age: maxAge, max_uses: maxUses },
    });
    return new Invite(this.client, data);
  }

  /**
   * Lấy toàn bộ link mời của nhóm.
   * @returns {Promise<Collection<string, Invite>>}
   */
  async fetchInvites() {
    const Invite = require('./Invite');
    const data = await this.client.rest.get(Routes.channelInvites(this.id));
    return new Collection(data.map(invite => [invite.code, new Invite(this.client, invite)]));
  }

  /**
   * Xoá một link mời của nhóm.
   * @param {InviteResolvable} invite Link mời cần xoá
   * @returns {Promise<GroupDMChannel>}
   */
  async deleteInvite(invite) {
    const code = typeof invite === 'string' ? invite : invite.code;
    await this.client.rest.delete(Routes.invite(code));
    return this;
  }

  /**
   * Đổ chuông cho thành viên trong nhóm.
   * @param {UserResolvable[]} [recipients] Ai được đổ chuông, bỏ trống là tất cả
   * @returns {Promise<GroupDMChannel>}
   */
  async ring(recipients) {
    const ids = Array.isArray(recipients) ? recipients.map(user => this.client.users.resolveId(user)) : null;
    await this.client.rest.post(UserRoutes.channelCallRing(this.id), { body: { recipients: ids } });
    return this;
  }

  toString() {
    return this.name ?? this.recipients.map(user => user.username).join(', ');
  }

  // Đây chỉ là chỗ để JSDoc bám vào, TextBasedChannel mới là nơi cài đặt.
  /* eslint-disable no-empty-function */
  get lastMessage() {}
  get lastPinAt() {}
  send() {}
  sendTyping() {}
  createMessageCollector() {}
  awaitMessages() {}
}

// Upstream chặn send/sendTyping/collector vì bot không dùng được group DM.
// User account dùng được, nên chỉ giữ lại phần Discord thật sự không cho:
// webhook, bulk delete, slowmode và NSFW đều không áp dụng cho group DM.
TextBasedChannel.applyToClass(GroupDMChannel, true, [
  'bulkDelete',
  'fetchWebhooks',
  'createWebhook',
  'setRateLimitPerUser',
  'setNSFW',
]);

module.exports = GroupDMChannel;
