'use strict';

const {
  ActivityType,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AuditLogEvent,
  ButtonStyle,
  ChannelType,
  ComponentType,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildNSFWLevel,
  GuildPremiumTier,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  GuildVerificationLevel,
  IntegrationExpireBehavior,
  InteractionType,
  InviteTargetType,
  MessageType,
  OverwriteType,
  StageInstancePrivacyLevel,
  StickerFormatType,
  StickerType,
  TeamMemberMembershipState,
  TextInputStyle,
  VideoQualityMode,
  WebhookType,
} = require('discord-api-types/v10');
const { buildLegacyMap, RENAMES } = require('./legacyNames');
const Events = require('../util/Events');
const { RelationshipType } = require('../util/UserEnums');

/**
 * `Constants` mang hình dạng của v13, để code cũ so sánh qua hằng số
 * (`Constants.ChannelTypes.GUILD_TEXT`) vẫn chạy.
 *
 * <warn>Đây KHÔNG cứu được so sánh literal ở phía đọc — `channel.type` vẫn trả
 * số. Xem `scripts/codemod-v13-to-v14.mjs`.</warn>
 * @type {Object}
 */
const Constants = {
  ChannelTypes: buildLegacyMap(ChannelType, RENAMES.ChannelType),
  ActivityTypes: buildLegacyMap(ActivityType),
  ApplicationCommandTypes: buildLegacyMap(ApplicationCommandType),
  ApplicationCommandOptionTypes: buildLegacyMap(ApplicationCommandOptionType),
  MessageButtonStyles: buildLegacyMap(ButtonStyle),
  MessageComponentTypes: buildLegacyMap(ComponentType),
  TextInputStyles: buildLegacyMap(TextInputStyle),
  InteractionTypes: buildLegacyMap(InteractionType),
  MessageTypes: buildLegacyMap(MessageType),
  StickerTypes: buildLegacyMap(StickerType),
  StickerFormatTypes: buildLegacyMap(StickerFormatType),
  VerificationLevels: buildLegacyMap(GuildVerificationLevel),
  DefaultMessageNotificationLevels: buildLegacyMap(
    GuildDefaultMessageNotifications,
    RENAMES.GuildDefaultMessageNotifications,
  ),
  ExplicitContentFilterLevels: buildLegacyMap(GuildExplicitContentFilter),
  NSFWLevels: buildLegacyMap(GuildNSFWLevel),
  PremiumTiers: buildLegacyMap(GuildPremiumTier, RENAMES.GuildPremiumTier),
  GuildScheduledEventStatuses: buildLegacyMap(GuildScheduledEventStatus),
  GuildScheduledEventPrivacyLevels: buildLegacyMap(GuildScheduledEventPrivacyLevel),
  GuildScheduledEventEntityTypes: buildLegacyMap(GuildScheduledEventEntityType),
  PrivacyLevels: buildLegacyMap(StageInstancePrivacyLevel),
  WebhookTypes: buildLegacyMap(WebhookType),
  InviteTargetType: buildLegacyMap(InviteTargetType),
  IntegrationExpireBehaviors: buildLegacyMap(IntegrationExpireBehavior),
  AuditLogEvents: buildLegacyMap(AuditLogEvent),
  VideoQualityModes: buildLegacyMap(VideoQualityMode),
  OverwriteTypes: buildLegacyMap(OverwriteType),
  MembershipStates: buildLegacyMap(TeamMemberMembershipState),
  RelationshipTypes: buildLegacyMap(RelationshipType),

  // Giá trị của `Events` trong v14 trùng hệt chuỗi event của v13
  // (`'messageCreate'`...), nên dùng thẳng được, chỉ khác cách viết khoá.
  Events,
};

module.exports = Constants;
