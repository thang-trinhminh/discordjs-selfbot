'use strict';

const { Collection } = require('@discordjs/collection');
const { ActivityType } = require('discord-api-types/v10');
const BaseManager = require('./BaseManager');
const { DiscordjsTypeError, DiscordjsRangeError, ErrorCodes } = require('../errors');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Ánh xạ field snake_case của API sang tên thuộc tính.
 * Tách thành bảng thay vì 18 khối `if ('x' in data)` như bản v13 — cùng hành vi,
 * ngắn hơn nhiều, và thêm setting mới chỉ là thêm một dòng.
 * @type {Object<string, string>}
 */
const SETTING_FIELDS = {
  locale: 'locale',
  show_current_game: 'activityDisplay',
  default_guilds_restricted: 'allowDMsFromGuild',
  inline_attachment_media: 'displayImage',
  inline_embed_media: 'linkedImageDisplay',
  gif_auto_play: 'autoplayGIF',
  render_embeds: 'previewLink',
  animate_emoji: 'animatedEmoji',
  enable_tts_command: 'allowTTS',
  message_display_compact: 'compactMode',
  convert_emoticons: 'convertEmoticons',
  explicit_content_filter: 'DMScanLevel',
  theme: 'theme',
  developer_mode: 'developerMode',
  afk_timeout: 'afkTimeout',
  animate_stickers: 'stickerAnimationMode',
  render_reactions: 'showEmojiReactions',
};

const VALID_THEMES = ['dark', 'light'];
const VALID_STATUSES = ['online', 'idle', 'dnd', 'invisible'];
const CUSTOM_STATUS_MAX_LENGTH = 128;

/**
 * Quản lý setting tài khoản của client user.
 * @extends {BaseManager}
 * @see {@link https://docs.discord.food/resources/user-settings}
 */
class ClientUserSettingManager extends BaseManager {
  #rawSetting = {};

  constructor(client) {
    super(client);

    /**
     * Guild bị chặn nhắn tin riêng.
     * @type {Collection<Snowflake, ?Guild>}
     */
    this.disableDMfromGuilds = new Collection();
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
   * Nạp payload setting vào các thuộc tính.
   * @param {Object} [data={}] Payload thô
   * @returns {void}
   * @private
   */
  _patch(data = {}) {
    this.#rawSetting = Object.assign(this.#rawSetting, data);
    this.client.emit('debug', '[SETTING > ClientUser] Sync setting');

    for (const [apiField, property] of Object.entries(SETTING_FIELDS)) {
      if (apiField in data) this[property] = data[apiField];
    }

    if ('restricted_guilds' in data) {
      this.disableDMfromGuilds = new Collection(
        data.restricted_guilds.map(guildId => [guildId, this.client.guilds.cache.get(guildId) ?? null]),
      );
    }

    if ('status' in data && !('custom_status' in data)) {
      this.client.emit('debug', '[SETTING > ClientUser] Sync status');
      this.client.user?.setStatus(data.status);
    }

    if ('custom_status' in data) {
      /**
       * Custom status thô của tài khoản, `null` khi không đặt.
       * @type {?Object}
       */
      this.customStatus = data.custom_status;
      this._syncCustomStatusToPresence(data);
    }
  }

  /**
   * Đưa custom status từ setting vào presence đang phát.
   * @param {Object} data Payload setting
   * @returns {void}
   * @private
   */
  _syncCustomStatusToPresence(data) {
    if (!this.client.user) return;

    const activities = this.client.presence.activities.filter(activity => activity.type !== ActivityType.Custom);

    if (data.custom_status) {
      activities.push({
        name: 'Custom Status',
        type: ActivityType.Custom,
        state: data.custom_status.text ?? null,
      });
    }

    this.client.emit('debug', '[SETTING > ClientUser] Sync activities & status');
    this.client.user.setPresence({ activities, status: data.status ?? undefined });
  }

  // Ponytail: emoji của custom status không được đẩy vào presence.
  // `ClientPresence#_parse` của upstream chỉ giữ type/name/state/url và bỏ emoji.
  // Hỗ trợ emoji nghĩa là phải sửa file upstream đó — để tới khi port Presence
  // ở P3 phần sau, lúc đó sửa một lần cho cả RichPresence và SpotifyRPC.

  /**
   * Tải lại setting từ API.
   * @returns {Promise<ClientUserSettingManager>}
   */
  async fetch() {
    this._patch(await this.client.rest.get(UserRoutes.settings()));
    return this;
  }

  /**
   * Sửa setting.
   * @param {Object} data Field cần sửa, dùng tên snake_case của API
   * @returns {Promise<ClientUserSettingManager>}
   */
  async edit(data) {
    this._patch(await this.client.rest.patch(UserRoutes.settings(), { body: data }));
    return this;
  }

  /**
   * Bật/tắt chế độ hiển thị gọn.
   * @returns {Promise<ClientUserSettingManager>}
   */
  toggleCompactMode() {
    return this.edit({ message_display_compact: !this.compactMode });
  }

  /**
   * Đổi theme.
   * @param {string} value `dark` hoặc `light`
   * @returns {Promise<ClientUserSettingManager>}
   */
  setTheme(value) {
    if (!VALID_THEMES.includes(value)) {
      throw new DiscordjsTypeError(ErrorCodes.InvalidType, 'value', VALID_THEMES.join(' | '), true);
    }
    return this.edit({ theme: value });
  }

  /**
   * @typedef {Object} CustomStatusOptions
   * @property {?string} [text] Nội dung status, tối đa 128 ký tự
   * @property {?string} [status] `online`, `idle`, `dnd` hoặc `invisible`
   * @property {?EmojiResolvable} [emoji] Emoji kèm theo
   * @property {?number} [expires] Timestamp status hết hạn
   */

  /**
   * Đặt custom status. Truyền giá trị không phải object để xoá.
   * @param {?CustomStatusOptions} options Tuỳ chọn
   * @returns {Promise<ClientUserSettingManager>}
   */
  async setCustomStatus(options) {
    if (typeof options !== 'object' || options === null) {
      return this.edit({ custom_status: null });
    }

    const body = { text: null, emoji_name: null, expires_at: null };

    if (typeof options.text === 'string') {
      if (options.text.length > CUSTOM_STATUS_MAX_LENGTH) {
        throw new DiscordjsRangeError(
          ErrorCodes.InvalidType,
          'text',
          `a string of at most ${CUSTOM_STATUS_MAX_LENGTH} characters`,
        );
      }
      body.text = options.text;
    }

    if (options.emoji) {
      const emoji = this.client.emojis.resolve(options.emoji);
      if (emoji) {
        body.emoji_name = emoji.name;
        body.emoji_id = emoji.id;
      } else {
        body.emoji_name = typeof options.emoji === 'string' ? options.emoji : null;
      }
    }

    if (typeof options.expires === 'number') {
      if (options.expires < Date.now()) {
        throw new DiscordjsRangeError(ErrorCodes.InvalidType, 'expires', 'a timestamp in the future');
      }
      body.expires_at = new Date(options.expires).toISOString();
    }

    // Gộp status vào cùng một request thay vì bắn hai request nối nhau như v13.
    if (VALID_STATUSES.includes(options.status)) {
      return this.edit({ custom_status: body, status: options.status });
    }
    return this.edit({ custom_status: body });
  }

  /**
   * Bật/tắt chặn tin nhắn riêng từ mọi guild đang tham gia.
   * @param {boolean} status `true` để chặn tất cả
   * @returns {Promise<ClientUserSettingManager>}
   */
  restrictedGuilds(status) {
    if (typeof status !== 'boolean') {
      throw new DiscordjsTypeError(ErrorCodes.InvalidType, 'status', 'boolean', true);
    }
    return this.edit({
      default_guilds_restricted: status,
      restricted_guilds: status ? this.client.guilds.cache.map(guild => guild.id) : [],
    });
  }

  /**
   * Thêm một guild vào danh sách chặn tin nhắn riêng.
   * @param {GuildResolvable} guild Guild cần thêm
   * @returns {Promise<ClientUserSettingManager>}
   */
  addRestrictedGuild(guild) {
    const id = this.client.guilds.resolveId(guild);
    if (this.disableDMfromGuilds.has(id)) throw new Error(`Guild ${id} is already restricted`);
    return this.edit({ restricted_guilds: [...this.disableDMfromGuilds.keys(), id] });
  }

  /**
   * Bỏ một guild khỏi danh sách chặn tin nhắn riêng.
   * @param {GuildResolvable} guild Guild cần bỏ
   * @returns {Promise<ClientUserSettingManager>}
   */
  removeRestrictedGuild(guild) {
    const id = this.client.guilds.resolveId(guild);
    if (!this.disableDMfromGuilds.has(id)) throw new Error(`Guild ${id} is not restricted`);
    return this.edit({ restricted_guilds: [...this.disableDMfromGuilds.keys()].filter(key => key !== id) });
  }
}

module.exports = ClientUserSettingManager;
