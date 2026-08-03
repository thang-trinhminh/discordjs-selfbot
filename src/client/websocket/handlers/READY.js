'use strict';

const ClientApplication = require('../../../structures/ClientApplication');
let ClientUser;

module.exports = (client, { d: data }, shard) => {
  if (client.user) {
    client.user._patch(data.user);
  } else {
    ClientUser ??= require('../../../structures/ClientUser');
    client.user = new ClientUser(client, data.user);
    client.users.cache.set(client.user.id, client.user);
  }

  for (const guild of data.guilds) {
    guild.shardId = shard.id;
    client.guilds._add(guild);
  }

  client.relationships._setup(data.relationships);
  client.notes._reload(data.notes);
  client.sessions.currentSessionIdHash = data.auth_session_id_hash ?? null;
  client.settings._patch(data.user_settings);

  // Discord gửi `user_guild_settings` dạng `{ version, partial, entries }`, nhưng
  // client cũ (và một số session) nhận thẳng mảng. Chấp nhận cả hai.
  // Phải thử Array.isArray trước: mảng cũng có `.entries` (là Array.prototype.entries).
  const guildSettings = Array.isArray(data.user_guild_settings)
    ? data.user_guild_settings
    : data.user_guild_settings?.entries;
  if (Array.isArray(guildSettings)) {
    for (const guildSetting of guildSettings) {
      client.guilds.cache.get(guildSetting.guild_id)?.settings._patch(guildSetting);
    }
  }

  // User account không nhận `application` trong READY (chỉ bot mới có).
  if (data.application) {
    if (client.application) {
      client.application._patch(data.application);
    } else {
      client.application = new ClientApplication(client, data.application);
    }
  }

  shard.checkReady();
};
