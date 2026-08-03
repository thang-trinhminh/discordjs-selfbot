'use strict';

const { Buffer } = require('node:buffer');
const { createHmac } = require('node:crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_DIGITS = 6;
const DEFAULT_STEP = 30;

/**
 * Giải mã chuỗi base32 (RFC 4648) thành buffer.
 *
 * Discord đưa secret 2FA dạng base32, thường không có padding và hay kèm dấu
 * cách khi người dùng copy từ giao diện.
 * @param {string} input Chuỗi base32
 * @returns {Buffer}
 */
function decodeBase32(input) {
  const normalized = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new TypeError(`Invalid base32 character: ${character}`);

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

/**
 * Sinh mã TOTP theo RFC 6238.
 *
 * Tự viết thay vì kéo `otplib` vào: thuật toán chỉ có chừng này dòng, và tính
 * đúng sai kiểm được bằng bộ vector thử của chính RFC (xem test).
 * @param {string} secret Secret 2FA dạng base32
 * @param {Object} [options] Tuỳ chọn
 * @param {number} [options.timestamp=Date.now()] Mốc thời gian tính theo mili giây
 * @param {number} [options.digits=6] Số chữ số của mã
 * @param {number} [options.step=30] Độ dài một bước thời gian, tính bằng giây
 * @returns {string} Mã đã đệm số 0 cho đủ độ dài
 */
function generateTOTP(secret, { timestamp = Date.now(), digits = DEFAULT_DIGITS, step = DEFAULT_STEP } = {}) {
  const counter = Math.floor(timestamp / 1000 / step);

  const counterBuffer = Buffer.alloc(8);
  // Counter là số nguyên 64-bit big-endian; dùng BigInt để không mất bit ở
  // mốc thời gian lớn.
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();

  // Dynamic truncation: 4 bit cuối trỏ tới vị trí bắt đầu lấy 4 byte.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

module.exports = { decodeBase32, generateTOTP };
