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
   *
   * `ws` trả frame text dưới dạng chuỗi và frame nhị phân dưới dạng `Buffer`, nên
   * kiểu của `data` chính là thứ phân biệt hai loại. DAVE là loại thứ hai, và bản
   * port cũ `JSON.parse` mọi thứ nên frame nhị phân đầu tiên làm nó ném lỗi.
   * @param {string|Buffer|ArrayBuffer} data Dữ liệu thô
   * @returns {Object}
   */
  unpack(data) {
    if (typeof data === 'string') return JSON.parse(data);

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return {
      seq: buffer.readUInt16BE(0),
      op: buffer.readUInt8(2),
      payload: buffer.subarray(3),
    };
  },

  /**
   * Đóng gói một frame nhị phân để gửi đi. Chiều gửi không mang `seq`.
   * @param {number} op Opcode
   * @param {Buffer} payload Nội dung
   * @returns {Buffer}
   */
  packBinary(op, payload) {
    return Buffer.concat([Uint8Array.from([op]), payload]);
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
