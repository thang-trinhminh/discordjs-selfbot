'use strict';

const Events = require('../../../util/Events');
const Status = require('../../../util/Status');

module.exports = (client, packet, shard) => {
  const channel = client.channels.cache.get(packet.d.channel_id);
  if (!channel) return;

  channel._recipients ??= [];
  // Discord gửi lại event này khi resume, tránh nhân đôi thành viên.
  if (!channel._recipients.some(recipient => recipient.id === packet.d.user.id)) {
    channel._recipients.push(packet.d.user);
  }

  const user = client.users._add(packet.d.user);
  if (shard.status !== Status.Ready) return;

  /**
   * Emitted when a recipient is added to a group DM.
   * @event Client#channelRecipientAdd
   * @param {GroupDMChannel} channel The group DM channel
   * @param {User} user The user that was added
   */
  client.emit(Events.ChannelRecipientAdd, channel, user);
};
