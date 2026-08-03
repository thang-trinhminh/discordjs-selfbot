'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  // Lệnh riêng của guild nằm trong manager của guild đó; lệnh toàn cục nằm ở
  // application. Tài khoản người dùng có thể chưa có `application`, nên guard.
  const manager = data.guild_id ? client.guilds.cache.get(data.guild_id)?.commands : client.application?.commands;
  if (!manager) return;

  const command = manager.cache.get(data.id) ?? manager._add(data, false);
  manager.cache.delete(data.id);

  /**
   * Emitted when an application command visible to the client user is deleted.
   * @event Client#applicationCommandDelete
   * @param {ApplicationCommand} command The command
   */
  client.emit(Events.ApplicationCommandDelete, command);
};
