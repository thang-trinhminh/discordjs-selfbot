'use strict';

const { Collection } = require('@discordjs/collection');
const Base = require('./Base');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Một cuộc gọi trong DM hoặc group DM.
 * @extends {Base}
 */
class CallState extends Base {
  constructor(client, data) {
    super(client);

    /**
     * Id kênh diễn ra cuộc gọi.
     * @type {Snowflake}
     */
    this.channelId = data.channel_id;

    this._ringing = [];

    this._patch(data);
  }

  _patch(data) {
    if ('region' in data) {
      /**
       * Vùng máy chủ giọng nói của cuộc gọi.
       * @type {string}
       */
      this.region = data.region;
    }

    if ('ringing' in data) this._ringing = data.ringing;
  }

  /**
   * Kênh diễn ra cuộc gọi.
   * @type {?DMChannel|?GroupDMChannel}
   * @readonly
   */
  get channel() {
    return this.client.channels.cache.get(this.channelId) ?? null;
  }

  /**
   * Những user đang được đổ chuông.
   * @type {Collection<Snowflake, ?User>}
   * @readonly
   */
  get ringing() {
    return new Collection(this._ringing.map(id => [id, this.client.users.cache.get(id) ?? null]));
  }

  /**
   * Đổi vùng máy chủ giọng nói của cuộc gọi.
   * @param {string} region Vùng cần đổi sang
   * @returns {Promise<void>}
   */
  setRTCRegion(region) {
    return this.client.rest.patch(UserRoutes.channelCall(this.channelId), { body: { region } });
  }
}

module.exports = CallState;
