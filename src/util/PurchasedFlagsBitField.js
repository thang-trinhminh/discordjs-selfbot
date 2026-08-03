'use strict';

const BitField = require('./BitField');

/**
 * Cờ cho biết tài khoản đã từng mua những gói nào.
 * @extends {BitField}
 */
class PurchasedFlagsBitField extends BitField {
  /**
   * Cờ dạng số.
   * @type {Object<string, number>}
   * @memberof PurchasedFlagsBitField
   */
  static Flags = {
    NitroClassic: 1 << 0,
    Nitro: 1 << 1,
    GuildBoost: 1 << 2,
    NitroBasic: 1 << 3,
  };
}

module.exports = PurchasedFlagsBitField;
