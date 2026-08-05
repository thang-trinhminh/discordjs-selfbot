'use strict';

const { Collection } = require('@discordjs/collection');
const { Routes } = require('discord-api-types/v10');
const { resolveImage } = require('../util/DataResolver');
const { HypeSquadHouse, SamsungActivityAction } = require('../util/UserEnums');
const { UserRoutes } = require('../util/UserRoutes');
const { resolveColor } = require('../util/Util');

/**
 * Các thao tác chỉ tài khoản người dùng mới làm được, trộn vào
 * `ClientUser.prototype`.
 *
 * Để riêng file thay vì sửa thẳng `ClientUser.js` để phần divergence với
 * upstream chỉ còn đúng một dòng `Object.assign` ở cuối file đó.
 * @type {Object}
 */
const ClientUserActions = {
  /**
   * @typedef {Object} ClientUserEditOptions
   * @property {string} [username] Tên đăng nhập mới
   * @property {?(BufferResolvable|Base64Resolvable)} [avatar] Ảnh đại diện mới
   * @property {?(BufferResolvable|Base64Resolvable)} [banner] Ảnh bìa mới
   * @property {string} [password] Mật khẩu hiện tại, bắt buộc khi đổi username,
   * email hoặc mật khẩu
   * @property {?string} [bio] Phần "About me"
   * @property {?string} [pronouns] Đại từ nhân xưng
   * @property {?string} [globalName] Tên hiển thị
   * @property {?ColorResolvable} [accentColor] Màu nhấn của hồ sơ
   */

  /**
   * Sửa hồ sơ client user.
   *
   * Bản upstream destructure đúng `{ username, avatar, banner }` nên mọi field
   * riêng của tài khoản người dùng bị vứt im lặng. Bản này giữ lại chúng.
   * @param {ClientUserEditOptions} [options={}] Thứ cần sửa
   * @returns {Promise<ClientUser>}
   */
  async edit(options = {}) {
    const { avatar, banner, globalName, accentColor, ...rest } = options;
    const body = { ...rest };

    if ('avatar' in options) body.avatar = avatar && (await resolveImage(avatar));
    if ('banner' in options) body.banner = banner && (await resolveImage(banner));
    if ('globalName' in options) body.global_name = globalName;
    if ('accentColor' in options) body.accent_color = accentColor === null ? null : resolveColor(accentColor);

    const data = await this.client.rest.patch(Routes.user(), { body });
    const { updated } = this.client.actions.UserUpdate.handle(data);
    return updated ?? this;
  },

  /**
   * Đổi tên đăng nhập.
   * <info>Discord giới hạn rất chặt: 2 lần mỗi giờ.</info>
   * @param {string} username Tên mới
   * @param {string} password Mật khẩu hiện tại
   * @returns {Promise<ClientUser>}
   */
  setUsername(username, password) {
    return this.edit({ username, password });
  },

  /**
   * Đổi tên hiển thị.
   * @param {?string} [globalName=''] Tên hiển thị mới, chuỗi rỗng để xoá
   * @returns {Promise<ClientUser>}
   */
  setGlobalName(globalName = '') {
    return this.edit({ globalName });
  },

  /**
   * Đổi đại từ nhân xưng trên hồ sơ.
   * @param {?string} [pronouns=''] Đại từ mới, chuỗi rỗng để xoá
   * @returns {Promise<ClientUser>}
   */
  setPronouns(pronouns = '') {
    return this.edit({ pronouns });
  },

  /**
   * Đổi phần "About me".
   * @param {?string} [bio=null] Nội dung mới
   * @returns {Promise<ClientUser>}
   */
  setAboutMe(bio = null) {
    return this.edit({ bio });
  },

  /**
   * Đổi màu nhấn của hồ sơ.
   * @param {?ColorResolvable} [color=null] Màu mới
   * @returns {Promise<ClientUser>}
   */
  setAccentColor(color = null) {
    return this.edit({ accentColor: color });
  },

  /**
   * Vào hoặc rời một nhà HypeSquad.
   * @param {HypeSquadHouse|string} house Nhà cần vào, hoặc `HypeSquadHouse.Leave` để rời
   * @returns {Promise<void>}
   */
  // Async để lỗi validate cũng reject như mọi method khác ở đây; ném đồng bộ
  // thì `.catch()` của caller không bắt được.
  async setHypeSquad(house) {
    const houseId = typeof house === 'string' ? HypeSquadHouse[house] : house;
    if (houseId === undefined) {
      throw new TypeError(`Unknown HypeSquad house: ${house}`);
    }

    if (houseId === HypeSquadHouse.Leave) return this.client.rest.delete(UserRoutes.hypesquadOnline());
    return this.client.rest.post(UserRoutes.hypesquadOnline(), { body: { house_id: houseId } });
  },

  /**
   * Tạo một lời mời kết bạn dùng chung.
   * @returns {Promise<Invite>}
   */
  async createFriendInvite() {
    const Invite = require('./Invite');
    const data = await this.client.rest.post(UserRoutes.userInvites(), { body: {} });
    return new Invite(this.client, data);
  },

  /**
   * Lấy toàn bộ lời mời kết bạn đang mở.
   * @returns {Promise<Collection<string, Invite>>}
   */
  async fetchFriendInvites() {
    const Invite = require('./Invite');
    const data = await this.client.rest.get(UserRoutes.userInvites());
    return new Collection(data.map(invite => [invite.code, new Invite(this.client, invite)]));
  },

  /**
   * Huỷ toàn bộ lời mời kết bạn đang mở.
   * @returns {Promise<void>}
   */
  revokeAllFriendInvites() {
    return this.client.rest.delete(UserRoutes.userInvites());
  },

  /**
   * Phát activity kiểu Samsung Game Launcher.
   * @param {string} packageName Package name của ứng dụng Android
   * @param {string} [action=SamsungActivityAction.Start] `START`, `UPDATE` hoặc `STOP`
   * @returns {Promise<ClientUser>}
   */
  async setSamsungActivity(packageName, action = SamsungActivityAction.Start) {
    if (typeof packageName !== 'string' || !packageName) {
      throw new TypeError('Package name is required and must be a string');
    }

    const update = action.toUpperCase();
    if (!Object.values(SamsungActivityAction).includes(update)) {
      throw new TypeError(`Action must be one of ${Object.values(SamsungActivityAction).join(', ')}`);
    }

    await this.client.rest.post(UserRoutes.presences(), { body: { package_name: packageName, update } });
    return this;
  },

  /**
   * Ngừng đổ chuông một cuộc gọi đến.
   * @param {ChannelResolvable} channel Kênh đang đổ chuông
   * @returns {Promise<void>}
   */
  stopRinging(channel) {
    return this.client.rest.post(UserRoutes.channelCallStopRinging(this.client.channels.resolveId(channel)), {
      body: {},
    });
  },
};

module.exports = ClientUserActions;
