'use strict';

const Events = require('../../../util/Events');

/**
 * @typedef {Object} RelationshipUpdateData
 * @property {?number} type Type of the relationship
 * @property {?string} nickname Nickname set for the other user
 * @property {?Date} since When the relationship was created
 */

module.exports = (client, { d: data }) => {
  const { relationships } = client;

  const oldData = {
    type: relationships.cache.get(data.id) ?? null,
    nickname: relationships.friendNicknames.get(data.id) ?? null,
    since: relationships.sinceCache.get(data.id) ?? null,
  };

  // Payload chỉ chứa field thay đổi, field vắng mặt giữ nguyên giá trị cũ.
  if (data.type !== undefined) relationships.cache.set(data.id, data.type);
  if (data.nickname !== undefined) relationships.friendNicknames.set(data.id, data.nickname);
  if (data.since !== undefined) relationships.sinceCache.set(data.id, new Date(data.since ?? 0));

  const newData = {
    type: relationships.cache.get(data.id) ?? null,
    nickname: relationships.friendNicknames.get(data.id) ?? null,
    since: relationships.sinceCache.get(data.id) ?? null,
  };

  /**
   * Emitted when a relationship involving the client user is updated, for example when a friend
   * nickname changes.
   * <info>Changing the relationship type is not sent here; see {@link Client#relationshipAdd} and
   * {@link Client#relationshipRemove}.</info>
   * @event Client#relationshipUpdate
   * @param {Snowflake} userId Id of the other user
   * @param {RelationshipUpdateData} oldData Data before the update
   * @param {RelationshipUpdateData} newData Data after the update
   */
  client.emit(Events.RelationshipUpdate, data.id, oldData, newData);
};
