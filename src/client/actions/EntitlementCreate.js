'use strict';

const Action = require('./Action');
const Events = require('../../util/Events');

class EntitlementCreateAction extends Action {
  handle(data) {
    const client = this.client;

    // Entitlement thuộc về application. Tài khoản người dùng không có
    // application nào, nên bỏ qua thay vì ném khi Discord vẫn đẩy event xuống.
    if (!client.application) return {};

    const entitlement = client.application.entitlements._add(data);

    /**
     * Emitted whenever an entitlement is created.
     * @event Client#entitlementCreate
     * @param {Entitlement} entitlement The entitlement that was created
     */
    client.emit(Events.EntitlementCreate, entitlement);

    return {};
  }
}

module.exports = EntitlementCreateAction;
