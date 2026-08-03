'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  /**
   * Emitted when a bot opens a modal in response to an interaction the client user sent.
   * @event Client#interactionModalCreate
   * @param {Object} modal Raw modal payload, carrying the nonce of the interaction that opened it
   */
  client.emit(Events.InteractionModalCreate, data);
};
