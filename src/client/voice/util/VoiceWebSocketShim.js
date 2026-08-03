'use strict';

const { Buffer } = require('node:buffer');
const WebSocket = require('ws');

/**
 * Lớp mỏng thay cho `src/WebSocket.js` của v13, file mà v14 đã bỏ khi chuyển
 * sang `@discordjs/ws`.
 *
 * Voice gateway luôn dùng JSON, không nén, nên chỗ này không cần zlib hay etf
 * như gateway chính.
 */
module.exports = {
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,

  /**
   * Mở kết nối tới voice gateway.
   * @param {string} gateway Địa chỉ gateway
   * @param {Object} [query={}] Tham số query
   * @param {Object} [options={}] Tuỳ chọn cho `ws`
   * @returns {WebSocket}
   */
  create(gateway, query = {}, options = {}) {
    const url = new URL(gateway);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return new WebSocket(url.toString(), options);
  },

  /**
   * Giải mã một gói nhận được.
   * @param {*} data Dữ liệu thô
   * @returns {Object}
   */
  unpack(data) {
    return JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));
  },

  /**
   * Mã hoá một gói để gửi đi.
   * @param {Object} data Payload
   * @returns {string}
   */
  pack(data) {
    return JSON.stringify(data);
  },
};
