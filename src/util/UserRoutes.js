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
   * Route ngừng đổ chuông một cuộc gọi.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelCallStopRinging(channelId) {
    return `/channels/${channelId}/call/stop-ringing`;
  },

  /**
   * Route vào/rời nhà HypeSquad.
   * @returns {string}
   */
  hypesquadOnline() {
    return '/hypesquad/online';
  },

  /**
   * Route lời mời kết bạn dùng chung.
   * @returns {string}
   */
  userInvites() {
    return '/users/@me/invites';
  },

  /**
   * Route phát activity kiểu Samsung Game Launcher.
   * @returns {string}
   */
  presences() {
    return '/presences';
  },

  /**
   * Route số burst reaction credit còn lại.
   * @returns {string}
   */
  burstCredits() {
    return '/users/@me/burst-credits';
  },

  /**
   * Route chấp nhận Điều khoản dịch vụ và Chính sách quyền riêng tư.
   * @returns {string}
   */
  agreements() {
    return '/users/@me/agreements';
  },

  /**
   * Route đăng xuất.
   * @returns {string}
   */
  authLogout() {
    return '/auth/logout';
  },

  /**
   * Route trả lời onboarding của một guild.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildOnboardingResponses(guildId) {
    return `/guilds/${guildId}/onboarding-responses`;
  },

  /**
   * Route bản quy tắc thành viên của guild.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildMemberVerification(guildId) {
    return `/guilds/${guildId}/member-verification`;
  },

  /**
   * Route đơn xin vào guild của client user.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildJoinRequest(guildId) {
    return `/guilds/${guildId}/requests/@me`;
  },

  /**
   * Route nhận quà Nitro.
   * @param {string} code Mã quà
   * @returns {string}
   */
  redeemGiftCode(code) {
    return `/entitlements/gift-codes/${code}/redeem`;
  },

  /**
   * Route danh sách quyền OAuth2 đã cấp.
   * @returns {string}
   */
  oauth2Tokens() {
    return '/oauth2/tokens';
  },

  /**
   * Route một bản cấp quyền OAuth2 cụ thể.
   * @param {Snowflake} tokenId Id của bản cấp quyền
   * @returns {string}
   */
  oauth2Token(tokenId) {
    return `/oauth2/tokens/${tokenId}`;
  },

  /**
   * Route thông tin công khai của một application.
   * @param {Snowflake} applicationId Id của application
   * @returns {string}
   */
  applicationPublic(applicationId) {
    return `/applications/${applicationId}/public`;
  },

  /**
   * Route làm mới link đính kèm.
   * @returns {string}
   */
  refreshAttachmentUrls() {
    return '/attachments/refresh-urls';
  },

  /**
   * Route nguồn thanh toán đã lưu.
   * @returns {string}
   */
  billingPaymentSources() {
    return '/users/@me/billing/payment-sources';
  },

  /**
   * Route các gói đăng ký đang hoạt động.
   * @returns {string}
   */
  billingSubscriptions() {
    return '/users/@me/billing/subscriptions';
  },

  /**
   * Route các suất boost client user đang sở hữu.
   * @returns {string}
   */
  premiumSubscriptionSlots() {
    return '/users/@me/guilds/premium/subscription-slots';
  },

  /**
   * Route các bản ghi boost của một guild.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildPremiumSubscriptions(guildId) {
    return `/guilds/${guildId}/premium/subscriptions`;
  },

  /**
   * Route một bản ghi boost cụ thể của guild.
   * @param {Snowflake} guildId Id của guild
   * @param {Snowflake} subscriptionId Id của bản ghi boost
   * @returns {string}
   */
  guildPremiumSubscription(guildId, subscriptionId) {
    return `/guilds/${guildId}/premium/subscriptions/${subscriptionId}`;
  },

  /**
   * Route gửi interaction với tư cách tài khoản người dùng.
   * @returns {string}
   */
  interactions() {
    return '/interactions';
  },

  /**
   * Route tìm application command dùng được trong một kênh.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelApplicationCommandSearch(channelId) {
    return `/channels/${channelId}/application-commands/search`;
  },

  /**
   * Route xin chỗ upload file cho một kênh.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelAttachments(channelId) {
    return `/channels/${channelId}/attachments`;
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
