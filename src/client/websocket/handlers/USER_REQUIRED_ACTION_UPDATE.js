'use strict';

const Events = require('../../../util/Events');
const { UserRoutes } = require('../../../util/UserRoutes');

/**
 * Giải thích cho từng hành động Discord yêu cầu tài khoản phải làm.
 * @type {Object<string, string>}
 */
const REQUIRED_ACTION_MESSAGES = {
  AGREEMENTS: 'You must accept the updated Terms of Service and Privacy Policy',
  REQUIRE_CAPTCHA: 'You must complete a captcha',
  REQUIRE_VERIFIED_EMAIL: 'You must verify your email',
  REQUIRE_REVERIFIED_EMAIL: 'You must reverify your email',
  REQUIRE_VERIFIED_PHONE: 'You must verify your phone number',
  REQUIRE_REVERIFIED_PHONE: 'You must reverify your phone number',
  REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE: 'You must verify your email or your phone number',
  REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE: 'You must reverify your email or verify your phone number',
  REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE: 'You must verify your email or reverify your phone number',
  REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE: 'You must reverify your email or your phone number',
};

module.exports = (client, { d: data }) => {
  const action = data.required_action ?? null;
  const message =
    action === null
      ? 'All required actions have been completed'
      : (REQUIRED_ACTION_MESSAGES[action] ?? `Unknown required action: ${action}`);

  client.emit(Events.Debug, `[REQUIRED ACTION] ${message}`);

  /**
   * Emitted when Discord requires the account to complete an action before it can
   * keep using the API.
   * @event Client#userRequiredActionUpdate
   * @param {?string} action The required action, `null` once everything is done
   * @param {string} message A human readable description of the action
   */
  client.emit(Events.UserRequiredActionUpdate, action, message);

  // Bản v13 tự PATCH /users/@me/agreements để chấp nhận Điều khoản dịch vụ và
  // Chính sách quyền riêng tư mới, im lặng và không hỏi. Đó là hành động pháp lý
  // nhân danh chủ tài khoản, nên ở đây phải bật tường minh mới làm.
  if (action === 'AGREEMENTS' && client.options.autoAcceptAgreements) {
    client.rest
      .patch(UserRoutes.agreements(), { body: { terms: true, privacy: true } })
      .then(() => client.emit(Events.Debug, '[REQUIRED ACTION] Accepted the updated agreements'))
      .catch(error => client.emit(Events.Debug, `[REQUIRED ACTION] Failed to accept the agreements: ${error}`));
  }
};
