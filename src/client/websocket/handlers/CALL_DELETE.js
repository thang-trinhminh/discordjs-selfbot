'use strict';

const CallState = require('../../../structures/CallState');
const Events = require('../../../util/Events');

module.exports = (client, packet) => {
  /**
   * Emitted when a call in a DM or group DM ends.
   * @event Client#callDelete
   * @param {CallState} call State of the call
   */
  client.emit(Events.CallDelete, new CallState(client, packet.d));
};
