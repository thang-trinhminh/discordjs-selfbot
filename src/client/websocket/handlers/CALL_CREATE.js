'use strict';

const CallState = require('../../../structures/CallState');
const Events = require('../../../util/Events');

module.exports = (client, packet) => {
  for (const voiceState of packet.d.voice_states ?? []) {
    client.actions.VoiceStateUpdate.handle(voiceState);
  }

  /**
   * Emitted when a call in a DM or group DM starts.
   * @event Client#callCreate
   * @param {CallState} call State of the call
   */
  client.emit(Events.CallCreate, new CallState(client, packet.d));
};
