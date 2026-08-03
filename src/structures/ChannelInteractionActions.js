'use strict';

const { ApplicationCommandOptionType } = require('discord-api-types/v10');
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
 * Chỉ xử lý các loại giá trị vô hướng. Option kiểu attachment cần upload file
 * trước rồi tham chiếu theo chỉ số — chưa làm, truyền vào sẽ báo lỗi rõ ràng
 * thay vì gửi payload sai lên Discord.
 * @param {Object} definition Định nghĩa option lấy từ Discord
 * @param {*} value Giá trị người dùng truyền
 * @returns {Object}
 */
function buildOption(definition, value) {
  if (definition.type === ApplicationCommandOptionType.Attachment) {
    throw new Error(`Option "${definition.name}" is an attachment option, which is not supported yet`);
  }

  return { type: definition.type, name: definition.name, value };
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
  searchApplicationCommands({ query, limit = 25, applicationId } = {}) {
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

    const built = values
      .slice(0, definitions.length)
      .map((value, index) => buildOption(definitions[index], value))
      .filter(option => option.value !== undefined);

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
    });

    return sendInteraction(this.client, body);
  },
};

module.exports = ChannelInteractionActions;
