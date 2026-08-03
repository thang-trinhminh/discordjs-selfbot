'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  const channel = client.channels.cache.get(data.id);
  if (!channel) return;

  const old = channel._clone();
  channel.status = data.status ?? null;

  /**
   * Emitted when the status text of a voice channel changes.
   * @event Client#voiceChannelStatusUpdate
   * @param {BaseChannel} oldChannel The channel before the change
   * @param {BaseChannel} newChannel The channel after the change
   */
  client.emit(Events.VoiceChannelStatusUpdate, old, channel);
};
