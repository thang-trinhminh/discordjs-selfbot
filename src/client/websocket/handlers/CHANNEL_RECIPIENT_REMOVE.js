'use strict';

const Events = require('../../../util/Events');

module.exports = (client, packet) => {
  const channel = client.channels.cache.get(packet.d.channel_id);
  if (!channel) return;

  channel._recipients = (channel._recipients ?? []).filter(recipient => recipient.id !== packet.d.user.id);

  /**
   * Emitted when a recipient is removed from a group DM.
   * @event Client#channelRecipientRemove
   * @param {GroupDMChannel} channel The group DM channel
   * @param {User} user The user that was removed
   */
  client.emit(Events.ChannelRecipientRemove, channel, client.users._add(packet.d.user));
};
