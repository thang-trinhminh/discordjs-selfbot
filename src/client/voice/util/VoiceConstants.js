'use strict';

/**
 * Hằng số riêng cho voice, thứ v14 không còn giữ trong `util/Constants`.
 *
 * discord.js v14 chuyển sang enum của `discord-api-types` và bỏ hết phần voice
 * kiểu v12 mà stack này bám vào, nên gom lại đây thay vì sửa file upstream.
 */

const payloadTypes = [
  {
    name: 'opus',
    type: 'audio',
    priority: 1000,
    payload_type: 120,
  },
  {
    name: 'AV1',
    type: 'video',
    priority: 1000,
    payload_type: 101,
    rtx_payload_type: 102,
    encode: false,
    decode: false,
  },
  {
    name: 'H265',
    type: 'video',
    priority: 2000,
    payload_type: 103,
    rtx_payload_type: 104,
    encode: false,
    decode: false,
  },
  {
    name: 'H264',
    type: 'video',
    priority: 3000,
    payload_type: 105,
    rtx_payload_type: 106,
    encode: true,
    decode: true,
  },
  {
    name: 'VP8',
    type: 'video',
    priority: 4000,
    payload_type: 107,
    rtx_payload_type: 108,
    encode: true,
    decode: false,
  },
  {
    name: 'VP9',
    type: 'video',
    priority: 5000,
    payload_type: 109,
    rtx_payload_type: 110,
    encode: false,
    decode: false,
  },
];

/**
 * Opcode của gateway chính, phần selfbot dùng để mở luồng Go Live.
 * @type {Object<string, number>}
 */
const Opcodes = {
  DISPATCH: 0,
  VOICE_STATE_UPDATE: 4,
  STREAM_CREATE: 18,
  STREAM_DELETE: 19,
  STREAM_WATCH: 20,
  STREAM_PING: 21,
  STREAM_SET_PAUSED: 22,
};

/**
 * Opcode của voice gateway.
 * @type {Object<string, number>}
 * @see {@link https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice}
 */
const VoiceOpcodes = {
  IDENTIFY: 0,
  SELECT_PROTOCOL: 1,
  READY: 2,
  HEARTBEAT: 3,
  SESSION_DESCRIPTION: 4,
  SPEAKING: 5,
  HEARTBEAT_ACK: 6,
  RESUME: 7,
  HELLO: 8,
  RESUMED: 9,
  SOURCES: 12,
  CLIENT_CONNECT: 12,
  CLIENT_DISCONNECT: 13,
};

/**
 * Trạng thái của một kết nối voice.
 * @type {Object<string, number>}
 */
const VoiceStatus = {
  CONNECTED: 0,
  CONNECTING: 1,
  AUTHENTICATING: 2,
  RECONNECTING: 3,
  DISCONNECTED: 4,
};

/**
 * Toàn bộ codec Discord công bố khi thương lượng voice.
 * @returns {Array<Object>}
 */
function getAllPayloadType() {
  return payloadTypes;
}

/**
 * Payload type của một codec.
 * @param {string} codecName Tên codec, ví dụ `H264`
 * @returns {number}
 */
function getPayloadType(codecName) {
  const codec = payloadTypes.find(entry => entry.name === codecName);
  if (!codec) throw new Error(`Unknown codec: ${codecName}`);
  return codec.payload_type;
}

module.exports = { payloadTypes, Opcodes, VoiceOpcodes, VoiceStatus, getAllPayloadType, getPayloadType };
