'use strict';

const { resolveColor } = require('../util/Util');

/**
 * Endpoint mặc định dựng trang có Open Graph tag để Discord unfurl thành embed.
 *
 * <warn>Đây là dịch vụ bên thứ ba do dự án `discord.js-selfbot-v13` (đã archive)
 * dựng trên gói Render miễn phí. Mọi nội dung embed đi qua máy chủ đó, và không
 * có gì bảo đảm nó còn sống. Tự host rồi truyền `baseURL` nếu cần chắc chắn.</warn>
 * @type {string}
 */
const DEFAULT_BASE_URL = 'https://webembed-sb.onrender.com/embed';

/**
 * Chuỗi ký tự ẩn dùng để đẩy link WebEmbed xuống dưới, khiến người đọc chỉ thấy
 * phần embed chứ không thấy link.
 * @type {string}
 */
const hiddenEmbed = `||${'​||'.repeat(200)}`;

const DESCRIPTION_MAX_LENGTH = 350;

/**
 * Dựng một "embed" bằng cách gửi link tới trang có Open Graph tag, để Discord tự
 * unfurl. Cách duy nhất để tài khoản người dùng gửi được embed, vì API không cho
 * user account đính embed thật vào tin nhắn.
 *
 * Hạn chế so với embed thật: không có timestamp, footer, field hay icon tác giả;
 * chỉ chọn được một trong hai là image hoặc thumbnail; mô tả tối đa 350 ký tự.
 */
class WebEmbed {
  /**
   * @param {Object} [data={}] Dữ liệu ban đầu
   * @param {string} [data.baseURL] Endpoint tự host, mặc định dùng dịch vụ bên thứ ba
   */
  constructor({ baseURL = DEFAULT_BASE_URL, ...data } = {}) {
    /**
     * Endpoint dựng trang Open Graph.
     * @type {string}
     */
    this.baseURL = baseURL;

    /**
     * Ảnh gắn vào ô `image` hay ô `thumbnail`. Chỉ chọn được một.
     * @type {string}
     */
    this.imageType = 'thumbnail';

    Object.assign(this, data);
  }

  /**
   * Đặt tiêu đề.
   * @param {string} title Tiêu đề
   * @returns {WebEmbed}
   */
  setTitle(title) {
    this.title = title;
    return this;
  }

  /**
   * Đặt mô tả.
   * @param {string} description Mô tả, tối đa 350 ký tự
   * @returns {WebEmbed}
   */
  setDescription(description) {
    if (typeof description === 'string' && description.length > DESCRIPTION_MAX_LENGTH) {
      throw new RangeError(`WebEmbed description must be at most ${DESCRIPTION_MAX_LENGTH} characters`);
    }
    this.description = description;
    return this;
  }

  /**
   * Đặt link của tiêu đề.
   * @param {string} url Link
   * @returns {WebEmbed}
   */
  setURL(url) {
    this.url = url;
    return this;
  }

  /**
   * Đặt màu viền.
   * @param {ColorResolvable} color Màu
   * @returns {WebEmbed}
   */
  setColor(color) {
    this.color = resolveColor(color);
    return this;
  }

  /**
   * Đặt tác giả.
   * @param {?{name: string, url: ?string}} options Tác giả, `null` để xoá
   * @returns {WebEmbed}
   */
  setAuthor(options) {
    this.author = options === null ? {} : { name: options.name, url: options.url };
    return this;
  }

  /**
   * Đặt nhà cung cấp (dòng chữ nhỏ phía trên tiêu đề).
   * @param {?{name: string, url: ?string}} options Nhà cung cấp, `null` để xoá
   * @returns {WebEmbed}
   */
  setProvider(options) {
    this.provider = options === null ? {} : { name: options.name, url: options.url };
    return this;
  }

  /**
   * Đặt ảnh lớn. Ghi đè thumbnail nếu đã đặt — Discord chỉ hiện một trong hai.
   * @param {string} url Link ảnh
   * @returns {WebEmbed}
   */
  setImage(url) {
    this.imageType = 'image';
    this.image = { url };
    this.thumbnail = null;
    return this;
  }

  /**
   * Đặt ảnh nhỏ. Ghi đè image nếu đã đặt.
   * @param {string} url Link ảnh
   * @returns {WebEmbed}
   */
  setThumbnail(url) {
    this.imageType = 'thumbnail';
    this.thumbnail = { url };
    this.image = null;
    return this;
  }

  /**
   * Đặt video.
   * @param {string} url Link video
   * @returns {WebEmbed}
   */
  setVideo(url) {
    this.video = { url };
    return this;
  }

  /**
   * Đặt link người xem sẽ tới khi bấm vào embed.
   * @param {string} url Link đích
   * @returns {WebEmbed}
   */
  setRedirect(url) {
    this.redirect = url;
    return this;
  }

  /**
   * Dựng link để gửi vào tin nhắn.
   * @returns {string}
   */
  toString() {
    const url = new URL(this.baseURL);
    const params = url.searchParams;

    params.set('image_type', this.imageType);
    if (this.title) params.set('title', this.title);
    if (this.description) params.set('description', this.description);
    if (this.url) params.set('url', this.url);
    if (this.color) params.set('color', `#${this.color.toString(16).padStart(6, '0')}`);
    if (this.author?.name) params.set('author_name', this.author.name);
    if (this.author?.url) params.set('author_url', this.author.url);
    if (this.provider?.name) params.set('provider_name', this.provider.name);
    if (this.provider?.url) params.set('provider_url', this.provider.url);
    if (this.video?.url) params.set('video', this.video.url);

    // Cả image và thumbnail đều vào cùng một tham số; `image_type` quyết định
    // Discord hiện nó ở ô nào.
    const image = this.image?.url ?? this.thumbnail?.url;
    if (image) params.set('image', image);

    if (this.redirect) params.set('redirect', this.redirect);

    return url.toString();
  }
}

module.exports = WebEmbed;
module.exports.hiddenEmbed = hiddenEmbed;
module.exports.DEFAULT_BASE_URL = DEFAULT_BASE_URL;
