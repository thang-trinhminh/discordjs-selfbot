'use strict';

const { buildAliases, applyMethodAliases } = require('./aliases');
const { applyBitFieldCompat } = require('./bitfields');
const { applyOptionCoercion, coerceValue } = require('./coerce');
const Constants = require('./constants');

let applied = false;

/**
 * Bật lớp tương thích v13.
 *
 * Gồm ba phần:
 * 1. Alias tên lớp (`MessageEmbed`, `Permissions`, `Channel`...).
 * 2. Tên cờ kiểu v13 cho mọi BitField (`'SEND_MESSAGES'` thay `'SendMessages'`).
 * 3. Dịch chuỗi enum kiểu v13 ở các điểm nhận tuỳ chọn hay dùng nhất.
 *
 * <warn>Phần KHÔNG cứu được: so sánh literal ở phía đọc, ví dụ
 * `if (channel.type === 'GUILD_TEXT')`. `channel.type` vẫn trả số. Ép nội bộ về
 * chuỗi sẽ phải sửa 99 chỗ `ChannelType` trên 18 file upstream, tức mất khả năng
 * merge upstream — chính là lý do migrate. Dùng `scripts/codemod-v13-to-v14.mjs`
 * chạy một lần trên repo consumer để sửa những chỗ đó.</warn>
 *
 * Hàm này tự bảo vệ khỏi gọi nhiều lần.
 * @returns {Object} Bảng alias, để `src/index.js` trải vào exports
 */
function applyCompat() {
  if (applied) return buildAliases();
  applied = true;

  applyBitFieldCompat();
  applyMethodAliases();
  applyOptionCoercion();

  return buildAliases();
}

module.exports = { applyCompat, Constants, coerceValue };
