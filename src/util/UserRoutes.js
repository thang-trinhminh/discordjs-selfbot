'use strict';

/**
 * Mã hoá một tham số trước khi ghép vào path.
 *
 * Thiếu bước này thì giá trị lấy từ nội dung tin nhắn — mã quà, mã mời — chứa
 * `../`, `?` hay `#` sẽ bẻ path sang endpoint khác, và request đó vẫn mang token:
 * `gift-codes/../../invites/abc#/redeem` thành `POST /invites/abc`. `@` để nguyên
 * vì nó hợp lệ trong path và Discord dùng `@me`.
 * @param {*} value Tham số
 * @returns {string}
 */
function segment(value) {
  const encoded = encodeURIComponent(String(value)).replaceAll('%40', '@');
  // `.` và `..` không có ký tự nào để mã hoá, nhưng URL vẫn hiểu là lùi thư mục.
  if (encoded === '' || encoded === '.' || encoded === '..') {
    throw new TypeError(`Invalid route parameter: ${JSON.stringify(value)}`);
  }
  return encoded;
}

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
    return `/users/@me/relationships/${segment(userId)}`;
  },

  /**
   * Route ghi chú client user đặt cho một user khác.
   * @param {Snowflake} userId Id của user được ghi chú
   * @returns {string}
   */
  note(userId) {
    return `/users/@me/notes/${segment(userId)}`;
  },

  /**
   * Route hồ sơ của một user. Tài khoản người dùng không gọi được `GET /users/:id`
   * (403, code 40001) — chỉ bot mới gọi được — nên phải đi qua route này.
   * @param {Snowflake} userId Id của user cần xem
   * @returns {string}
   */
  profile(userId) {
    return `/users/${segment(userId)}/profile`;
  },

  /**
   * Route đẩy ảnh ngoài lên proxy của Discord để dùng làm asset rich presence.
   * @param {Snowflake} applicationId Id của application
   * @returns {string}
   */
  applicationExternalAssets(applicationId) {
    return `/applications/${segment(applicationId)}/external-assets`;
  },

  /**
   * Route cuộc gọi của một kênh DM hoặc group DM.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelCall(channelId) {
    return `/channels/${segment(channelId)}/call`;
  },

  /**
   * Route đổ chuông cho thành viên trong cuộc gọi.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelCallRing(channelId) {
    return `/channels/${segment(channelId)}/call/ring`;
  },

  /**
   * Route ngừng đổ chuông một cuộc gọi.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelCallStopRinging(channelId) {
    return `/channels/${segment(channelId)}/call/stop-ringing`;
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
   * Route chấp nhận Điều khoản dịch vụ và Chính sách quyền riêng tư.
   * @returns {string}
   */
  agreements() {
    return '/users/@me/agreements';
  },

  /**
   * Route đăng nhập bằng email và mật khẩu.
   * @returns {string}
   */
  authLogin() {
    return '/auth/login';
  },

  /**
   * Route xác thực hai lớp bằng mã TOTP.
   * @returns {string}
   */
  authMfaTotp() {
    return '/auth/mfa/totp';
  },

  /**
   * Route đổi ticket của phiên quét QR lấy token.
   * @returns {string}
   */
  remoteAuthLogin() {
    return '/users/@me/remote-auth/login';
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
    return `/guilds/${segment(guildId)}/onboarding-responses`;
  },

  /**
   * Route bản quy tắc thành viên của guild.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildMemberVerification(guildId) {
    return `/guilds/${segment(guildId)}/member-verification`;
  },

  /**
   * Route đơn xin vào guild của client user.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildJoinRequest(guildId) {
    return `/guilds/${segment(guildId)}/requests/@me`;
  },

  /**
   * Route nhận quà Nitro.
   * @param {string} code Mã quà
   * @returns {string}
   */
  redeemGiftCode(code) {
    return `/entitlements/gift-codes/${segment(code)}/redeem`;
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
    return `/oauth2/tokens/${segment(tokenId)}`;
  },

  /**
   * Route thông tin công khai của một application.
   * @param {Snowflake} applicationId Id của application
   * @returns {string}
   */
  applicationPublic(applicationId) {
    return `/applications/${segment(applicationId)}/public`;
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
    return `/guilds/${segment(guildId)}/premium/subscriptions`;
  },

  /**
   * Route một bản ghi boost cụ thể của guild.
   * @param {Snowflake} guildId Id của guild
   * @param {Snowflake} subscriptionId Id của bản ghi boost
   * @returns {string}
   */
  guildPremiumSubscription(guildId, subscriptionId) {
    return `/guilds/${segment(guildId)}/premium/subscriptions/${segment(subscriptionId)}`;
  },

  /**
   * Route gửi interaction với tư cách tài khoản người dùng.
   * @returns {string}
   */
  interactions() {
    return '/interactions';
  },

  /**
   * Route lấy toàn bộ application command của một guild.
   *
   * Route search theo kênh chỉ trả về rỗng với kênh trong guild — client thật
   * dùng index này để dựng danh sách khi bạn gõ `/`.
   * @param {Snowflake} guildId Id của guild
   * @returns {string}
   */
  guildApplicationCommandIndex(guildId) {
    return `/guilds/${segment(guildId)}/application-command-index`;
  },

  /**
   * Route tìm application command dùng được trong một kênh.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelApplicationCommandSearch(channelId) {
    return `/channels/${segment(channelId)}/application-commands/search`;
  },

  /**
   * Route xin chỗ upload file cho một kênh.
   * @param {Snowflake} channelId Id của kênh
   * @returns {string}
   */
  channelAttachments(channelId) {
    return `/channels/${segment(channelId)}/attachments`;
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
    return `/users/@me/guilds/${segment(guildId)}/settings`;
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

module.exports = { UserRoutes, segment };
