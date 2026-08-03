'use strict';

const BitField = require('./BitField');

/**
 * Cờ cho biết tài khoản đã dùng những đặc quyền Nitro nào.
 * @extends {BitField}
 */
class PremiumUsageFlagsBitField extends BitField {
  /**
   * Cờ dạng số.
   * @type {Object<string, number>}
   * @memberof PremiumUsageFlagsBitField
   */
  static Flags = {
    PremiumDiscriminator: 1 << 0,
    AnimatedAvatar: 1 << 1,
    ProfileBanner: 1 << 2,
  };
}

module.exports = PremiumUsageFlagsBitField;
