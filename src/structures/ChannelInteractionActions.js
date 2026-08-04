'use strict';

const { ApplicationCommandOptionType } = require('discord-api-types/v10');
const { uploadInteractionAttachment } = require('../util/AttachmentUpload');
const { buildCommandInteraction, createNonce, sendInteraction } = require('../util/InteractionSender');
const { UserRoutes } = require('../util/UserRoutes');

const COMMAND_NAME_PATTERN = /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

/**
 * Tìm subcommand (hoặc subcommand group rồi subcommand) trong danh sách option.
 * @param {Array} options Danh sách option của cấp hiện tại
 * @param {string} name Tên cần tìm
 * @param {number} type Loại option cần tìm
 * @returns {Object}
 */
function findSubcommand(options, name, type) {
  const found = options?.find(option => option.type === type && [option.name, option.name_default].includes(name));
  if (!found) throw new Error(`Subcommand "${name}" not found`);
  return found;
}

/**
 * Đổi giá trị người dùng truyền vào thành option của API.
 *
 * Option kiểu attachment phải upload file trước; giá trị gửi lên là chỉ số của
 * file trong `data.attachments`, không phải bản thân file.
 * @param {Client} client Client đã đăng nhập
 * @param {Snowflake} channelId Kênh sẽ gửi lệnh
 * @param {Object} definition Định nghĩa option lấy từ Discord
 * @param {*} value Giá trị người dùng truyền
 * @param {Array} attachments Danh sách file đã upload, hàm này nối thêm vào
 * @returns {Promise<Object>}
 */
async function buildOption(client, channelId, definition, value, attachments) {
  if (definition.type !== ApplicationCommandOptionType.Attachment) {
    return { type: definition.type, name: definition.name, value };
  }

  const index = attachments.length;
  attachments.push(await uploadInteractionAttachment(client, channelId, value, index));

  return { type: definition.type, name: definition.name, value: String(index) };
}

/**
 * Thao tác interaction trên kênh, với tư cách tài khoản người dùng.
 * @type {Object}
 */
const ChannelInteractionActions = {
  /**
   * Tìm application command dùng được trong kênh này.
   * @param {Object} [options={}] Tuỳ chọn tìm kiếm
   * @param {string} [options.query] Lọc theo tên lệnh
   * @param {number} [options.limit=25] Số lệnh tối đa
   * @param {Snowflake} [options.applicationId] Chỉ lấy lệnh của một application
   * @returns {Promise<Object>} Payload thô, gồm `application_commands` và `applications`
   */
  async searchApplicationCommands({ query, limit = 25, applicationId } = {}) {
    // Kênh trong guild phải đi qua index của guild. Route search theo kênh trả
    // về `200` với danh sách **rỗng** ở mọi kênh guild — kể cả guild có sẵn hàng
    // trăm lệnh, kể cả khi ghim `application_id` hay truyền `query` thật — nên
    // dùng nó ở đây thì `sendSlash` không bao giờ tìm thấy lệnh nào. Client thật
    // cũng dựng danh sách gõ `/` từ index này.
    if (this.guild) {
      const data = await this.client.rest.get(UserRoutes.guildApplicationCommandIndex(this.guild.id));
      const applications = data.applications ?? [];

      // Người gọi thường cầm id của con bot, mà `application_id` trên lệnh là id
      // của application. Route search để Discord tự khớp hai thứ đó; lọc tại chỗ
      // thì phải tự làm.
      const target = applicationId
        ? applications.find(application => application.id === applicationId || application.bot_id === applicationId)
        : null;
      if (applicationId && !target) return { application_commands: [], applications: [] };

      const kept = (data.application_commands ?? [])
        .filter(
          command =>
            (!target || command.application_id === target.id) &&
            (!query || command.name.startsWith(query) || command.name_default?.startsWith(query)),
        )
        .slice(0, limit);

      const keptApplications = new Set(kept.map(command => command.application_id));
      return {
        application_commands: kept,
        applications: applications.filter(application => keptApplications.has(application.id)),
      };
    }

    const search = new URLSearchParams({ type: '1', limit: String(limit), include_applications: 'true' });
    if (query) search.set('query', query);
    if (applicationId) search.set('application_id', applicationId);

    return this.client.rest.get(UserRoutes.channelApplicationCommandSearch(this.id), { query: search });
  },

  /**
   * Gọi một slash command của bot khác, với tư cách tài khoản người dùng.
   * @param {UserResolvable} bot Bot hoặc application sở hữu lệnh
   * @param {string} commandName Tên lệnh, kèm subcommand nếu có: `'role add user'`
   * @param {...*} args Giá trị cho các option, theo đúng thứ tự Discord khai báo
   * @returns {Promise<Message|Object>} Tin nhắn bot trả lời, hoặc dữ liệu modal
   */
  async sendSlash(bot, commandName, ...args) {
    const path = commandName.trim().split(/\s+/);
    if (path.length > 3) throw new Error('A command path is at most "command group subcommand"');
    for (const part of path) {
      if (!COMMAND_NAME_PATTERN.test(part)) throw new Error(`Invalid command name segment: "${part}"`);
    }

    const [name, ...subPath] = path;
    const applicationId = this.client.users.resolveId(bot);
    const data = await this.searchApplicationCommands({ query: name, applicationId });

    const application = data.applications?.find(entry => entry.id === applicationId || entry.bot_id === applicationId);
    if (!application) throw new Error(`Application ${applicationId} has no commands in this channel`);

    const command = data.application_commands?.find(
      entry => entry.application_id === application.id && [entry.name, entry.name_default].includes(name),
    );
    if (!command) throw new Error(`Command "${name}" not found for application ${application.id}`);

    // Đi xuống theo đường dẫn subcommand để biết tầng option cuối cùng.
    let group;
    let subcommand;
    let leafOptions = command.options;

    if (subPath.length === 2) {
      group = findSubcommand(command.options, subPath[0], ApplicationCommandOptionType.SubcommandGroup);
      subcommand = findSubcommand(group.options, subPath[1], ApplicationCommandOptionType.Subcommand);
      leafOptions = subcommand.options;
    } else if (subPath.length === 1) {
      subcommand = findSubcommand(command.options, subPath[0], ApplicationCommandOptionType.Subcommand);
      leafOptions = subcommand.options;
    }

    const definitions = leafOptions ?? [];
    const required = definitions.filter(option => option.required).length;
    const values = args.flat(2);
    if (values.length < required) {
      throw new Error(`Command "${commandName}" needs at least ${required} option(s), got ${values.length}`);
    }

    const attachments = [];
    const built = [];
    for (const [index, value] of values.slice(0, definitions.length).entries()) {
      if (value === undefined) continue;
      // Tuần tự chứ không Promise.all: chỉ số file phải khớp thứ tự trong
      // `data.attachments`, chạy song song là lệch.
      built.push(await buildOption(this.client, this.id, definitions[index], value, attachments));
    }

    // Option của subcommand phải nằm lồng trong chính subcommand đó.
    let options = built;
    if (subcommand) {
      options = [{ type: ApplicationCommandOptionType.Subcommand, name: subcommand.name, options: built }];
    }
    if (group) {
      options = [{ type: ApplicationCommandOptionType.SubcommandGroup, name: group.name, options }];
    }

    const body = buildCommandInteraction({
      applicationId: application.id,
      nonce: createNonce(),
      guildId: this.guild?.id,
      channelId: this.id,
      sessionId: this.client.sessionId,
      command,
      options,
      attachments,
    });

    return sendInteraction(this.client, body);
  },
};

module.exports = ChannelInteractionActions;
