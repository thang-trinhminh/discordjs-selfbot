'use strict';

const { ActivityType } = require('discord-api-types/v10');
const { UserRoutes } = require('../util/UserRoutes');
const { resolvePartialEmoji } = require('../util/Util');

const CUSTOM_STATUS_MAX_LENGTH = 128;
const MAX_BUTTONS = 2;
const MAX_EXTERNAL_IMAGES = 2;

/**
 * Builder cho activity mà client user tự phát lên gateway.
 *
 * Bản v13 cho các lớp này kế thừa {@link Activity} — lớp dùng để *đọc* presence
 * của người khác — nên constructor phải lách kiểu `'presence' in client ?
 * client.presence : client`. Ở đây tách hẳn: đây là builder, việc duy nhất của
 * nó là dựng payload gateway qua `toJSON()`.
 * @abstract
 */
class BaseActivityBuilder {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Dựng payload gửi lên gateway.
   * @abstract
   * @returns {Object}
   */
  toJSON() {
    throw new Error(`${this.constructor.name} must implement toJSON()`);
  }

  toString() {
    return this.name;
  }
}

/**
 * Custom status của client user.
 * @extends {BaseActivityBuilder}
 */
class CustomStatus extends BaseActivityBuilder {
  /**
   * @param {Object} [data={}] Dữ liệu ban đầu
   * @param {?string} [data.state] Nội dung hiển thị
   * @param {?EmojiIdentifierResolvable} [data.emoji] Emoji hiển thị kèm
   */
  constructor(data = {}) {
    super({ name: 'Custom Status', type: ActivityType.Custom, state: null, emoji: null, ...data });
  }

  /**
   * Đặt emoji.
   * @param {?EmojiIdentifierResolvable} emoji Emoji hiển thị
   * @returns {CustomStatus}
   */
  setEmoji(emoji) {
    if (emoji === null) {
      this.emoji = null;
      return this;
    }

    // `resolvePartialEmoji` trả `id: undefined` cho emoji unicode, mà
    // `JSON.stringify` nuốt mất key undefined. Gateway mong `id: null`.
    const resolved = resolvePartialEmoji(emoji);
    this.emoji = { ...resolved, id: resolved.id ?? null };
    return this;
  }

  /**
   * Đặt nội dung.
   * @param {?string} state Nội dung, tối đa 128 ký tự
   * @returns {CustomStatus}
   */
  setState(state) {
    if (typeof state === 'string' && state.length > CUSTOM_STATUS_MAX_LENGTH) {
      throw new RangeError(`Custom status state must be at most ${CUSTOM_STATUS_MAX_LENGTH} characters`);
    }
    this.state = state;
    return this;
  }

  toJSON() {
    if (!this.emoji && !this.state) {
      throw new Error('CustomStatus must have at least one of emoji or state');
    }
    return {
      name: this.name,
      type: ActivityType.Custom,
      state: this.state,
      emoji: this.emoji,
    };
  }
}

/**
 * Rich presence do client user tự phát.
 * @extends {BaseActivityBuilder}
 */
class RichPresence extends BaseActivityBuilder {
  /**
   * @param {Object} [data={}] Dữ liệu ban đầu
   */
  constructor(data = {}) {
    super({
      name: null,
      type: ActivityType.Playing,
      url: null,
      applicationId: null,
      state: null,
      details: null,
      platform: null,
      party: null,
      timestamps: null,
      assets: {},
      buttons: [],
      metadata: {},
      secrets: {},
      ...data,
    });
  }

  /**
   * Đặt tên activity.
   * @param {?string} name Tên
   * @returns {RichPresence}
   */
  setName(name) {
    this.name = name;
    return this;
  }

  /**
   * Đặt kiểu activity.
   * @param {ActivityType} type Kiểu
   * @returns {RichPresence}
   */
  setType(type) {
    this.type = type;
    return this;
  }

  /**
   * Đặt url stream (chỉ có tác dụng với {@link ActivityType.Streaming}).
   * @param {?string} url Url stream
   * @returns {RichPresence}
   */
  setURL(url) {
    if (url !== null && !URL.canParse(url)) throw new Error('Stream url must be a valid url');
    this.url = url;
    return this;
  }

  /**
   * Đặt application id — bắt buộc nếu muốn hiện ảnh asset.
   * @param {?Snowflake} id Application id
   * @returns {RichPresence}
   */
  setApplicationId(id) {
    this.applicationId = id;
    return this;
  }

  /**
   * Đặt dòng state.
   * @param {?string} state Nội dung
   * @returns {RichPresence}
   */
  setState(state) {
    this.state = state;
    return this;
  }

  /**
   * Đặt dòng details.
   * @param {?string} details Nội dung
   * @returns {RichPresence}
   */
  setDetails(details) {
    this.details = details;
    return this;
  }

  /**
   * Đặt nền tảng hiển thị (`desktop`, `android`, `ios`, `samsung`, `xbox`, `ps5`).
   * @param {?string} platform Nền tảng
   * @returns {RichPresence}
   */
  setPlatform(platform) {
    this.platform = platform;
    return this;
  }

  /**
   * @typedef {Object} RichPresenceParty
   * @property {?string} id Id của party
   * @property {number} size Số người hiện tại
   * @property {number} max Sức chứa tối đa
   */

  /**
   * Đặt thông tin party.
   * @param {?RichPresenceParty} party Party, `null` để xoá
   * @returns {RichPresence}
   */
  setParty(party) {
    if (party === null) {
      this.party = null;
      return this;
    }
    if (typeof party.size !== 'number' || typeof party.max !== 'number') {
      throw new TypeError('Party size and max must both be numbers');
    }
    this.party = { id: party.id ?? null, size: [party.size, party.max] };
    return this;
  }

  /**
   * Đặt thời điểm bắt đầu.
   * @param {?(Date|number)} timestamp Thời điểm
   * @returns {RichPresence}
   */
  setStartTimestamp(timestamp) {
    this.timestamps = { ...this.timestamps, start: timestamp === null ? null : new Date(timestamp).getTime() };
    return this;
  }

  /**
   * Đặt thời điểm kết thúc.
   * @param {?(Date|number)} timestamp Thời điểm
   * @returns {RichPresence}
   */
  setEndTimestamp(timestamp) {
    this.timestamps = { ...this.timestamps, end: timestamp === null ? null : new Date(timestamp).getTime() };
    return this;
  }

  /**
   * Đặt ảnh lớn.
   * @param {?string} image Asset id, hoặc `mp:`/`external_asset_path` từ
   * {@link RichPresence.getExternal}
   * @returns {RichPresence}
   */
  setAssetsLargeImage(image) {
    this.assets.large_image = image;
    return this;
  }

  /**
   * Đặt ảnh nhỏ.
   * @param {?string} image Asset id
   * @returns {RichPresence}
   */
  setAssetsSmallImage(image) {
    this.assets.small_image = image;
    return this;
  }

  /**
   * Đặt tooltip của ảnh lớn.
   * @param {?string} text Nội dung
   * @returns {RichPresence}
   */
  setAssetsLargeText(text) {
    this.assets.large_text = text;
    return this;
  }

  /**
   * Đặt tooltip của ảnh nhỏ.
   * @param {?string} text Nội dung
   * @returns {RichPresence}
   */
  setAssetsSmallText(text) {
    this.assets.small_text = text;
    return this;
  }

  /**
   * Đặt secret để người khác bấm join.
   * @param {?string} join Secret
   * @returns {RichPresence}
   */
  setJoinSecret(join) {
    this.secrets.join = join;
    return this;
  }

  /**
   * Thêm một nút bấm. Tối đa 2 nút.
   * @param {string} label Chữ trên nút
   * @param {string} url Link nút trỏ tới
   * @returns {RichPresence}
   */
  addButton(label, url) {
    if (!label || !url) throw new Error('Button label and url are both required');
    if (!URL.canParse(url)) throw new Error('Button url must be a valid url');
    if (this.buttons.length >= MAX_BUTTONS) {
      throw new RangeError(`RichPresence can have at most ${MAX_BUTTONS} buttons`);
    }

    this.buttons.push(label);
    this.metadata.button_urls = [...(this.metadata.button_urls ?? []), url];
    return this;
  }

  /**
   * Thay toàn bộ nút bấm.
   * @param {...{label: string, url: string}} buttons Danh sách nút
   * @returns {RichPresence}
   */
  setButtons(...buttons) {
    this.buttons = [];
    this.metadata.button_urls = [];
    for (const button of buttons.flat()) this.addButton(button.label, button.url);
    return this;
  }

  toJSON() {
    const data = {
      name: this.name,
      type: this.type,
      application_id: this.applicationId,
      url: this.url,
      state: this.state,
      details: this.details,
      platform: this.platform,
    };

    if (this.party) data.party = this.party;
    if (this.timestamps) data.timestamps = this.timestamps;
    if (Object.keys(this.assets).length) data.assets = this.assets;
    if (this.buttons.length) {
      data.buttons = this.buttons;
      data.metadata = this.metadata;
    }
    if (Object.keys(this.secrets).length) data.secrets = this.secrets;

    return data;
  }

  /**
   * @typedef {Object} ExternalAsset
   * @property {string} url Url gốc của ảnh
   * @property {string} external_asset_path Đường dẫn proxy dùng cho rich presence
   */

  /**
   * Đẩy ảnh ngoài (không host trên Discord) lên proxy của Discord để dùng làm
   * asset. Trả về đường dẫn truyền cho {@link RichPresence#setAssetsLargeImage}.
   * @param {Client} client Client đã đăng nhập
   * @param {Snowflake} applicationId Application id gắn với rich presence
   * @param {...string} images Tối đa 2 url ảnh
   * @returns {Promise<ExternalAsset[]>}
   */
  static async getExternal(client, applicationId, ...images) {
    if (!client?.token) throw new Error('Client must be logged in');
    if (!/^\d{17,19}$/.test(applicationId)) throw new Error('Application id must be a Discord snowflake');
    if (images.length > MAX_EXTERNAL_IMAGES) {
      throw new RangeError(`RichPresence can have at most ${MAX_EXTERNAL_IMAGES} external images`);
    }
    if (images.some(image => !URL.canParse(image))) throw new Error('Each image must be a valid url');

    return client.rest.post(UserRoutes.applicationExternalAssets(applicationId), { body: { urls: images } });
  }
}

/**
 * Rich presence giả lập Spotify.
 * @extends {RichPresence}
 */
class SpotifyRPC extends RichPresence {
  /**
   * @param {Object} [data={}] Dữ liệu ban đầu
   */
  constructor(data = {}) {
    super({
      name: 'Spotify',
      type: ActivityType.Listening,
      party: { id: `spotify:${Date.now()}` },
      // Flags 48 = Instance | Sync, thứ client Spotify thật gửi.
      flags: 48,
      songId: null,
      albumId: null,
      artistIds: [],
      ...data,
    });
  }

  /**
   * Đặt id bài hát trên Spotify.
   * @param {string} id Track id
   * @returns {SpotifyRPC}
   */
  setSongId(id) {
    this.songId = id;
    return this;
  }

  /**
   * Đặt id album.
   * @param {string} id Album id
   * @returns {SpotifyRPC}
   */
  setAlbumId(id) {
    this.albumId = id;
    return this;
  }

  /**
   * Thêm một nghệ sĩ.
   * @param {string} id Artist id
   * @returns {SpotifyRPC}
   */
  addArtistId(id) {
    this.artistIds.push(id);
    return this;
  }

  /**
   * Thay toàn bộ danh sách nghệ sĩ.
   * @param {...string} ids Artist id
   * @returns {SpotifyRPC}
   */
  setArtistIds(...ids) {
    this.artistIds = ids.flat();
    return this;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      flags: this.flags,
      sync_id: this.songId,
      metadata: {
        album_id: this.albumId,
        artist_ids: this.artistIds,
      },
    };
  }
}

module.exports = { BaseActivityBuilder, CustomStatus, RichPresence, SpotifyRPC };
