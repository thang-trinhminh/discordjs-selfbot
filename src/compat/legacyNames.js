'use strict';

/**
 * Đổi tên kiểu PascalCase của v14 sang SCREAMING_SNAKE của v13.
 *
 * Chuỗi viết hoa liên tiếp được coi là một token, nên `UseVAD` ra `USE_VAD`
 * chứ không phải `USE_V_A_D`.
 * @param {string} name Tên kiểu PascalCase
 * @returns {string}
 */
function toScreamingSnake(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

/**
 * Dựng bảng tra `TÊN_V13 -> giá trị` từ một enum của v14.
 *
 * Enum của `discord-api-types` là bảng hai chiều (cả `Key -> 0` lẫn `0 -> Key`),
 * nên phải bỏ qua key dạng số.
 * @param {Object} enumObject Enum của v14
 * @param {Object<string, string>} [overrides={}] Tên v13 -> tên v14, cho các chỗ đổi tên
 * @returns {Object<string, *>}
 */
function buildLegacyMap(enumObject, overrides = {}) {
  const map = {};

  for (const [key, value] of Object.entries(enumObject)) {
    if (/^\d+$/.test(key)) continue;
    map[toScreamingSnake(key)] = value;
  }

  for (const [legacyName, currentName] of Object.entries(overrides)) {
    if (currentName in enumObject) map[legacyName] = enumObject[currentName];
  }

  return map;
}

/**
 * Các chỗ v14 đổi hẳn tên chứ không chỉ đổi cách viết, nên suy máy móc từ
 * PascalCase sẽ ra sai. Khoá là tên v13, giá trị là tên v14.
 * @type {Object<string, Object<string, string>>}
 */
const RENAMES = {
  ChannelType: {
    GUILD_NEWS: 'GuildAnnouncement',
    GUILD_NEWS_THREAD: 'AnnouncementThread',
    GUILD_PUBLIC_THREAD: 'PublicThread',
    GUILD_PRIVATE_THREAD: 'PrivateThread',
  },
  PermissionFlagsBits: {
    MANAGE_EMOJIS_AND_STICKERS: 'ManageGuildExpressions',
    USE_PUBLIC_THREADS: 'CreatePublicThreads',
    USE_PRIVATE_THREADS: 'CreatePrivateThreads',
    START_EMBEDDED_ACTIVITIES: 'UseEmbeddedActivities',
    USE_APPLICATION_COMMANDS: 'UseApplicationCommands',
    USE_EXTERNAL_STICKERS: 'UseExternalStickers',
    USE_VAD: 'UseVAD',
  },
  GuildDefaultMessageNotifications: {
    ALL_MESSAGES: 'AllMessages',
    ONLY_MENTIONS: 'OnlyMentions',
  },
  GuildPremiumTier: {
    NONE: 'None',
    TIER_1: 'Tier1',
    TIER_2: 'Tier2',
    TIER_3: 'Tier3',
  },
};

module.exports = { toScreamingSnake, buildLegacyMap, RENAMES };
