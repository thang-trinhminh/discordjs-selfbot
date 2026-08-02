'use strict';

const { Collection } = require('@discordjs/collection');
const BaseManager = require('./BaseManager');
const GuildBoost = require('../structures/GuildBoost');
const { UserRoutes } = require('../util/UserRoutes');

/**
 * Thông tin thanh toán và suất boost của client user.
 * @extends {BaseManager}
 */
class BillingManager extends BaseManager {
  constructor(client) {
    super(client);

    /**
     * Nguồn thanh toán đã lưu. Dữ liệu thô, chưa bọc thành structure.
     * @type {Collection<Snowflake, Object>}
     */
    this.paymentSources = new Collection();

    /**
     * Các suất boost đang sở hữu.
     * @type {Collection<Snowflake, GuildBoost>}
     */
    this.guildBoosts = new Collection();

    /**
     * Các gói đăng ký đang hoạt động. Dữ liệu thô, chưa bọc thành structure.
     * @type {Collection<Snowflake, Object>}
     */
    this.currentSubscription = new Collection();
  }

  /**
   * Tải lại danh sách nguồn thanh toán.
   * @returns {Promise<Collection<Snowflake, Object>>}
   */
  async fetchPaymentSources() {
    const data = await this.client.rest.get(UserRoutes.billingPaymentSources());
    this.paymentSources = new Collection(data.map(source => [source.id, source]));
    return this.paymentSources;
  }

  /**
   * Tải lại các suất boost.
   * @returns {Promise<Collection<Snowflake, GuildBoost>>}
   */
  async fetchGuildBoosts() {
    const data = await this.client.rest.get(UserRoutes.premiumSubscriptionSlots());
    this.guildBoosts = new Collection(data.map(slot => [slot.id, new GuildBoost(this.client, slot)]));
    return this.guildBoosts;
  }

  /**
   * Tải lại các gói đăng ký đang hoạt động.
   * @returns {Promise<Collection<Snowflake, Object>>}
   */
  async fetchCurrentSubscription() {
    const data = await this.client.rest.get(UserRoutes.billingSubscriptions());
    this.currentSubscription = new Collection(data.map(subscription => [subscription.id, subscription]));
    return this.currentSubscription;
  }
}

module.exports = BillingManager;
