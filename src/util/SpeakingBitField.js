'use strict';

const BitField = require('./BitField');

/**
 * Cờ speaking gửi trên voice gateway.
 *
 * v14 bỏ lớp này vì phần voice đã tách sang `@discordjs/voice`; stack voice ở
 * đây kế thừa từ v12 nên vẫn cần.
 * @extends {BitField}
 */
class SpeakingBitField extends BitField {
  /**
   * Cờ speaking dạng số.
   * @type {Object<string, number>}
   * @memberof SpeakingBitField
   * @see {@link https://discord.com/developers/docs/topics/voice-connections#speaking}
   */
  static Flags = {
    Speaking: 1 << 0,
    Soundshare: 1 << 1,
    PrioritySpeaking: 1 << 2,
  };
}

module.exports = SpeakingBitField;
