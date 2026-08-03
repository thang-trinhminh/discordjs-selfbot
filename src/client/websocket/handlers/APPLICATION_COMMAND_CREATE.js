'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  // Lệnh riêng của guild nằm trong manager của guild đó; lệnh toàn cục nằm ở
  // application. Tài khoản người dùng có thể chưa có `application`, nên guard.
  const manager = data.guild_id ? client.guilds.cache.get(data.guild_id)?.commands : client.application?.commands;
  if (!manager) return;

  const command = manager._add(data, data.application_id === client.application?.id);

  /**
   * Emitted when an application command visible to the client user is created.
   * @event Client#applicationCommandCreate
   * @param {ApplicationCommand} command The command
   */
  client.emit(Events.ApplicationCommandCreate, command);
};
