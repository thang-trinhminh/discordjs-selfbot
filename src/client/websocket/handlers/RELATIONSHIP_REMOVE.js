'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  const nickname = client.relationships.friendNicknames.get(data.id) ?? null;

  client.relationships.cache.delete(data.id);
  client.relationships.friendNicknames.delete(data.id);
  client.relationships.sinceCache.delete(data.id);

  /**
   * Emitted when a relationship involving the client user is removed.
   * @event Client#relationshipRemove
   * @param {Snowflake} userId Id of the other user
   * @param {number} type Type of the relationship that was removed
   * @param {?string} nickname Nickname the client user had set for that user
   */
  client.emit(Events.RelationshipRemove, data.id, data.type, nickname);
};
