'use strict';

/**
 * Ba cái tên tồn tại ở CẢ v13 lẫn v14 nhưng chỉ hai thứ khác nhau, nên không
 * alias được — đè lên sẽ phá code v14.
 *
 * | Tên | Ở v13 là | Ở v14 là | Code cũ phải đổi sang |
 * |---|---|---|---|
 * | `TextInputComponent` | builder ô nhập | model ô nhập đã gửi | `TextInputBuilder` |
 * | `CommandInteraction` | interaction slash command | lớp cha của mọi command interaction | `ChatInputCommandInteraction` |
 * | `SelectMenuInteraction` | interaction select menu | lớp cha của mọi select menu | `StringSelectMenuInteraction` |
 *
 * Nhóm cờ (`MessageFlags`, `UserFlags`...) cũng vướng lý do tương tự, xem ghi
 * chú trong `buildAliases`.
 * @type {string[]}
 */
const UNALIASABLE = ['TextInputComponent', 'CommandInteraction', 'SelectMenuInteraction'];

/**
 * Tên lớp của v13 ánh xạ sang lớp tương ứng của v14.
 *
 * Đây là alias thật, không phải lớp bọc: `MessageEmbed === EmbedBuilder`. Nghĩa
 * là `instanceof` vẫn đúng cả hai chiều, và không có lớp con nào để lệch hành vi.
 * @returns {Object<string, Function>}
 */
function buildAliases() {
  const djs = require('../index');

  return {
    // Builder
    MessageEmbed: djs.EmbedBuilder,
    MessageAttachment: djs.AttachmentBuilder,
    MessageActionRow: djs.ActionRowBuilder,
    MessageButton: djs.ButtonBuilder,
    MessageSelectMenu: djs.StringSelectMenuBuilder,
    MessageSelectOption: djs.StringSelectMenuOptionBuilder,
    Modal: djs.ModalBuilder,

    // Kênh
    Channel: djs.BaseChannel,

    // Interaction
    BaseCommandInteraction: djs.CommandInteraction,
    ContextMenuInteraction: djs.ContextMenuCommandInteraction,

    // BitField
    //
    // Chỉ alias hai cái không va tên với enum của `discord-api-types`.
    // `MessageFlags`, `UserFlags`, `ActivityFlags`, `ApplicationFlags`,
    // `ChannelFlags`, `GuildMemberFlags`, `RoleFlags`, `AttachmentFlags` và
    // `ThreadMemberFlags` ở v13 là lớp BitField, nhưng ở v14 chính là enum của
    // API và được `src/index.js` re-export. Alias đè lên sẽ che mất enum, hỏng
    // nhiều thứ hơn là cứu. Code cũ phải đổi sang tên `*BitField`.
    Permissions: djs.PermissionsBitField,
    Intents: djs.IntentsBitField,
    SystemChannelFlags: djs.SystemChannelFlagsBitField,
  };
}

/**
 * Method của v13 đã bị đổi tên hoặc bỏ ở v14, gắn lại làm alias.
 * @returns {void}
 */
function applyMethodAliases() {
  const djs = require('../index');

  // `addField(name, value, inline)` bị bỏ ở v14, chỉ còn `addFields({...})`.
  if (typeof djs.EmbedBuilder.prototype.addField !== 'function') {
    djs.EmbedBuilder.prototype.addField = function addField(name, value, inline = false) {
      return this.addFields({ name, value, inline });
    };
  }

  // `isText()` đổi thành `isTextBased()`.
  if (typeof djs.BaseChannel.prototype.isText !== 'function') {
    djs.BaseChannel.prototype.isText = function isText() {
      return this.isTextBased();
    };
  }

  // `isVoice()` đổi thành `isVoiceBased()`.
  if (typeof djs.BaseChannel.prototype.isVoice !== 'function') {
    djs.BaseChannel.prototype.isVoice = function isVoice() {
      return this.isVoiceBased();
    };
  }
}

module.exports = { buildAliases, applyMethodAliases, UNALIASABLE };
