'use strict';

/**
 * Route chỉ user account mới gọi được. `discord-api-types` chỉ liệt kê route
 * dành cho bot nên phải tự khai ở đây. Gom một chỗ để khi Discord đổi path thì
 * chỉ sửa một file.
 */
const UserRoutes = {
  /**
   * Route danh sách quan hệ của client user.
   * @returns {string}
   */
  relationships() {
    return '/users/@me/relationships';
  },

  /**
   * Route một quan hệ cụ thể.
   * @param {Snowflake} userId Id của user đối phương
   * @returns {string}
   */
  relationship(userId) {
    return `/users/@me/relationships/${userId}`;
  },

  /**
   * Route ghi chú client user đặt cho một user khác.
   * @param {Snowflake} userId Id của user được ghi chú
   * @returns {string}
   */
  note(userId) {
    return `/users/@me/notes/${userId}`;
  },

  /**
   * Route đẩy ảnh ngoài lên proxy của Discord để dùng làm asset rich presence.
   * @param {Snowflake} applicationId Id của application
   * @returns {string}
   */
  applicationExternalAssets(applicationId) {
    return `/applications/${applicationId}/external-assets`;
  },

  /**
   * Route cuộc gọi của một kênh DM hoặc group DM.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelCall(channelId) {
    return `/channels/${channelId}/call`;
  },

  /**
   * Route đổ chuông cho thành viên trong cuộc gọi.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelCallRing(channelId) {
    return `/channels/${channelId}/call/ring`;
  },

  /**
   * Route setting tài khoản của client user.
   * @returns {string}
   */
  settings() {
    return '/users/@me/settings';
  },

  /**
   * Route setting thông báo của client user cho một guild.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildSettings(guildId) {
    return `/users/@me/guilds/${guildId}/settings`;
  },

  /**
   * Route danh sách phiên đăng nhập.
   * @returns {string}
   */
  authSessions() {
    return '/auth/sessions';
  },

  /**
   * Route đăng xuất phiên từ xa.
   * @returns {string}
   */
  authSessionsLogout() {
    return '/auth/sessions/logout';
  },
};

module.exports = { UserRoutes };
