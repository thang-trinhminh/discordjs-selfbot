'use strict';

const {
  ActivityType,
  ChannelType,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  GuildVerificationLevel,
  StageInstancePrivacyLevel,
  VideoQualityMode,
} = require('discord-api-types/v10');
const { buildLegacyMap, RENAMES } = require('./legacyNames');

const CHANNEL_TYPES = buildLegacyMap(ChannelType, RENAMES.ChannelType);
const ACTIVITY_TYPES = buildLegacyMap(ActivityType);
const VERIFICATION_LEVELS = buildLegacyMap(GuildVerificationLevel);
const NOTIFICATION_LEVELS = buildLegacyMap(GuildDefaultMessageNotifications, RENAMES.GuildDefaultMessageNotifications);
const CONTENT_FILTERS = buildLegacyMap(GuildExplicitContentFilter);
const EVENT_PRIVACY_LEVELS = buildLegacyMap(GuildScheduledEventPrivacyLevel);
const EVENT_ENTITY_TYPES = buildLegacyMap(GuildScheduledEventEntityType);
const EVENT_STATUSES = buildLegacyMap(GuildScheduledEventStatus);
const STAGE_PRIVACY_LEVELS = buildLegacyMap(StageInstancePrivacyLevel);
const VIDEO_QUALITY_MODES = buildLegacyMap(VideoQualityMode);

/**
 * Dịch một giá trị: nếu là chuỗi kiểu v13 thì trả số tương ứng, còn lại giữ nguyên.
 * @param {*} value Giá trị cần dịch
 * @param {Object<string, *>} map Bảng tra `TÊN_V13 -> giá trị`
 * @returns {*}
 */
function coerceValue(value, map) {
  if (typeof value !== 'string') return value;
  return map[value] ?? value;
}

/**
 * Bọc một method để dịch các field enum dạng chuỗi trong object tuỳ chọn.
 *
 * Bọc ở đây thay vì sửa file upstream: compat layer chịu trách nhiệm cho phần
 * tương thích, `src/` giữ nguyên hình dạng v14.
 * @param {Object} target Prototype chứa method
 * @param {string} methodName Tên method
 * @param {Object<string, Object>} fieldMap Tên field -> bảng tra
 * @param {number} [argIndex=0] Vị trí tham số chứa object tuỳ chọn
 * @returns {void}
 */
function coerceOptions(target, methodName, fieldMap, argIndex = 0) {
  const original = target[methodName];
  if (typeof original !== 'function') return;

  target[methodName] = function coerced(...args) {
    const options = args[argIndex];

    if (options && typeof options === 'object') {
      const patched = { ...options };
      let changed = false;

      for (const [field, map] of Object.entries(fieldMap)) {
        if (typeof patched[field] !== 'string') continue;
        const value = coerceValue(patched[field], map);
        if (value !== patched[field]) {
          patched[field] = value;
          changed = true;
        }
      }

      if (changed) args[argIndex] = patched;
    }

    return original.apply(this, args);
  };
}

/**
 * Cho các điểm nhận tuỳ chọn hay dùng nhất chấp nhận chuỗi enum kiểu v13.
 *
 * <warn>Đây không phải danh sách đầy đủ mọi enum của API. Chỗ nào không nằm
 * trong này thì code cũ vẫn phải sửa — dùng `scripts/codemod-v13-to-v14.mjs`.</warn>
 * @returns {void}
 */
function applyOptionCoercion() {
  const GuildChannelManager = require('../managers/GuildChannelManager');
  const GuildManager = require('../managers/GuildManager');
  const GuildScheduledEventManager = require('../managers/GuildScheduledEventManager');
  const StageInstanceManager = require('../managers/StageInstanceManager');
  const { Guild } = require('../structures/Guild');
  const ClientPresence = require('../structures/ClientPresence');

  const guildLevels = {
    verificationLevel: VERIFICATION_LEVELS,
    defaultMessageNotifications: NOTIFICATION_LEVELS,
    explicitContentFilter: CONTENT_FILTERS,
  };
  const eventLevels = {
    privacyLevel: EVENT_PRIVACY_LEVELS,
    entityType: EVENT_ENTITY_TYPES,
    status: EVENT_STATUSES,
  };
  const channelFields = { type: CHANNEL_TYPES, videoQualityMode: VIDEO_QUALITY_MODES };

  coerceOptions(GuildChannelManager.prototype, 'create', channelFields);
  coerceOptions(GuildChannelManager.prototype, 'edit', channelFields, 1);
  coerceOptions(GuildManager.prototype, 'create', guildLevels);
  coerceOptions(Guild.prototype, 'edit', guildLevels);
  coerceOptions(GuildScheduledEventManager.prototype, 'create', eventLevels);
  coerceOptions(GuildScheduledEventManager.prototype, 'edit', eventLevels, 1);
  coerceOptions(StageInstanceManager.prototype, 'create', { privacyLevel: STAGE_PRIVACY_LEVELS }, 1);
  coerceOptions(StageInstanceManager.prototype, 'edit', { privacyLevel: STAGE_PRIVACY_LEVELS }, 1);

  // Presence đi qua `_parse`, nên một chỗ này phủ cả setActivity lẫn setPresence.
  const originalParse = ClientPresence.prototype._parse;
  ClientPresence.prototype._parse = function _parse(presence) {
    if (Array.isArray(presence?.activities)) {
      presence = {
        ...presence,
        activities: presence.activities.map(activity =>
          activity && typeof activity.type === 'string'
            ? { ...activity, type: coerceValue(activity.type, ACTIVITY_TYPES) }
            : activity,
        ),
      };
    }
    return originalParse.call(this, presence);
  };
}

module.exports = { coerceValue, coerceOptions, applyOptionCoercion };
