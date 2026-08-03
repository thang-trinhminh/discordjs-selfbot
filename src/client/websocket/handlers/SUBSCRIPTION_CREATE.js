'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  // Entitlement và subscription thuộc về application. Tài khoản người dùng không
  // có application nào, nên bỏ qua thay vì ném khi Discord vẫn đẩy event xuống.
  if (!client.application) return;

  const subscription = client.application.subscriptions._add(data);

  /**
   * Emitted whenever a subscription is created.
   * @event Client#subscriptionCreate
   * @param {Subscription} subscription The subscription that was created
   */
  client.emit(Events.SubscriptionCreate, subscription);
};
