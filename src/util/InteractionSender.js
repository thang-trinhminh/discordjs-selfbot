'use strict';

const { setTimeout, clearTimeout } = require('node:timers');
const { DiscordSnowflake } = require('@sapphire/snowflake');
const { ComponentType, InteractionType } = require('discord-api-types/v10');
const Events = require('./Events');
const { UserRoutes } = require('./UserRoutes');

const DEFAULT_TIMEOUT = 5_000;

/**
 * Sinh nonce cho một interaction.
 *
 * Discord dùng nonce để nối request với event trả về trên gateway — REST chỉ
 * trả 204, mọi thứ khác về qua `MESSAGE_CREATE` hoặc `INTERACTION_MODAL_CREATE`.
 * @returns {string}
 */
function createNonce() {
  return DiscordSnowflake.generate().toString();
}

/**
 * Dựng body cho interaction kiểu application command.
 * @param {Object} options Tuỳ chọn
 * @param {Snowflake} options.applicationId Id của application sở hữu lệnh
 * @param {string} options.nonce Nonce nối request với event
 * @param {?Snowflake} options.guildId Guild chứa kênh, bỏ trống nếu là DM
 * @param {Snowflake} options.channelId Kênh gửi lệnh
 * @param {?string} options.sessionId Session id của gateway
 * @param {Object} options.command Lệnh thô lấy từ endpoint tìm kiếm
 * @param {Array} [options.options=[]] Danh sách option đã dựng sẵn
 * @param {Array} [options.attachments=[]] File đính kèm
 * @param {boolean} [options.isAutocomplete=false] Gửi để lấy gợi ý autocomplete
 * @returns {Object}
 */
function buildCommandInteraction({
  applicationId,
  nonce,
  guildId,
  channelId,
  sessionId,
  command,
  options = [],
  attachments = [],
  isAutocomplete = false,
}) {
  const body = {
    type: isAutocomplete ? InteractionType.ApplicationCommandAutocomplete : InteractionType.ApplicationCommand,
    application_id: applicationId,
    guild_id: guildId,
    channel_id: channelId,
    session_id: sessionId,
    data: {
      version: command.version,
      id: command.id,
      name: command.name_default ?? command.name,
      type: command.type,
      options,
      attachments,
    },
    nonce,
  };

  // Lệnh riêng của guild cần thêm `guild_id` trong `data`, lệnh toàn cục thì không.
  if (command.guild_id) body.data.guild_id = guildId;

  return body;
}

/**
 * Dựng body cho interaction kiểu component (bấm nút, chọn menu).
 * @param {Object} options Tuỳ chọn
 * @param {Snowflake} options.applicationId Id của application sở hữu tin nhắn
 * @param {string} options.nonce Nonce nối request với event
 * @param {?Snowflake} options.guildId Guild chứa kênh
 * @param {Snowflake} options.channelId Kênh chứa tin nhắn
 * @param {Snowflake} options.messageId Tin nhắn chứa component
 * @param {number} options.messageFlags Cờ của tin nhắn
 * @param {?string} options.sessionId Session id của gateway
 * @param {number} options.componentType Loại component
 * @param {string} options.customId `custom_id` của component
 * @param {string[]} [options.values] Giá trị đã chọn, chỉ dùng cho select menu
 * @returns {Object}
 */
function buildComponentInteraction({
  applicationId,
  nonce,
  guildId,
  channelId,
  messageId,
  messageFlags,
  sessionId,
  componentType,
  customId,
  values,
}) {
  return {
    type: InteractionType.MessageComponent,
    nonce,
    guild_id: guildId,
    channel_id: channelId,
    message_id: messageId,
    application_id: applicationId,
    session_id: sessionId,
    message_flags: messageFlags,
    data: {
      component_type: componentType,
      custom_id: customId,
      ...(values ? { values } : {}),
    },
  };
}

/**
 * Dựng body cho việc gửi modal đã điền.
 * @param {Object} options Tuỳ chọn
 * @param {Snowflake} options.applicationId Id của application
 * @param {string} options.nonce Nonce nối request với event
 * @param {?Snowflake} options.guildId Guild chứa kênh
 * @param {Snowflake} options.channelId Kênh
 * @param {?string} options.sessionId Session id của gateway
 * @param {string} options.customId `custom_id` của modal
 * @param {Array} options.components Các hàng component đã điền
 * @returns {Object}
 */
function buildModalSubmit({ applicationId, nonce, guildId, channelId, sessionId, customId, components }) {
  return {
    type: InteractionType.ModalSubmit,
    nonce,
    guild_id: guildId,
    channel_id: channelId,
    application_id: applicationId,
    session_id: sessionId,
    data: {
      custom_id: customId,
      components,
    },
  };
}

/**
 * Chờ event gateway ứng với nonce vừa gửi.
 *
 * REST chỉ trả 204 nên không biết được kết quả từ đó. Bot trả lời bằng tin nhắn
 * thì về qua `MESSAGE_CREATE`, mở modal thì về qua `INTERACTION_MODAL_CREATE`.
 * @param {Client} client Client đã đăng nhập
 * @param {string} nonce Nonce đã gửi kèm
 * @param {number} [timeout=5000] Thời gian chờ, tính bằng mili giây
 * @returns {Promise<Message|ModalData>}
 */
function awaitInteractionResponse(client, nonce, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      client.removeListener(Events.MessageCreate, handler);
      client.removeListener(Events.InteractionModalCreate, handler);
    };

    const handler = data => {
      if (data?.nonce !== nonce) return;
      cleanup();
      resolve(data);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Interaction ${nonce} did not get a response within ${timeout}ms`));
    }, timeout);

    // `unref` để một interaction treo không giữ process sống.
    timer.unref?.();

    client.on(Events.MessageCreate, handler);
    client.on(Events.InteractionModalCreate, handler);
  });
}

/**
 * Gửi một interaction rồi chờ kết quả trên gateway.
 * @param {Client} client Client đã đăng nhập
 * @param {Object} body Body đã dựng
 * @param {number} [timeout=5000] Thời gian chờ
 * @returns {Promise<Message|ModalData>}
 */
async function sendInteraction(client, body, timeout = DEFAULT_TIMEOUT) {
  // Đăng ký chờ TRƯỚC khi gửi: bot trả lời rất nhanh, đăng ký sau là có thể
  // lỡ mất event.
  const waiting = awaitInteractionResponse(client, body.nonce, timeout);
  await client.rest.post(UserRoutes.interactions(), { body });
  return waiting;
}

/**
 * Tìm component theo `custom_id` hoặc theo vị trí hàng trong một tin nhắn.
 * @param {Message} message Tin nhắn chứa component
 * @param {string|number} target `custom_id`, hoặc chỉ số hàng
 * @param {number[]} allowedTypes Các loại component chấp nhận
 * @returns {?Object}
 */
function resolveMessageComponent(message, target, allowedTypes) {
  const components = message.components.flatMap(row => row.components ?? []);

  if (typeof target === 'number') {
    return components.filter(component => allowedTypes.includes(component.type))[target] ?? null;
  }

  return components.find(component => allowedTypes.includes(component.type) && component.customId === target) ?? null;
}

const SELECT_MENU_TYPES = [
  ComponentType.StringSelect,
  ComponentType.UserSelect,
  ComponentType.RoleSelect,
  ComponentType.MentionableSelect,
  ComponentType.ChannelSelect,
];

module.exports = {
  createNonce,
  buildCommandInteraction,
  buildComponentInteraction,
  buildModalSubmit,
  awaitInteractionResponse,
  sendInteraction,
  resolveMessageComponent,
  SELECT_MENU_TYPES,
};
