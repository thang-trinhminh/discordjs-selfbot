'use strict';

const { SimpleShardingStrategy } = require('@discordjs/ws');
const { GatewayOpcodes } = require('discord-api-types/v10');
const buildUserIdentify = require('../../util/buildUserIdentify');

/**
 * Bọc `shard.send` để viết lại payload identify thành dạng user account.
 *
 * `@discordjs/ws` dựng payload cho bot (có `intents`, có `shard`) rồi gọi
 * `this.send(...)`. Discord đóng kết nối nếu user account gửi hai field đó,
 * nên chặn ngay ở `send` — rẻ hơn thay cả method `identify` và không phụ
 * thuộc vào thân hàm `identify` của upstream.
 *
 * Patch ở mức instance, không đụng prototype, nên nhiều client trong cùng
 * process không giẫm lên nhau.
 *
 * @param {WebSocketShard} shard Shard cần patch
 * @param {Object} clientOptions Options của client
 * @param {Function} getToken Hàm trả về token hiện tại
 * @returns {void}
 */
function patchShardSend(shard, clientOptions, getToken) {
  const originalSend = shard.send.bind(shard);

  shard.send = async payload => {
    if (payload?.op !== GatewayOpcodes.Identify) return originalSend(payload);

    return originalSend({
      op: GatewayOpcodes.Identify,
      d: buildUserIdentify({
        token: getToken(),
        properties: clientOptions.ws.properties,
        capabilities: clientOptions.ws.capabilities,
        clientState: clientOptions.ws.client_state,
        presence: payload.d?.presence,
      }),
    });
  };
}

/**
 * Sharding strategy dùng cho user account: giống upstream, chỉ patch thêm
 * `send` của từng shard sau khi spawn.
 * @extends {SimpleShardingStrategy}
 */
class SelfbotShardingStrategy extends SimpleShardingStrategy {
  /**
   * @param {WebSocketManager} manager Manager của @discordjs/ws
   * @param {Object} clientOptions Options của client
   * @param {Function} getToken Hàm trả về token hiện tại
   */
  constructor(manager, clientOptions, getToken) {
    super(manager);
    this.clientOptions = clientOptions;
    this.getToken = getToken;
  }

  async spawn(shardIds) {
    await super.spawn(shardIds);
    for (const shard of this.shards.values()) {
      patchShardSend(shard, this.clientOptions, this.getToken);
    }
  }
}

module.exports = { SelfbotShardingStrategy, patchShardSend };
