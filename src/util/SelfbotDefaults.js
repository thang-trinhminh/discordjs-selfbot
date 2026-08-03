'use strict';

const { Buffer } = require('node:buffer');

/**
 * User-Agent giả lập Discord desktop app. Phải khớp với `browser_user_agent`
 * trong super properties, nếu không Discord sẽ đánh dấu request bất thường.
 * @type {string}
 */
const DefaultUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/134.0.0.0 Safari/537.36';

/**
 * Super properties gửi kèm mọi request REST (header `x-super-properties`)
 * và trong payload identify của gateway. Key KHÔNG có tiền tố `$` —
 * schema cũ dùng `$os`, Discord đã bỏ.
 * @type {Object}
 */
const DefaultSuperProperties = {
  os: 'Windows',
  browser: 'Chrome',
  device: '',
  system_locale: 'en-US',
  browser_user_agent: DefaultUserAgent,
  browser_version: '134.0.0.0',
  os_version: '10',
  referrer: '',
  referring_domain: '',
  referrer_current: '',
  referring_domain_current: '',
  release_channel: 'stable',
  client_build_number: 384477,
  client_event_source: null,
};

/**
 * Gateway capabilities bitfield.
 * Tham khảo: https://docs.discord.food/topics/gateway#gateway-capabilities
 * @type {number}
 */
const DefaultCapabilities = 161789;

/**
 * Trạng thái cache phía client gửi kèm identify. Client mới thì rỗng hết.
 * @type {Object}
 */
const DefaultClientState = {
  guild_versions: {},
  highest_last_message_id: '0',
  read_state_version: 0,
  user_guild_settings_version: -1,
  user_settings_version: -1,
  private_channels_version: '0',
  api_code_version: 0,
};

/**
 * Danh sách cipher TLS theo thứ tự Chrome dùng. Đặt đúng thứ tự này để
 * TLS fingerprint (JA3) giống browser thay vì giống Node mặc định.
 * @type {string[]}
 */
const DefaultCiphers = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
];

/**
 * Bỏ tiền tố `$` khỏi key của super properties (schema cũ của Discord).
 * Không mutate object đầu vào.
 * @param {Object} properties Super properties thô
 * @returns {Object}
 */
function normalizeSuperProperties(properties) {
  const result = {};
  for (const [key, value] of Object.entries(properties)) {
    result[key.startsWith('$') ? key.slice(1) : key] = value;
  }
  return result;
}

/**
 * Encode super properties thành giá trị header `x-super-properties`.
 * @param {Object} properties Super properties
 * @returns {string} base64
 */
function encodeSuperProperties(properties) {
  return Buffer.from(JSON.stringify(normalizeSuperProperties(properties)), 'utf8').toString('base64');
}

module.exports = {
  DefaultUserAgent,
  DefaultSuperProperties,
  DefaultCapabilities,
  DefaultClientState,
  DefaultCiphers,
  normalizeSuperProperties,
  encodeSuperProperties,
};
