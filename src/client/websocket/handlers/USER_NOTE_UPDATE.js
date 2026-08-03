'use strict';

const Events = require('../../../util/Events');

module.exports = (client, { d: data }) => {
  const oldNote = client.notes.cache.get(data.id) ?? null;

  if (data.note) client.notes.cache.set(data.id, data.note);
  else client.notes.cache.delete(data.id);

  /**
   * Emitted when a note the client user wrote about another user changes.
   * @event Client#userNoteUpdate
   * @param {Snowflake} userId Id of the user the note is about
   * @param {?string} oldNote Note before the update
   * @param {?string} newNote Note after the update, `null` when cleared
   */
  client.emit(Events.UserNoteUpdate, data.id, oldNote, data.note || null);
};
