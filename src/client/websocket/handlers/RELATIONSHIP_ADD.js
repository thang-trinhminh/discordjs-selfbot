'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  if (data.user) client.users._add(data.user);

  client.relationships.cache.set(data.id, data.type);
  client.relationships.friendNicknames.set(data.id, data.nickname ?? null);
  client.relationships.sinceCache.set(data.id, new Date(data.since ?? 0));

  /**
   * Emitted when a relationship involving the client user is created.
   * @event Client#relationshipAdd
   * @param {Snowflake} userId Id of the other user
   * @param {boolean} shouldNotify Whether the client should notify the user of this relationship
   */
  client.emit(Events.RelationshipAdd, data.id, Boolean(data.should_notify));
};
