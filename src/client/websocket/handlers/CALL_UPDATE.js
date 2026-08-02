'use strict';

const CallState = require('../../../structures/CallState');
const Events = require('../../../util/Events');

module.exports = (client, packet) => {
  /**
   * Emitted when a call in a DM or group DM is updated.
   * @event Client#callUpdate
   * @param {CallState} call State of the call
   */
  client.emit(Events.CallUpdate, new CallState(client, packet.d));
};
