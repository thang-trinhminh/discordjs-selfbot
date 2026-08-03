'use strict';

const { PermissionFlagsBits } = require('discord-api-types/v10');
const { buildLegacyMap, RENAMES } = require('./legacyNames');

/**
 * Cho một lớp BitField hiểu thêm tên cờ kiểu v13.
 *
 * Ghi đè `static resolve` chứ không nhét tên cũ vào `Flags`: `toArray()` và
 * iterator duyệt `Object.keys(Flags)`, thêm vào đó sẽ khiến chúng trả về mỗi cờ
 * hai lần. `resolve` cũng là chỗ đệ quy khi nhận mảng, nên phủ được mọi lối vào.
 * @param {Function} BitFieldClass Lớp BitField cần vá
 * @param {Object<string, *>} legacyFlags Bảng `TÊN_V13 -> giá trị`
 * @returns {void}
 */
function applyLegacyFlagNames(BitFieldClass, legacyFlags) {
  // Chỉ giữ tên nào thực sự khác tên hiện tại, để bảng tra không phình vô ích.
  const extras = Object.fromEntries(
    Object.entries(legacyFlags).filter(([name]) => BitFieldClass.Flags[name] === undefined),
  );

  /**
   * Tên cờ kiểu v13 mà lớp này chấp nhận thêm.
   * @type {Object<string, *>}
   */
  BitFieldClass.LegacyFlags = extras;

  const originalResolve = BitFieldClass.resolve.bind(BitFieldClass);
  BitFieldClass.resolve = function resolve(bit) {
    if (typeof bit === 'string' && extras[bit] !== undefined) return extras[bit];
    // Mảng phải đi qua `this.resolve` để phần tử con cũng được dịch.
    if (Array.isArray(bit)) {
      const { DefaultBit } = BitFieldClass;
      return bit.map(entry => BitFieldClass.resolve(entry)).reduce((prev, entry) => prev | entry, DefaultBit);
    }
    return originalResolve(bit);
  };
}

/**
 * Gắn tên cờ kiểu v13 cho toàn bộ BitField mà code v13 hay dùng.
 * @returns {void}
 */
function applyBitFieldCompat() {
  // Lấy qua `../index` chứ không require từng file: hình dạng export không đồng
  // nhất (`GuildMemberFlagsBitField` là named export, phần còn lại là default).
  const djs = require('../index');

  applyLegacyFlagNames(djs.PermissionsBitField, buildLegacyMap(PermissionFlagsBits, RENAMES.PermissionFlagsBits));

  for (const name of [
    'IntentsBitField',
    'MessageFlagsBitField',
    'UserFlagsBitField',
    'ActivityFlagsBitField',
    'ApplicationFlagsBitField',
    'AttachmentFlagsBitField',
    'ChannelFlagsBitField',
    'GuildMemberFlagsBitField',
    'RoleFlagsBitField',
    'SystemChannelFlagsBitField',
    'ThreadMemberFlagsBitField',
  ]) {
    const BitFieldClass = djs[name];
    if (BitFieldClass?.Flags) applyLegacyFlagNames(BitFieldClass, buildLegacyMap(BitFieldClass.Flags));
  }
}

module.exports = { applyLegacyFlagNames, applyBitFieldCompat };
