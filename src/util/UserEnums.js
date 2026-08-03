'use strict';

/**
 * Enum của các endpoint và kiểu dữ liệu chỉ user account mới có.
 * `discord-api-types` chỉ mô tả API dành cho bot nên những thứ này không có ở đó.
 * Đặt riêng một file để phần selfbot không lẫn vào enum upstream.
 */

/**
 * Kiểu quan hệ giữa client user và một user khác.
 * @typedef {Object} RelationshipType
 * @property {number} None Không có quan hệ
 * @property {number} Friend Bạn bè
 * @property {number} Blocked Đã chặn
 * @property {number} PendingIncoming Lời mời kết bạn đến
 * @property {number} PendingOutgoing Lời mời kết bạn đã gửi
 * @property {number} Implicit Quan hệ ngầm (có tương tác gần đây)
 * @property {number} Suggestion Gợi ý kết bạn
 * @see {@link https://docs.discord.food/resources/relationships#relationship-type}
 */
const RelationshipType = {
  None: 0,
  Friend: 1,
  Blocked: 2,
  PendingIncoming: 3,
  PendingOutgoing: 4,
  Implicit: 5,
  Suggestion: 6,
};

/**
 * Nhà HypeSquad. `Leave` không phải nhà — dùng nó để rời.
 * @typedef {Object} HypeSquadHouse
 * @property {number} Leave Rời khỏi nhà hiện tại
 * @property {number} Bravery Nhà Bravery
 * @property {number} Brilliance Nhà Brilliance
 * @property {number} Balance Nhà Balance
 */
const HypeSquadHouse = {
  Leave: 0,
  Bravery: 1,
  Brilliance: 2,
  Balance: 3,
};

/**
 * Hành động cho activity kiểu Samsung Game Launcher.
 * @typedef {Object} SamsungActivityAction
 * @property {string} Start Bắt đầu phát
 * @property {string} Update Cập nhật
 * @property {string} Stop Dừng phát
 */
const SamsungActivityAction = {
  Start: 'START',
  Update: 'UPDATE',
  Stop: 'STOP',
};

module.exports = { RelationshipType, HypeSquadHouse, SamsungActivityAction };
