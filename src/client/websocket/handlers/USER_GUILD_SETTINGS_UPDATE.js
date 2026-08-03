'use strict';

module.exports = (client, { d: data }) => {
  client.guilds.cache.get(data.guild_id)?.settings._patch(data);
};
