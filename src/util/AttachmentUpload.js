'use strict';

const { Buffer } = require('node:buffer');
const { UserRoutes } = require('./UserRoutes');

/**
 * @typedef {Object} UploadSlot
 * @property {string} id Chỉ số slot, dạng chuỗi
 * @property {string} upload_url Địa chỉ PUT dữ liệu lên
 * @property {string} upload_filename Tên file Discord dùng để tham chiếu sau khi upload
 */

/**
 * Xin chỗ upload cho một danh sách file.
 *
 * Đây là bước bắt buộc với tài khoản người dùng: file phải nằm sẵn trên Google
 * Cloud của Discord trước, rồi interaction mới tham chiếu tới nó — khác hẳn bot,
 * bot đính thẳng file vào multipart của request.
 * @param {Client} client Client đã đăng nhập
 * @param {Snowflake} channelId Kênh sẽ gửi file
 * @param {Array<Object>} files File đã resolve, mỗi phần tử có `name` và `data`
 * @returns {Promise<UploadSlot[]>}
 */
async function requestUploadSlots(client, channelId, files) {
  if (!files.length) return [];

  const { attachments } = await client.rest.post(UserRoutes.channelAttachments(channelId), {
    body: {
      files: files.map((file, index) => ({
        filename: file.name,
        // Kích thước thật. Bản v13 gửi một số ngẫu nhiên ở đây, mà Discord dùng
        // field này để kiểm tra hạn mức nên gửi sai là hỏng.
        file_size: byteLengthOf(file.data),
        id: String(index),
      })),
    },
  });

  return attachments;
}

/**
 * Số byte của dữ liệu file.
 * @param {Buffer|Uint8Array|string} data Dữ liệu
 * @returns {number}
 */
function byteLengthOf(data) {
  if (typeof data === 'string') return Buffer.byteLength(data);
  if (Buffer.isBuffer(data) || ArrayBuffer.isView(data)) return data.byteLength;
  throw new TypeError('Attachment data must be a Buffer, a typed array or a string to know its size');
}

/**
 * Đẩy dữ liệu lên chỗ đã xin được.
 * @param {string} uploadUrl Địa chỉ lấy từ {@link requestUploadSlots}
 * @param {Buffer|Uint8Array|string} data Dữ liệu file
 * @returns {Promise<void>}
 */
async function uploadToSlot(uploadUrl, data) {
  const response = await fetch(uploadUrl, { method: 'PUT', body: data });
  if (!response.ok) {
    throw new Error(`Uploading the attachment failed with ${response.status} ${response.statusText}`);
  }
}

/**
 * Upload một file rồi trả về bản ghi để nhét vào `data.attachments` của interaction.
 * @param {Client} client Client đã đăng nhập
 * @param {Snowflake} channelId Kênh sẽ gửi file
 * @param {AttachmentPayload|BufferResolvable|Stream} file File cần upload
 * @param {number} index Vị trí của file trong interaction, cũng là giá trị của option
 * @returns {Promise<Object>}
 */
async function uploadInteractionAttachment(client, channelId, file, index) {
  const MessagePayload = require('../structures/MessagePayload');
  const resolved = await MessagePayload.resolveFile(file);

  if (!resolved?.data) {
    throw new TypeError('An attachment option needs a BufferResolvable, a Stream or an AttachmentPayload');
  }

  const [slot] = await requestUploadSlots(client, channelId, [resolved]);
  await uploadToSlot(slot.upload_url, resolved.data);

  return {
    id: String(index),
    filename: resolved.name,
    uploaded_filename: slot.upload_filename,
  };
}

module.exports = { requestUploadSlots, uploadToSlot, uploadInteractionAttachment, byteLengthOf };
