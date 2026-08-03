'use strict';

const BaseManager = require('./BaseManager');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Ánh xạ field snake_case sang tên thuộc tính, giống cách
 * {@link ClientUserSettingManager} làm.
 * @type {Object<string, string>}
 */
const GUILD_SETTING_FIELDS = {
  suppress_everyone: 'suppressEveryone',
  suppress_roles: 'suppressRoles',
  mute_scheduled_events: 'muteScheduledEvents',
  message_notifications: 'messageNotifications',
  flags: 'flags',
  mobile_push: 'mobilePush',
  muted: 'muted',
  hide_muted_channels: 'hideMutedChannels',
  channel_overrides: 'channelOverrides',
  notify_highlights: 'notifyHighlights',
  version: 'version',
};

/**
 * Setting thông báo của client user cho một guild.
 * @extends {BaseManager}
 * @see {@link https://docs.discord.food/resources/user-settings#user-guild-settings}
 */
class GuildSettingManager extends BaseManager {
  #rawSetting = {};

  constructor(guild) {
    super(guild.client);

    /**
     * Id của guild mà setting này thuộc về.
     * @type {Snowflake}
     */
    this.guildId = guild.id;

    /**
     * Cấu hình tắt tiếng, `null` khi không tắt tiếng theo hạn.
     * @type {?Object}
     */
    this.muteConfig = null;
  }

  /**
   * Payload setting thô gần nhất nhận từ Discord.
   * @type {Object}
   * @readonly
   */
  get raw() {
    return this.#rawSetting;
  }

  /**
   * Guild tương ứng.
   * @type {?Guild}
   * @readonly
   */
  get guild() {
    return this.client.guilds.cache.get(this.guildId) ?? null;
  }

  /**
   * Nạp payload setting vào các thuộc tính.
   * @param {Object} [data={}] Payload thô
   * @returns {void}
   * @private
   */
  _patch(data = {}) {
    this.#rawSetting = Object.assign(this.#rawSetting, data);
    this.client.emit('debug', `[SETTING > Guild ${this.guildId}] Sync setting`);

    for (const [apiField, property] of Object.entries(GUILD_SETTING_FIELDS)) {
      if (apiField in data) this[property] = data[apiField];
    }

    if ('mute_config' in data) {
      this.muteConfig = data.mute_config
        ? {
            endTime: new Date(data.mute_config.end_time),
            selectedTimeWindow: data.mute_config.selected_time_window,
          }
        : null;
    }
  }

  /**
   * Sửa setting thông báo của guild này.
   * @param {Object} data Field cần sửa, dùng tên snake_case của API
   * @returns {Promise<GuildSettingManager>}
   */
  async edit(data) {
    // Bản v13 PATCH nhầm sang `/users/@me/settings` (setting toàn cục) nên
    // thay đổi không bao giờ có tác dụng lên guild.
    this._patch(await this.client.rest.patch(UserRoutes.guildSettings(this.guildId), { body: data }));
    return this;
  }
}

module.exports = GuildSettingManager;
