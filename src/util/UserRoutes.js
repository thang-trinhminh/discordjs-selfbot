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
};

module.exports = { UserRoutes };
