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
