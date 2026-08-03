'use strict';

const { ComponentType } = require('discord-api-types/v10');
const {
  SELECT_MENU_TYPES,
  buildComponentInteraction,
  createNonce,
  resolveMessageComponent,
  sendInteraction,
} = require('../util/InteractionSender');

/**
 * Thao tác với component trên tin nhắn của bot, với tư cách tài khoản người dùng.
 *
 * Để riêng file rồi trộn vào prototype, để phần lệch với upstream trong
 * `Message.js` chỉ còn một dòng.
 * @type {Object}
 */
const MessageInteractionActions = {
  /**
   * Bấm một nút trên tin nhắn.
   * @param {string|number} button `custom_id` của nút, hoặc chỉ số nút
   * @param {number} [timeout=5000] Thời gian chờ phản hồi
   * @returns {Promise<Message|Object>} Tin nhắn bot trả lời, hoặc dữ liệu modal
   */
  async clickButton(button, timeout) {
    const target = resolveMessageComponent(this, button, [ComponentType.Button]);
    if (!target) throw new Error(`Button ${button} not found on message ${this.id}`);
    if (target.disabled) throw new Error(`Button ${target.customId} is disabled`);
    if (!target.customId) throw new Error('Link buttons have no custom id and cannot be clicked through the API');

    const body = buildComponentInteraction({
      applicationId: this.applicationId ?? this.author.id,
      nonce: createNonce(),
      guildId: this.guildId ?? undefined,
      channelId: this.channelId,
      messageId: this.id,
      messageFlags: this.flags.bitfield,
      sessionId: this.client.sessionId,
      componentType: ComponentType.Button,
      customId: target.customId,
    });

    return sendInteraction(this.client, body, timeout);
  },

  /**
   * Chọn giá trị trên một select menu.
   * @param {string|number} menu `custom_id` của menu, hoặc chỉ số menu
   * @param {string[]} [values=[]] Giá trị cần chọn; với string select thì nhận cả label
   * @param {number} [timeout=5000] Thời gian chờ phản hồi
   * @returns {Promise<Message|Object>}
   */
  async selectMenu(menu, values = [], timeout) {
    const target = resolveMessageComponent(this, menu, SELECT_MENU_TYPES);
    if (!target) throw new Error(`Select menu ${menu} not found on message ${this.id}`);
    if (target.disabled) throw new Error(`Select menu ${target.customId} is disabled`);

    const minValues = target.minValues ?? 1;
    const maxValues = target.maxValues ?? 1;
    if (values.length < minValues) throw new RangeError(`Select menu needs at least ${minValues} value(s)`);
    if (values.length > maxValues) throw new RangeError(`Select menu accepts at most ${maxValues} value(s)`);

    // String select nhận cả label cho tiện, các loại khác nhận thẳng id.
    const resolved =
      target.type === ComponentType.StringSelect
        ? values.map(value => {
            const option = target.options?.find(entry => entry.value === value || entry.label === value);
            if (!option) throw new Error(`Option ${value} not found on select menu ${target.customId}`);
            return option.value;
          })
        : values;

    const body = buildComponentInteraction({
      applicationId: this.applicationId ?? this.author.id,
      nonce: createNonce(),
      guildId: this.guildId ?? undefined,
      channelId: this.channelId,
      messageId: this.id,
      messageFlags: this.flags.bitfield,
      sessionId: this.client.sessionId,
      componentType: target.type,
      customId: target.customId,
      values: resolved,
    });

    return sendInteraction(this.client, body, timeout);
  },
};

module.exports = MessageInteractionActions;
